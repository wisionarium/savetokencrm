/**
 * POST /api/v1/media/galeria/upload — sobe imagem direto p/ a galeria (agent+).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { traduzir } from "@/lib/i18n/dicionario";
import { extFromMime } from "@/lib/messaging/media/types";
import { registrarNaGaleria, tabelaDaGaleriaAusente, MIGRATION_PENDENTE_MSG } from "@/lib/galeria/biblioteca";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const PREVIEW_TTL_S = 3600;

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "galeria" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user, org: activeOrg } = authz;

    const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const pastaId = form?.get("pasta_id");
  // Dimensões medidas no browser (compressão client-side); opcionais.
  const largura = Number(form?.get("largura") ?? 0);
  const altura = Number(form?.get("altura") ?? 0);  if (!(file instanceof File)) {
    return fail("validation_failed", t("Campo 'file' obrigatório."), 422, { requestId });
  }
  const mime = file.type || "application/octet-stream";
  if (!mime.startsWith("image/")) {
    return fail("unsupported_media_type", t("A Galeria guarda imagens."), 415, { requestId });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return fail("payload_too_large", t("Imagem acima de 15MB."), 413, { requestId });
  }

  const admin = createAdminClient();
  let pasta: string | null = null;
  if (typeof pastaId === "string" && pastaId) {
    const { data: p, error: pastaErr } = await admin
      .from("galeria_pastas")
      .select("id")
      .eq("id", pastaId)
      .eq("organization_id", activeOrg.orgId)
      .maybeSingle();
    if (pastaErr && tabelaDaGaleriaAusente(pastaErr)) {
      return fail("migration_pendente", MIGRATION_PENDENTE_MSG, 503, { requestId });
    }
    if (!p) return fail("not_found", t("Pasta não encontrada."), 404, { requestId });
    pasta = pastaId;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extFromMime(mime) || "jpg";
  const storagePath = `${activeOrg.orgId}/galeria/${randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("whatsapp-media")
    .upload(storagePath, buffer, { contentType: mime, upsert: false });
  if (upErr) return fail("internal_error", t("Erro ao subir a imagem."), 500, { requestId });

    const nome = (file.name || "imagem").slice(0, 120);
    await registrarNaGaleria(admin, {
      organization_id: activeOrg.orgId,
      storage_path: storagePath,
      nome,
      mime,
      size_bytes: buffer.length,
      ...(Number.isInteger(largura) && largura > 0 ? { largura } : {}),
      ...(Number.isInteger(altura) && altura > 0 ? { altura } : {}),
      origem: "galeria",
      created_by: user.id,
    });
  if (pasta) {
    await admin
      .from("galeria_arquivos")
      .update({ pasta_id: pasta })
      .eq("organization_id", activeOrg.orgId)
      .eq("storage_path", storagePath);
  }

  void audit({
    action: "galeria.arquivo_criado",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "galeria_arquivo",
    requestId,
    metadata: { nome },
  });

  const { data: signed } = await admin.storage
    .from("whatsapp-media")
    .createSignedUrl(storagePath, PREVIEW_TTL_S);
  return ok(
    { storage_path: storagePath, nome, mime, preview_url: signed?.signedUrl ?? null },
    { requestId, status: 201 },
  );
}
