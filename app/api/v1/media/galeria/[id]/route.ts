/**
 * PATCH  /api/v1/media/galeria/[id] — renomear / mover de pasta (agent+).
 * DELETE /api/v1/media/galeria/[id] — apaga do bucket + da tabela (manager+).
 *
 * Apagar aqui é o ÚNICO caminho que remove o arquivo do banco: apagar fluxo
 * ou mensagem nunca toca a Galeria. A resposta do DELETE traz onde o arquivo
 * era usado, para a tela avisar antes de confirmar.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { traduzir } from "@/lib/i18n/dicionario";
import { galeriaPatchSchema } from "@/lib/galeria/contrato";
import { tabelaDaGaleriaAusente, MIGRATION_PENDENTE_MSG, usosDoArquivo } from "@/lib/galeria/biblioteca";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return fail("invalid_request", "Id inválido.", 400, { requestId });
  }
  const authz = await requireRole("agent", { requestId, resource: "galeria" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user, org: activeOrg } = authz;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_request", t("Body JSON inválido."), 400, { requestId });
  }
  const parsed = galeriaPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", t("Campos inválidos."), 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const admin = createAdminClient();
  const { data: atual, error: lookupErr } = await admin
    .from("galeria_arquivos")
    .select("id, nome")
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (lookupErr && tabelaDaGaleriaAusente(lookupErr)) {
    return fail("migration_pendente", MIGRATION_PENDENTE_MSG, 503, { requestId });
  }
  if (!atual) return fail("not_found", t("Arquivo não encontrado."), 404, { requestId });

  if (parsed.data.pasta_id !== undefined && parsed.data.pasta_id !== null) {
    const { data: pasta } = await admin
      .from("galeria_pastas")
      .select("id")
      .eq("id", parsed.data.pasta_id)
      .eq("organization_id", activeOrg.orgId)
      .maybeSingle();
    if (!pasta) return fail("not_found", t("Pasta não encontrada."), 404, { requestId });
  }

  const { data: atualizado, error } = await admin
    .from("galeria_arquivos")
    .update({
      ...(parsed.data.nome !== undefined ? { nome: parsed.data.nome } : {}),
      ...(parsed.data.pasta_id !== undefined ? { pasta_id: parsed.data.pasta_id } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .select("id, storage_path, nome, mime, size_bytes, origem, pasta_id, created_at")
    .single();
  if (error || !atualizado) {
    return fail("internal_error", error?.message ?? "update_failed", 500, { requestId });
  }

  void audit({
    action: "galeria.arquivo_atualizado",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "galeria_arquivo",
    resourceId: id,
    requestId,
    metadata: { nome: (atualizado as { nome: string }).nome },
  });

  return ok(atualizado, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return fail("invalid_request", "Id inválido.", 400, { requestId });
  }
  const authz = await requireRole("manager", { requestId, resource: "galeria" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user, org: activeOrg } = authz;

  const admin = createAdminClient();
  const { data: atual, error: lookupErr } = await admin
    .from("galeria_arquivos")
    .select("id, storage_path, nome")
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (lookupErr && tabelaDaGaleriaAusente(lookupErr)) {
    return fail("migration_pendente", MIGRATION_PENDENTE_MSG, 503, { requestId });
  }
  if (!atual) return fail("not_found", t("Arquivo não encontrado."), 404, { requestId });
  const path = (atual as { storage_path: string; nome: string }).storage_path;

  const usos = await usosDoArquivo(admin, activeOrg.orgId, path);

  const { error: rmErr } = await admin.storage.from("whatsapp-media").remove([path]);
  // Arquivo já sumido = idempotente: segue e limpa a linha.
  if (rmErr && !/not found|does not exist/i.test(rmErr.message)) {
    return fail("internal_error", t("Erro ao apagar do armazenamento."), 500, { requestId });
  }
  await admin
    .from("galeria_arquivos")
    .delete()
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId);

  void audit({
    action: "galeria.arquivo_apagado",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "galeria_arquivo",
    resourceId: id,
    requestId,
    metadata: { nome: (atual as { nome: string }).nome, ...usos },
  });

  return ok({ apagado: true, usos }, { requestId });
}
