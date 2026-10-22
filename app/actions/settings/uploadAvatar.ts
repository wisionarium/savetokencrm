"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const BUCKET_NAME = "avatars";

const MIME_PARA_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type UploadAvatarResult =
  | { ok: true; avatarUrl: string }
  | { ok: false; error: string };

export async function uploadAvatar(formData: FormData): Promise<UploadAvatarResult> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "Nenhum arquivo enviado." };
  }

  if (file.size > MAX_BYTES) {
    return { ok: false, error: "A imagem deve ter no máximo 5MB." };
  }

  const mime = file.type.toLowerCase();
  const ext = MIME_PARA_EXT[mime];
  if (!ext) {
    return { ok: false, error: "Formato inválido. Envie PNG, JPG, WEBP ou GIF." };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const admin = createAdminClient();
  const caminho = `${authUser.id}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET_NAME)
    .upload(caminho, buffer, {
      contentType: mime,
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, error: `Falha no upload: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET_NAME).getPublicUrl(caminho);

  const supabase = await createClient();
  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      avatar_url: publicUrl,
    },
  });

  if (updateError) {
    return { ok: false, error: `Falha ao salvar no perfil: ${updateError.message}` };
  }

  const activeOrg = await resolveActiveOrg(authUser);
  await audit({
    action: "profile.updated",
    actorUserId: authUser.id,
    organizationId: activeOrg?.orgId ?? null,
    resourceType: "user",
    resourceId: authUser.id,
    metadata: {
      avatar_uploaded: true,
      path: caminho,
    },
  });

  revalidatePath("/app/settings/profile");
  return { ok: true, avatarUrl: publicUrl };
}
