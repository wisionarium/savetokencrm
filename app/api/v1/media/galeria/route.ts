/**
 * GET /api/v1/media/galeria — lista a biblioteca (viewer+).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  galeriaArquivoSchema,
  galeriaListQuerySchema,
  NOME_SEM_PASTA,
} from "@/lib/galeria/contrato";
import { sincronizarGaleria, tabelaDaGaleriaAusente, MIGRATION_PENDENTE_MSG, usosDoArquivo } from "@/lib/galeria/biblioteca";

export const dynamic = "force-dynamic";

const PREVIEW_TTL_S = 3600;

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "galeria" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = galeriaListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return fail("validation_failed", "Parâmetros inválidos.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }
  const { q, pasta, origem, limit, offset } = parsed.data;

  // UUID malformado em `pasta` daria 400 do PostgREST (virava 500 opaco).
  if (pasta && pasta !== NOME_SEM_PASTA && !z.string().uuid().safeParse(pasta).success) {
    return fail("validation_failed", "Parâmetro 'pasta' inválido.", 422, { requestId });
  }

  const admin = createAdminClient();
  // Onde é usado (para a tela avisar antes de apagar): ?usos_de=<uuid>.
  const usosDe = new URL(req.url).searchParams.get("usos_de");
  if (usosDe) {
    const { data: linha } = await admin
      .from("galeria_arquivos")
      .select("storage_path")
      .eq("id", usosDe)
      .eq("organization_id", activeOrg.orgId)
      .maybeSingle();
    if (!linha) return fail("not_found", "Arquivo não encontrado.", 404, { requestId });
    const usos = await usosDoArquivo(
      admin,
      activeOrg.orgId,
      (linha as { storage_path: string }).storage_path,
    );
    return ok(usos, { requestId });
  }

  // Traz para a tabela o que o time já subiu antes da Galeria existir.
  await sincronizarGaleria(admin, activeOrg.orgId, authz.user.id);

  let sel = admin
    .from("galeria_arquivos")
    .select("id, storage_path, nome, mime, size_bytes, largura, altura, origem, pasta_id, created_at", {
      count: "exact",
    })
    .eq("organization_id", activeOrg.orgId);

  if (origem) sel = sel.eq("origem", origem);
  if (pasta === NOME_SEM_PASTA) sel = sel.is("pasta_id", null);
  else if (pasta) sel = sel.eq("pasta_id", pasta);
  if (q) sel = sel.ilike("nome", `%${q.replace(/[%_\\]/g, "\\$&")}%`);

  const { data, error, count } = await sel
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    if (tabelaDaGaleriaAusente(error)) {
      return fail("migration_pendente", MIGRATION_PENDENTE_MSG, 503, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const comPreview = await Promise.all(
    rows.map(async (r) => {
      let preview_url: string | undefined;
      try {
        const { data: signed } = await admin.storage
          .from("whatsapp-media")
          .createSignedUrl(r.storage_path as string, PREVIEW_TTL_S);
        preview_url = signed?.signedUrl || undefined;
      } catch {
        // sem preview; a linha continua listando
      }
      const validado = galeriaArquivoSchema.safeParse({ ...r, preview_url });
      return validado.success ? validado.data : null;
    }),
  );

  return ok(
    comPreview.filter((r) => r !== null),
    { requestId, meta: { total: count ?? 0 } },
  );
}
