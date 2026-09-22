/**
 * GET  /api/v1/media/galeria/pastas — lista pastas com contagem (viewer+).
 * POST /api/v1/media/galeria/pastas — cria pasta (agent+).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { traduzir } from "@/lib/i18n/dicionario";
import { galeriaPastaCreateSchema } from "@/lib/galeria/contrato";
import { tabelaDaGaleriaAusente, MIGRATION_PENDENTE_MSG } from "@/lib/galeria/biblioteca";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "galeria" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("galeria_pastas")
    .select("id, nome, created_at")
    .eq("organization_id", activeOrg.orgId)
    .order("nome");
  if (error) {
    if (tabelaDaGaleriaAusente(error)) {
      return fail("migration_pendente", MIGRATION_PENDENTE_MSG, 503, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }

  const pastas = (data ?? []) as Array<{ id: string; nome: string; created_at: string }>;
  const comContagem = await Promise.all(
    pastas.map(async (p) => {
      const { count } = await admin
        .from("galeria_arquivos")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrg.orgId)
        .eq("pasta_id", p.id);
      return { ...p, total_arquivos: count ?? 0 };
    }),
  );
  return ok(comContagem, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
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
    .insert({
      organization_id: activeOrg.orgId,
      nome: parsed.data.nome,
      created_by: user.id,
    })
    .select("id, nome, created_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      return fail("conflict", t("Já existe uma pasta com este nome."), 409, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }

  void audit({
    action: "galeria.pasta_criada",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "galeria_pasta",
    resourceId: (data as { id: string }).id,
    requestId,
    metadata: { nome: parsed.data.nome },
  });

  return ok(data, { requestId, status: 201 });
}
