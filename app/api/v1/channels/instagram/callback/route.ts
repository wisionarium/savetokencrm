/**
 * GET /api/v1/channels/instagram/callback — Callback de redirecionamento do OAuth da Meta.
 *
 * Recebe o authorization code após o cliente autorizar a página/Instagram,
 * troca por um token de longa duração e salva a conexão na organização ativa.
 */
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { exchangeInstagramCode } from "@/lib/channels/instagram/oauth";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendInstagramLog } from "@/lib/channels/instagram/logs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const error = params.get("error");
  const errorDescription = params.get("error_description");

  const baseUrl = req.nextUrl.origin;

  const state = params.get("state") || "";
  let targetOrgId = state.startsWith("org_") ? state.replace("org_", "") : null;

  if (error || !code) {
    logger.warn("instagram_oauth_callback_failed", { error, errorDescription });
    await appendInstagramLog(targetOrgId, {
      level: "error",
      category: "oauth",
      title: "Autorização do Facebook/Meta não concluída",
      details: errorDescription || error || "O usuário cancelou o login ou a Meta retornou erro.",
    });
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

  // Salva conexão na organização
  if (!targetOrgId) {
    try {
      const user = await loadAuthUser();
      if (user) {
        const activeOrg = await resolveActiveOrg(user);
        targetOrgId = activeOrg?.orgId ?? null;
      }
    } catch {
      // fallback silencioso
    }
  }

  if (targetOrgId && primaryAccount) {
    try {
      const supabase = createAdminClient();
      const { data: orgData } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", targetOrgId)
        .single();

      const currentSettings = (orgData?.settings as Record<string, unknown>) || {};
      await supabase
        .from("organizations")
        .update({
          settings: {
            ...currentSettings,
            instagram_connection: {
              connected_at: new Date().toISOString(),
              page_id: primaryAccount.pageId,
              page_name: primaryAccount.pageName,
              page_access_token: primaryAccount.pageAccessToken,
              instagram_business_id: primaryAccount.instagramBusinessId || null,
              instagram_username: primaryAccount.instagramUsername || null,
              instagram_name: primaryAccount.instagramName || null,
              profile_picture_url: primaryAccount.profilePictureUrl || null,
            },
          },
        })
        .eq("id", targetOrgId);

      logger.info("instagram_connection_persisted_to_org", { orgId: targetOrgId });

      await appendInstagramLog(targetOrgId, {
        level: "success",
        category: "oauth",
        title: `Conta do Instagram conectada: @${primaryAccount.instagramUsername || primaryAccount.pageName}`,
        details: `Página "${primaryAccount.pageName}" (ID: ${primaryAccount.pageId}) vinculada com sucesso. Instagram Business ID: ${primaryAccount.instagramBusinessId || "Detectado"}.`,
      });
    } catch (persistErr) {
      logger.error("instagram_connection_persist_error", {
        error: persistErr instanceof Error ? persistErr.message : String(persistErr),
      });
      await appendInstagramLog(targetOrgId, {
        level: "error",
        category: "oauth",
        title: "Erro ao salvar conexão no banco de dados",
        details: persistErr instanceof Error ? persistErr.message : String(persistErr),
      });
    }
  }

  return NextResponse.redirect(`${baseUrl}/app/connections?aba=instagram&sucesso=conectado`);
}
