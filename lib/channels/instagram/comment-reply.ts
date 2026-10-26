/**
 * Disparo de Resposta Pública e Resposta Privada (DM) a comentários no Instagram via Graph API.
 *
 * Fica em `lib/channels/` para respeitar a doutrina de restrição de canal.
 */
import { logger } from "@/lib/logger";

export async function replyToInstagramComment(input: {
  commentId: string;
  publicReplyText?: string;
  dmText?: string;
  pageId: string;
  pageAccessToken: string;
}): Promise<{ publicOk: boolean; dmOk: boolean }> {
  let publicOk = false;
  let dmOk = false;

  // 1. Resposta Pública no Comentário (se informada)
  if (input.publicReplyText) {
    try {
      const replyUrl = new URL(`https://graph.facebook.com/v21.0/${input.commentId}/replies`);
      replyUrl.searchParams.set("message", input.publicReplyText);
      replyUrl.searchParams.set("access_token", input.pageAccessToken);

      const res = await fetch(replyUrl.toString(), { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error) {
        publicOk = true;
        logger.info("instagram_comment_public_reply_success", { commentId: input.commentId });
      } else {
        logger.warn("instagram_comment_public_reply_failed", {
          commentId: input.commentId,
          error: data.error?.message,
        });
      }
    } catch (err) {
      logger.error("instagram_comment_public_reply_error", {
        commentId: input.commentId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. Resposta Privada no Direct (Private Reply)
  if (input.dmText) {
    try {
      const dmUrl = `https://graph.facebook.com/v21.0/${input.pageId}/messages`;
      const res = await fetch(dmUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.pageAccessToken}`,
        },
        body: JSON.stringify({
          recipient: { comment_id: input.commentId },
          message: { text: input.dmText },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error) {
        dmOk = true;
        logger.info("instagram_comment_private_dm_success", { commentId: input.commentId });
      } else {
        logger.warn("instagram_comment_private_dm_failed", {
          commentId: input.commentId,
          error: data.error?.message,
        });
      }
    } catch (err) {
      logger.error("instagram_comment_private_dm_error", {
        commentId: input.commentId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { publicOk, dmOk };
}
