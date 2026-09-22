import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { sinalizarDigitando } from "@/lib/messaging/presenca";
import {
  guessDispatchMime,
  isDispatchPlaceholderBody,
  readDispatchDelay,
  resolveDispatchMedia,
} from "@/lib/followup/dispatch-graph";
import type { FlowGraph, FlowNode } from "@/lib/followup/graph-schema";

export const dynamic = "force-dynamic";

const dispatchBodySchema = z.strictObject({
  pointer_id: z.string().uuid(),
});

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id: conversationId } = await ctx.params;

  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;

  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user, org: activeOrg } = authz;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_request", t("Body JSON inválido."), 400, { requestId });
  }

  const parsed = dispatchBodySchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", t("Campos inválidos."), 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const supabase = await createClient();

  // Buscar o ponteiro do fluxo
  const { data: pointer, error: ptrErr } = await supabase
    .from("followup_flow_pointers")
    .select("id, name, status, inbox_enabled, active_version_id, draft_graph")
    .eq("id", parsed.data.pointer_id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();

  if (ptrErr || !pointer) {
    return fail("not_found", t("Fluxo não encontrado."), 404, { requestId });
  }

  if (!pointer.inbox_enabled) {
    return fail("forbidden", t("Este fluxo não está habilitado para a Caixa de Entrada."), 400, { requestId });
  }

  if (pointer.status !== "active") {
    return fail("forbidden", t("Este fluxo precisa estar Ativo para ser disparado."), 400, { requestId });
  }

  // Resolver o grafo ativo ou rascunho
  let graph: FlowGraph | null = (pointer.draft_graph as FlowGraph | null) ?? null;
  if (pointer.active_version_id) {
    const { data: verRow } = await supabase
      .from("followup_flow_versions")
      .select("graph")
      .eq("id", pointer.active_version_id)
      .single();
    if (verRow?.graph) {
      graph = verRow.graph as FlowGraph;
    }
  }

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return fail("validation_failed", t("Fluxo sem nós válidos para disparo."), 422, { requestId });
  }

  // Ordenar nós a partir do Gatilho
  const triggerNode = graph.nodes.find((n) => n.type === "trigger");
  const nodesToProcess: FlowNode[] = [];

  if (triggerNode) {
    let currId: string | undefined = triggerNode.id;
    const visited = new Set<string>();

    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const edge = graph.edges.find((e) => e.source === currId);
      if (!edge) break;
      const targetNode = graph.nodes.find((n) => n.id === edge.target);
      if (targetNode) {
        nodesToProcess.push(targetNode);
        currId = targetNode.id;
      } else {
        break;
      }
    }
  } else {
    nodesToProcess.push(...graph.nodes.filter((n) => n.type !== "trigger"));
  }

  // Se nenhum nó ordenado foi encontrado, pegar todos os nós que enviam mensagem/ação
  const actionNodes = nodesToProcess.length > 0 ? nodesToProcess : graph.nodes.filter((n) => n.type === "action" || n.type === "wait");

  // Intervalo "digitando…" entre mensagens: configurado no trigger do
  // grafo (editável no editor, 0–30s, default 2600 — 30s é a parede do
  // apiClient para mutações). Nós `wait` legados continuam respeitados.
  const typingDelayMs = readDispatchDelay(graph);

  // "digitando…" de verdade no aparelho do cliente durante o intervalo
  // (best-effort: sessão fora do ar ou canal sem presença = silêncio, sem
  // erro). Fire-and-forget para não entrar na latência da resposta.
  const acenderDigitando = () => {
    void sinalizarDigitando(supabase, {
      organizationId: activeOrg.orgId,
      conversationId,
    }).catch(() => {});
  };

  let sentCount = 0;

  for (let i = 0; i < actionNodes.length; i++) {
    const node = actionNodes[i]!;

    if (node.type === "wait") {
      const waitMs = node.config.mode === "fixed" ? node.config.duration_ms : typingDelayMs;
      acenderDigitando();
      await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 30000)));
      continue;
    }

    if (node.type === "action") {
      const config = node.config;
      let bodyText = "";
      let mediaStoragePath: string | undefined;
      let mediaUrl: string | undefined;
      let messageType: "text" | "image" | "video" | "document" = "text";

      if (config.mode === "text") {
        // Placeholder ("Imagem do produto") e URL no body nunca viram legenda:
        // a mídia vai por media_storage_path/media_url, o texto vem do nó de
        // especificações. Sem isso o lead recebia o nome do campo como mensagem.
        if (!isDispatchPlaceholderBody(config.body)) bodyText = config.body;
        const media = resolveDispatchMedia(node);
        if (media?.kind === "storage") {
          mediaStoragePath = media.path;
          messageType = "image";
        } else if (media?.kind === "url") {
          mediaUrl = media.url;
          messageType = "image";
        }
      } else if (config.mode === "ai_message") {
        bodyText = config.prompt_hint;
      }

      const mediaMime =
        mediaStoragePath || mediaUrl
          ? guessDispatchMime(mediaStoragePath ?? mediaUrl ?? "")
          : undefined;
      if (bodyText || mediaStoragePath || mediaUrl) {
        await sendMessageHandler(
          supabase,
          {
            organization_id: activeOrg.orgId,
            actor: { type: "user", id: user.id },
            requestId,
            idioma: authz.user.idioma,
          },
          {
            conversation_id: conversationId,
            type: messageType,
            body: bodyText || undefined,
            media_storage_path: mediaStoragePath,
            media_url: mediaUrl,
            media_mime: mediaMime,
          },
        );
        sentCount++;
      }

      // Se for mensagem com mídia e a próxima for outra ação sem nó de
      // wait explícito: acende o "digitando…" e aguarda o intervalo do trigger.
      const nextNode = actionNodes[i + 1];
      if ((mediaStoragePath || mediaUrl) && nextNode && nextNode.type === "action") {
        acenderDigitando();
        await new Promise((resolve) => setTimeout(resolve, typingDelayMs));
      }
    }
  }

  void audit({
    action: "followup_flow.updated",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "followup_flow_pointer",
    resourceId: pointer.id,
    requestId,
    metadata: { conversation_id: conversationId, flow_name: pointer.name, sent_count: sentCount },
  });

  return ok({ dispatched: true, flow_name: pointer.name, sent_count: sentCount }, { requestId });
}
