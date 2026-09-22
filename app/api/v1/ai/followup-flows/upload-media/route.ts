import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { traduzir } from "@/lib/i18n/dicionario";
import { extFromMime } from "@/lib/messaging/media/types";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();

  const authz = await requireRole("agent", { requestId, resource: "followup_flows" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { org: activeOrg } = authz;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return fail("validation_failed", t("Campo 'file' obrigatório."), 422, { requestId });
  }

  const mime = file.type || "application/octet-stream";
  if (!mime.startsWith("image/")) {
    return fail("unsupported_media_type", t("Apenas arquivos de imagem são permitidos."), 415, { requestId });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return fail("payload_too_large", t("Imagem acima de 15MB."), 413, { requestId });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extFromMime(mime) || "jpg";
  const storagePath = `${activeOrg.orgId}/dispatch-flows/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("whatsapp-media")
    .upload(storagePath, buffer, { contentType: mime, upsert: false });

  if (upErr) {
    console.error("[followup-flows.upload-media] upload failed:", upErr.message);
    return fail("internal_error", t("Erro ao salvar imagem no servidor."), 500, { requestId });
  }

  // URL assinada com validade de 5 anos para prévia imediata no navegador
  const FIVE_YEARS_S = 5 * 365 * 24 * 60 * 60;
  const { data: signed, error: signErr } = await admin.storage
    .from("whatsapp-media")
    .createSignedUrl(storagePath, FIVE_YEARS_S);

  const url = signed?.signedUrl || "";

  return ok(
    {
      storage_path: storagePath,
      url,
      mime,
      name: file.name,
      size: file.size,
    },
    { requestId },
  );
}
