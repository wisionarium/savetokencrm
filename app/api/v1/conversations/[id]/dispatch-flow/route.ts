import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { traduzir } from "@/lib/i18n/dicionario";
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

  let sentCount = 0;

  for (let i = 0; i < actionNodes.length; i++) {
    const node = actionNodes[i]!;

    if (node.type === "wait") {
      // Delay padrão entre imagem e texto de 2.6 segundos (ou duration_ms se configurado)
      const waitMs = node.config.mode === "fixed" ? node.config.duration_ms : 2600;
      // Delay curto no endpoint para envio sequencial
      const delay = Math.min(waitMs, 5000); // Teto de 5s no request HTTP
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    if (node.type === "action") {
      const config = node.config;
      let bodyText = "";
      let mediaStoragePath: string | undefined;
      let mediaMime: string | undefined;
      let messageType: "text" | "image" | "video" | "document" = "text";

      if (config.mode === "text") {
        bodyText = config.body;
      } else if (config.mode === "ai_message") {
        bodyText = config.prompt_hint;
      }

      // Checar se há dados de mídia guardados no nó (ex: url/storage path)
      const nodeData = (node as unknown as { data?: { media_storage_path?: string; media_mime?: string; media_type?: string } }).data;
      if (nodeData?.media_storage_path) {
        mediaStoragePath = nodeData.media_storage_path;
        mediaMime = nodeData.media_mime;
        messageType = (nodeData.media_type as "image" | "video" | "document") ?? "image";
      }

      if (bodyText || mediaStoragePath) {
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
            media_mime: mediaMime,
          }
        );
        sentCount++;
      }

      // Se for a mensagem com imagem e a próxima for texto sem nó de wait explícito, aguardar 2.6s
      const nextNode = actionNodes[i + 1];
      if (mediaStoragePath && nextNode && nextNode.type === "action") {
        await new Promise((resolve) => setTimeout(resolve, 2600));
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
