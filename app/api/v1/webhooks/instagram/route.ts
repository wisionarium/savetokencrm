/**
 * GET|POST /api/v1/webhooks/instagram — Webhook Oficial da Meta para Instagram (DMs e Comentários).
 *
 * GET: Handshake de validação da Meta (devolve hub.challenge em text/plain).
 * POST: Ingestão de mensagens diretas (DMs) e comentários em publicações/reels.
 */
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";

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

    // TODO: Processamento de eventos (messages, messaging_postbacks, comments)
    // A Meta exige resposta 200 rápida para evitar retentativas.
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    logger.error("instagram_webhook_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Mesmo em caso de erro no parse, devolver 200 para evitar que a Meta suspenda o webhook
    return new NextResponse("OK", { status: 200 });
  }
}
