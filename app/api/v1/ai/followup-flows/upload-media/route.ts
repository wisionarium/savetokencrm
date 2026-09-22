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
  let { error: upErr } = await admin.storage
    .from("whatsapp-media")
    .upload(storagePath, buffer, { contentType: mime, upsert: true });

  if (upErr) {
    try {
      await admin.storage.createBucket("whatsapp-media", { public: false });
      const retry = await admin.storage
        .from("whatsapp-media")
        .upload(storagePath, buffer, { contentType: mime, upsert: true });
      upErr = retry.error;
    } catch {
      // ignore bucket creation error
    }
  }

  let url = "";
  if (!upErr) {
    const FIVE_YEARS_S = 5 * 365 * 24 * 60 * 60;
    const { data: signed } = await admin.storage
      .from("whatsapp-media")
      .createSignedUrl(storagePath, FIVE_YEARS_S);
    url = signed?.signedUrl || "";
    if (!url) {
      const { data: pub } = admin.storage.from("whatsapp-media").getPublicUrl(storagePath);
      url = pub.publicUrl;
    }
  }

  if (upErr || !url) {
    console.warn("[followup-flows.upload-media] Storage upload unavailable, using Data URL fallback:", upErr?.message);
    const base64 = buffer.toString("base64");
    url = `data:${mime};base64,${base64}`;
  }

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
