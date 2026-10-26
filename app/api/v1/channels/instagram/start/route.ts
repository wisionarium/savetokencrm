/**
 * GET /api/v1/channels/instagram/start — Inicia o fluxo de Login do Facebook para conectar Instagram.
 */
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const META_APP_ID = process.env.META_APP_ID || "1454524740075812";

const SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
].join(",");

export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/v1/channels/instagram/callback`;

  const metaAuthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  metaAuthUrl.searchParams.set("client_id", META_APP_ID);
  metaAuthUrl.searchParams.set("redirect_uri", redirectUri);
  metaAuthUrl.searchParams.set("scope", SCOPES);
  metaAuthUrl.searchParams.set("response_type", "code");
  metaAuthUrl.searchParams.set("state", "instagram_connect");

  return NextResponse.redirect(metaAuthUrl.toString());
}
