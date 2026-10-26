/**
 * Busca de mídia (Posts, Reels, Vídeos) da conta do Instagram conectada via Graph API.
 */
import { logger } from "@/lib/logger";

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export async function fetchInstagramMedia(input: {
  instagramBusinessId: string;
  accessToken: string;
}): Promise<{ ok: boolean; items: InstagramMediaItem[]; error?: string }> {
  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${input.instagramBusinessId}/media`);
    url.searchParams.set(
      "fields",
      "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    );
    url.searchParams.set("access_token", input.accessToken);
    url.searchParams.set("limit", "24");

    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    const data = (await res.json().catch(() => ({}))) as {
      data?: InstagramMediaItem[];
      error?: { message?: string };
    };

    if (!res.ok || !data.data) {
      const err = data.error?.message || `http_${res.status}`;
      logger.error("instagram_fetch_media_failed", { error: err });
      return { ok: false, items: [], error: err };
    }

    return { ok: true, items: data.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("instagram_fetch_media_exception", { error: msg });
    return { ok: false, items: [], error: msg };
  }
}
