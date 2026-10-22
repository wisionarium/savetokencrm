import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { aplicarConvite } from "@/lib/auth/aplicar-convite";
import { verifyInviteToken } from "@/lib/auth/invite-token";
import { ensureTenantForUser } from "@/lib/auth/provision";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/aplicar-convite", () => ({ aplicarConvite: vi.fn() }));
vi.mock("@/lib/auth/invite-token", () => ({ verifyInviteToken: vi.fn() }));
vi.mock("@/lib/auth/provision", () => ({ ensureTenantForUser: vi.fn(async () => undefined) }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" } }));

const USUARIO = { id: "11111111-1111-4111-8111-111111111111", email: "user123@gmail.com" };
const PAYLOAD = {
  invite_id: "22222222-2222-4222-8222-222222222222",
  email: "user123@gmail.com",
  organization_id: "33333333-3333-4333-8333-333333333333",
  role: "agent",
  exp: Math.floor(Date.now() / 1000) + 3600,
};

function requisicao(query: string): NextRequest {
  const url = `http://localhost:3000/auth/callback${query ? `?${query}` : ""}`;
  return new NextRequest(url, { headers: { "x-request-id": "req-1" } });
}

function destino(res: Response): string {
  const loc = res.headers.get("location") ?? "";
  const u = new URL(loc, "http://localhost:3000");
  return `${u.pathname}${u.search}`;
}

describe("GET /auth/callback (OAuth Google)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sem code ou com erro: recusa e manda para /login?error=oauth_error", async () => {
    const { GET } = await import("./route");
    const resSemCode = await GET(requisicao(""));
    expect(destino(resSemCode)).toBe("/login?error=oauth_error");

    const resComErro = await GET(requisicao("error=access_denied"));
    expect(destino(resComErro)).toBe("/login?error=oauth_error");
  });

  it("com convite no query param: valida token e aplica convite entrando em /app", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn(async () => ({ data: { user: USUARIO }, error: null })),
      },
    } as any);

    vi.mocked(verifyInviteToken).mockReturnValue(PAYLOAD as any);
    vi.mocked(aplicarConvite).mockResolvedValue({ ok: true, membershipId: "m1", mudou: true });

    const { GET } = await import("./route");
    const res = await GET(requisicao("code=oauth_code_123&invite=token_convite"));

    expect(vi.mocked(verifyInviteToken)).toHaveBeenCalledWith("token_convite");
    expect(vi.mocked(aplicarConvite)).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USUARIO.id, payload: PAYLOAD }),
    );
    expect(destino(res)).toBe("/app");
  });

  it("com convite pendente no banco para o e-mail: vincula automaticamente sem token na URL", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn(async () => ({ data: { user: USUARIO }, error: null })),
      },
    } as any);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((tabela: string) => {
        if (tabela === "team_invites") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(async () => ({
              data: {
                id: PAYLOAD.invite_id,
                organization_id: PAYLOAD.organization_id,
                role: PAYLOAD.role,
                interface_settings: { preset: "simplificada" },
                invited_by: null,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 86400000).toISOString(),
              },
            })),
          };
        }
        return {} as any;
      }),
    } as any);

    vi.mocked(aplicarConvite).mockResolvedValue({ ok: true, membershipId: "m1", mudou: true });

    const { GET } = await import("./route");
    const res = await GET(requisicao("code=oauth_code_456"));

    expect(vi.mocked(aplicarConvite)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USUARIO.id,
        payload: expect.objectContaining({
          invite_id: PAYLOAD.invite_id,
          organization_id: PAYLOAD.organization_id,
          email: USUARIO.email,
          role: PAYLOAD.role,
        }),
      }),
    );
    expect(destino(res)).toBe("/app");
  });
});
