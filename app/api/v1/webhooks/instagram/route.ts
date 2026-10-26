/**
 * GET|POST /api/v1/webhooks/instagram — Webhook Oficial da Meta para Instagram (DMs e Comentários).
 *
 * GET: Handshake de validação da Meta (devolve hub.challenge em text/plain).
 * POST: Ingestão de mensagens diretas (DMs) e comentários em publicações/reels.
 */
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { replyToInstagramComment } from "@/lib/channels/instagram/comment-reply";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INSTAGRAM_VERIFY_TOKEN =
  process.env.INSTAGRAM_VERIFY_TOKEN || "tecla_crm_insta_webhook_2026";

/**
 * Handshake da Meta: validação do webhook.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  logger.info("instagram_webhook_verification_attempt", {
    mode,
    tokenReceived: token ? "present" : "missing",
    challengeReceived: challenge ? "present" : "missing",
  });

  if (mode === "subscribe" && token === INSTAGRAM_VERIFY_TOKEN && challenge) {
    logger.info("instagram_webhook_verified_successfully");
    // A Meta exige retorno do challenge cru em texto puro com HTTP 200
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  logger.warn("instagram_webhook_verification_failed", {
    expectedToken: INSTAGRAM_VERIFY_TOKEN,
    receivedToken: token,
  });

  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * Ingestão de eventos do Instagram: mensagens diretas (DMs) e comentários.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.json();

    logger.info("instagram_webhook_received", {
      object: rawBody?.object,
      entryCount: rawBody?.entry?.length ?? 0,
    });

    if (Array.isArray(rawBody?.entry)) {
      const supabase = createAdminClient();
      for (const entry of rawBody.entry) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field === "comments" && change.value) {
            const commentVal = change.value;
            const commentId = commentVal.id;
            const commentText = (commentVal.text || "").toLowerCase().trim();
            const mediaId = commentVal.media?.id;
            const username = commentVal.from?.username || "";

            logger.info("instagram_comment_received", {
              commentId,
              mediaId,
              commentTextSnippet: commentText.slice(0, 30),
              from: username,
            });

            const { data: orgs } = await supabase
              .from("organizations")
              .select("id, settings");

            for (const org of orgs || []) {
              const settings = (org.settings as Record<string, unknown>) || {};
              const insta = settings.instagram_connection as Record<string, string> | undefined;
              const automations = (settings.instagram_automations as Array<{
                id: string;
                is_active: boolean;
                target_type: "all_posts" | "specific_post";
                post_id?: string | null;
                keywords: string[];
                reply_comment_text: string;
                dm_message_text: string;
              }>) || [];

              if (!insta?.page_access_token || !insta?.page_id) continue;

              for (const auto of automations) {
                if (!auto.is_active) continue;

                if (auto.target_type === "specific_post" && auto.post_id && auto.post_id !== mediaId) {
                  continue;
                }

                const kws: string[] = auto.keywords || [];
                const matched =
                  kws.length === 0 ||
                  kws.some((k) => k && commentText.includes(k.toLowerCase().trim()));

                if (matched) {
                  const dmText = (auto.dm_message_text || "").replace(
                    /@(primeiro_nome|nome)/gi,
                    username || "amigo",
                  );
                  const publicText = (auto.reply_comment_text || "").replace(
                    /@(primeiro_nome|nome)/gi,
                    username || "amigo",
                  );

                  await replyToInstagramComment({
                    commentId,
                    publicReplyText: publicText,
                    dmText,
                    pageId: insta.page_id,
                    pageAccessToken: insta.page_access_token,
                  });
                  break;
                }
              }
            }
          }
        }
      }
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    logger.error("instagram_webhook_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Mesmo em caso de erro no parse, devolver 200 para evitar que a Meta suspenda o webhook
    return new NextResponse("OK", { status: 200 });
  }
}
