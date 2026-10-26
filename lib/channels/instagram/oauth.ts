/**
 * OAuth token exchange e obtenção das contas do Instagram/Páginas da Meta.
 *
 * Fica em `lib/channels/` para respeitar a doutrina de restrição de canal
 * (invariante 1 do lint-channels).
 */
import { logger } from "@/lib/logger";

export interface InstagramAccountInfo {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramBusinessId?: string;
  instagramUsername?: string;
  instagramName?: string;
  profilePictureUrl?: string;
}

export interface ExchangeResult {
  ok: boolean;
  userAccessToken?: string;
  accounts?: InstagramAccountInfo[];
  error?: string;
}

export async function exchangeInstagramCode(input: {
  code: string;
  redirectUri: string;
}): Promise<ExchangeResult> {
  const appId = process.env.META_APP_ID || "1454524740075812";
  const appSecret = process.env.META_APP_SECRET || "7d3e497cd10b5afdd867d7a3b4c456b7";

  try {
    // 1. Troca code por short-lived user token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", input.redirectUri);
    tokenUrl.searchParams.set("code", input.code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = (await tokenRes.json().catch(() => ({}))) as {
      access_token?: string;
      error?: { message?: string };
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      const err = tokenData.error?.message || `http_${tokenRes.status}`;
      logger.error("meta_oauth_token_exchange_failed", { error: err });
      return { ok: false, error: err };
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Troca por long-lived user token (60 dias)
    const longLivedUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = (await longLivedRes.json().catch(() => ({}))) as {
      access_token?: string;
    };

    const userToken = longLivedData.access_token || shortLivedToken;

    // 3. Busca Páginas e Contas de Instagram vinculadas
    const accountsUrl = new URL("https://graph.facebook.com/v21.0/me/accounts");
    accountsUrl.searchParams.set(
      "fields",
      "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
    );
    accountsUrl.searchParams.set("access_token", userToken);

    const accountsRes = await fetch(accountsUrl.toString());
    const accountsData = (await accountsRes.json().catch(() => ({}))) as {
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: {
          id: string;
          username?: string;
          name?: string;
          profile_picture_url?: string;
        };
      }>;
      error?: { message?: string };
    };

    if (!accountsRes.ok || !accountsData.data) {
      logger.warn("meta_oauth_accounts_fetch_failed", {
        error: accountsData.error?.message,
      });
      return { ok: true, userAccessToken: userToken, accounts: [] };
    }

    const accounts: InstagramAccountInfo[] = accountsData.data.map((p) => ({
      pageId: p.id,
      pageName: p.name,
      pageAccessToken: p.access_token,
      instagramBusinessId: p.instagram_business_account?.id,
      instagramUsername: p.instagram_business_account?.username,
      instagramName: p.instagram_business_account?.name,
      profilePictureUrl: p.instagram_business_account?.profile_picture_url,
    }));

    return {
      ok: true,
      userAccessToken: userToken,
      accounts,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("meta_oauth_unexpected_exception", { error: msg });
    return { ok: false, error: msg };
  }
}
