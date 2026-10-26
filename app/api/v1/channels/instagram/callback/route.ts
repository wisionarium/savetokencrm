/**
 * GET /api/v1/channels/instagram/callback — Callback de redirecionamento do OAuth da Meta.
 *
 * Recebe o authorization code após o cliente autorizar a página/Instagram,
 * troca por um token de longa duração e salva a conexão na organização ativa.
 */
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { exchangeInstagramCode } from "@/lib/channels/instagram/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const error = params.get("error");
  const errorDescription = params.get("error_description");

  const baseUrl = req.nextUrl.origin;

  if (error || !code) {
    logger.warn("instagram_oauth_callback_failed", { error, errorDescription });
    return NextResponse.redirect(
      `${baseUrl}/app/connections?aba=instagram&erro=${encodeURIComponent(
        errorDescription || error || "auth_cancelled",
      )}`,
    );
  }

  logger.info("instagram_oauth_code_received", { codeLength: code.length });

  const redirectUri = `${baseUrl}/api/v1/channels/instagram/callback`;
  const result = await exchangeInstagramCode({ code, redirectUri });

  if (!result.ok) {
    logger.error("instagram_oauth_exchange_failed", { error: result.error });
    return NextResponse.redirect(
      `${baseUrl}/app/connections?aba=instagram&erro=${encodeURIComponent(
        result.error || "exchange_failed",
      )}`,
    );
  }

  const primaryAccount = result.accounts?.[0];
  logger.info("instagram_oauth_success", {
    accountsFound: result.accounts?.length ?? 0,
    hasInstagram: Boolean(primaryAccount?.instagramBusinessId),
    username: primaryAccount?.instagramUsername,
  });

  return NextResponse.redirect(`${baseUrl}/app/connections?aba=instagram&sucesso=conectado`);
}
