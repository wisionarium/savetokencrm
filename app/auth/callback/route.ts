import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyInviteToken } from "@/lib/auth/invite-token";
import { aplicarConvite } from "@/lib/auth/aplicar-convite";
import { ensureTenantForUser } from "@/lib/auth/provision";
import { modoDeCadastro } from "@/lib/auth/politica-de-cadastro";
import { cookieSecure } from "@/lib/supabase/cookie-secure";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /auth/callback — Retorno do OAuth (Google e outros provedores).
 *
 * Troca o `code` de autorização pela sessão do Supabase e vincula:
 * 1. Convite explícito via ?invite=<token>
 * 2. Convite pendente no banco para o e-mail retornado pela conta Google
 * 3. Organização existente se o usuário já pertencer a alguma
 * 4. Provisionamento de novo tenant caso seja o primeiro cadastro do dono
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const invite = url.searchParams.get("invite");
  const oauthError = url.searchParams.get("error");
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  const origin = request.nextUrl.origin || env.NEXT_PUBLIC_APP_URL;
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, origin));

  if (oauthError || !code) {
    return redirectTo("/login?error=oauth_error");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    await audit({
      action: "auth.login_failed",
      metadata: { reason: "oauth_exchange_failed", error: error?.message ?? "no_user" },
      requestId,
    });
    return redirectTo("/login?error=oauth_error");
  }

  const user = data.user;

  // Sincroniza foto e nome do perfil Google se ainda não existirem no user_metadata
  const googleAvatar =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;
  const googleName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;

  if (googleAvatar && !user.user_metadata?.avatar_url) {
    try {
      await supabase.auth.updateUser({
        data: {
          avatar_url: googleAvatar,
          ...(googleName && !user.user_metadata?.full_name ? { full_name: googleName } : {}),
        },
      });
    } catch {
      // Falha não-fatal: o resolvedor em lib/auth/server.ts tem fallback para picture
    }
  }

  // 1. Convite explícito fornecido via token no query param
  if (invite) {
    const payload = verifyInviteToken(invite);
    if (payload) {
      const resConvite = await aplicarConvite({
        userId: user.id,
        payload,
        requestId,
      });
      if (resConvite.ok) {
        return redirectTo(next || "/app");
      }
    }
  }

  // 2. Convite pendente no banco de dados para este e-mail
  if (user.email) {
    const admin = createAdminClient();
    const emailNormalizado = user.email.toLowerCase().trim();

    const { data: convitePendente } = await admin
      .from("team_invites")
      .select("id, organization_id, role, interface_settings, invited_by, created_at, expires_at")
      .eq("email", emailNormalizado)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (convitePendente) {
      const resConvite = await aplicarConvite({
        userId: user.id,
        payload: {
          invite_id: convitePendente.id,
          organization_id: convitePendente.organization_id,
          email: emailNormalizado,
          role: convitePendente.role as any,
          interface_settings: convitePendente.interface_settings as any,
          invited_by: convitePendente.invited_by ?? undefined,
          exp: Math.floor(new Date(convitePendente.expires_at).getTime() / 1000),
          iat: Math.floor(new Date(convitePendente.created_at).getTime() / 1000),
        },
        requestId,
      });

      if (resConvite.ok) {
        return redirectTo(next || "/app");
      }
    }
  }

  // 3. Usuário já existente com organização vinculada
  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("user_organizations")
    .select("organization_id")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .limit(1);

  if (memberships && memberships.length > 0) {
    const orgId = memberships[0]?.organization_id;
    if (orgId) {
      (await cookies()).set("active_org", orgId, {
        httpOnly: true,
        sameSite: "lax",
        secure: cookieSecure(),
        path: "/",
      });
    }
    return redirectTo(next || "/app");
  }

  // 4. Usuário novo: verifica política de cadastro
  if ((await modoDeCadastro()) === "so_convite") {
    await audit({
      action: "auth.signup_provision_recusado",
      actorUserId: user.id,
      metadata: { motivo: "somente_convite", provider: "google" },
      requestId,
    });
    return redirectTo("/login?error=cadastro_por_convite");
  }

  try {
    await ensureTenantForUser(user);
  } catch (e) {
    await audit({
      action: "auth.signup_provision_failed",
      actorUserId: user.id,
      metadata: { reason: e instanceof Error ? e.message : String(e), provider: "google" },
      requestId,
    });
    return redirectTo("/get-started");
  }

  void audit({
    action: "auth.signup_confirmed",
    actorUserId: user.id,
    metadata: { provider: "google" },
    requestId,
  });

  return redirectTo(next || "/onboarding/welcome");
}
