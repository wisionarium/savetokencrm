/**
 * GET /api/v1/channels/instagram/media — Busca publicações (Posts, Reels, Vídeos) do Instagram da organização.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { fetchInstagramMedia } from "@/lib/channels/instagram/media";

export const dynamic = "force-dynamic";

export async function GET(_req?: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "instagram_media" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const supabase = await createClient();
  const { data: orgData, error: orgErr } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .single();

  if (orgErr) {
    return fail("database_error", orgErr.message, 500, { requestId });
  }

  const settings = (orgData?.settings as Record<string, unknown>) || {};
  const insta = settings.instagram_connection as
    | {
        page_access_token?: string;
        instagram_business_id?: string;
        instagram_username?: string;
      }
    | undefined;

  if (!insta || !insta.instagram_business_id || !insta.page_access_token) {
    return ok(
      {
        connected: false,
        items: [],
        message: "Nenhuma conta comercial do Instagram conectada na organização.",
      },
      { requestId },
    );
  }

  const mediaRes = await fetchInstagramMedia({
    instagramBusinessId: insta.instagram_business_id,
    accessToken: insta.page_access_token,
  });

  if (!mediaRes.ok) {
    return ok(
      {
        connected: true,
        username: insta.instagram_username,
        items: [],
        error: mediaRes.error,
      },
      { requestId },
    );
  }

  return ok(
    {
      connected: true,
      username: insta.instagram_username,
      items: mediaRes.items,
    },
    { requestId },
  );
}
