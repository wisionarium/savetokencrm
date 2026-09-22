/**
 * PATCH  /api/v1/media/galeria/pastas/[id] — renomear (agent+).
 * DELETE /api/v1/media/galeria/pastas/[id] — apaga a pasta, arquivos vão
 *   para "sem pasta" (nunca apaga arquivo junto) (manager+).
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
import { galeriaPastaCreateSchema } from "@/lib/galeria/contrato";

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
  const parsed = galeriaPastaCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", t("Campos inválidos."), 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("galeria_pastas")
    .update({ nome: parsed.data.nome, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .select("id, nome, created_at")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return fail("conflict", t("Já existe uma pasta com este nome."), 409, { requestId });
    }
    return fail("not_found", t("Pasta não encontrada."), 404, { requestId });
  }

  void audit({
    action: "galeria.pasta_atualizada",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "galeria_pasta",
    resourceId: id,
    requestId,
    metadata: { nome: parsed.data.nome },
  });

  return ok(data, { requestId });
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
  const { data: pasta } = await admin
    .from("galeria_pastas")
    .select("id, nome")
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (!pasta) return fail("not_found", t("Pasta não encontrada."), 404, { requestId });

  // Arquivos NUNCA vão junto: voltam para "sem pasta".
  await admin
    .from("galeria_arquivos")
    .update({ pasta_id: null })
    .eq("organization_id", activeOrg.orgId)
    .eq("pasta_id", id);
  await admin
    .from("galeria_pastas")
    .delete()
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId);

  void audit({
    action: "galeria.pasta_apagada",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "galeria_pasta",
    resourceId: id,
    requestId,
    metadata: { nome: (pasta as { nome: string }).nome },
  });

  return ok({ apagada: true }, { requestId });
}
