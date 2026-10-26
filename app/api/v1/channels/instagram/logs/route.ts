/**
 * GET|POST|DELETE /api/v1/channels/instagram/logs
 *
 * Visualização e gestão dos logs de integração e diagnóstico do Instagram / Meta.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { appendInstagramLog, type InstagramLogEntry } from "@/lib/channels/instagram/logs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "instagram_logs" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const supabase = await createClient();
  const { data: orgData, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .single();

  if (error) return fail("database_error", error.message, 500, { requestId });

  const settings = (orgData?.settings as Record<string, unknown>) || {};
  const logs = (settings.instagram_logs as InstagramLogEntry[]) || [];
  const connection = (settings.instagram_connection as Record<string, unknown>) || null;
  const automations = (settings.instagram_automations as Array<{ id: string; is_active: boolean }>) || [];

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  const webhookUrl = `${origin}/api/v1/webhooks/instagram`;
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || "tecla_crm_insta_webhook_2026";
  const appId = process.env.META_APP_ID || "1454524740075812";

  const diagnostics = {
    connected: Boolean(connection?.page_access_token && connection?.instagram_business_id),
    hasPageId: Boolean(connection?.page_id),
    hasPageToken: Boolean(connection?.page_access_token),
    hasInstagramBusinessId: Boolean(connection?.instagram_business_id),
    username: connection?.instagram_username || null,
    pageName: connection?.page_name || null,
    connectedAt: connection?.connected_at || null,
    activeAutomationsCount: automations.filter((a) => a.is_active).length,
    webhookUrl,
    verifyToken,
    appId,
    callbackUrl: `${origin}/api/v1/channels/instagram/callback`,
  };

  return ok({ logs, diagnostics }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "instagram_logs" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const body = (await req.json().catch(() => ({}))) as { action?: string };

  if (body.action === "test_ping") {
    await appendInstagramLog(activeOrg.orgId, {
      level: "success",
      category: "diagnostic",
      title: "Teste manual de diagnóstico executado com sucesso",
      details: "O sistema de logs e persistência da organização está 100% operacional.",
    });
  }

  const supabase = await createClient();
  const { data: orgData } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .single();

  const settings = (orgData?.settings as Record<string, unknown>) || {};
  const logs = (settings.instagram_logs as InstagramLogEntry[]) || [];

  return ok({ ok: true, logs }, { requestId });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "instagram_logs" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const supabase = await createClient();
  const { data: orgData } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .single();

  const settings = (orgData?.settings as Record<string, unknown>) || {};
  await supabase
    .from("organizations")
    .update({
      settings: {
        ...settings,
        instagram_logs: [],
      },
    })
    .eq("id", activeOrg.orgId);

  return ok({ cleared: true, logs: [] }, { requestId });
}
