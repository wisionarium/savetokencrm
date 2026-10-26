/**
 * GET|POST|PATCH|DELETE /api/v1/automacoes/instagram
 *
 * Gerencia as automações de comentários e DMs do Instagram da organização.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export interface InstagramAutomationRule {
  id: string;
  name: string;
  target_type: "all_posts" | "specific_post";
  post_id?: string | null;
  post_thumbnail?: string | null;
  post_caption?: string | null;
  keywords: string[];
  reply_comment_text: string;
  dm_message_text: string;
  flow_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function GET(_req?: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "instagram_automations" });
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
  const automations = (settings.instagram_automations as InstagramAutomationRule[]) || [];
  const connection = (settings.instagram_connection as Record<string, unknown>) || null;

  return ok({ automations, connection }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "instagram_automations" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const body = (await req.json().catch(() => ({}))) as Partial<InstagramAutomationRule>;

  if (!body.name || !body.reply_comment_text || !body.dm_message_text) {
    return fail("validation_failed", "Nome, resposta pública e mensagem DM são obrigatórios.", 422, {
      requestId,
    });
  }

  const supabase = await createClient();
  const { data: orgData, error: fetchErr } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .single();

  if (fetchErr) return fail("database_error", fetchErr.message, 500, { requestId });

  const settings = (orgData?.settings as Record<string, unknown>) || {};
  const currentList = (settings.instagram_automations as InstagramAutomationRule[]) || [];

  const now = new Date().toISOString();
  let updatedList: InstagramAutomationRule[];

  if (body.id) {
    // Edição
    updatedList = currentList.map((item) =>
      item.id === body.id
        ? {
            ...item,
            name: body.name!,
            target_type: body.target_type ?? item.target_type,
            post_id: body.post_id ?? null,
            post_thumbnail: body.post_thumbnail ?? null,
            post_caption: body.post_caption ?? null,
            keywords: body.keywords ?? item.keywords,
            reply_comment_text: body.reply_comment_text!,
            dm_message_text: body.dm_message_text!,
            flow_id: body.flow_id ?? null,
            is_active: body.is_active ?? item.is_active,
            updated_at: now,
          }
        : item,
    );
  } else {
    // Nova
    const newRule: InstagramAutomationRule = {
      id: `rule_${randomUUID().slice(0, 8)}`,
      name: body.name,
      target_type: body.target_type || "all_posts",
      post_id: body.post_id ?? null,
      post_thumbnail: body.post_thumbnail ?? null,
      post_caption: body.post_caption ?? null,
      keywords: body.keywords || [],
      reply_comment_text: body.reply_comment_text,
      dm_message_text: body.dm_message_text,
      flow_id: body.flow_id ?? null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    updatedList = [newRule, ...currentList];
  }

  const { error: saveErr } = await supabase
    .from("organizations")
    .update({
      settings: {
        ...settings,
        instagram_automations: updatedList,
      },
    })
    .eq("id", activeOrg.orgId);

  if (saveErr) return fail("database_error", saveErr.message, 500, { requestId });

  return ok({ automations: updatedList }, { requestId });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "instagram_automations" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const { id, is_active } = (await req.json().catch(() => ({}))) as {
    id?: string;
    is_active?: boolean;
  };

  if (!id || typeof is_active !== "boolean") {
    return fail("validation_failed", "ID e is_active são obrigatórios.", 422, { requestId });
  }

  const supabase = await createClient();
  const { data: orgData, error: fetchErr } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .single();

  if (fetchErr) return fail("database_error", fetchErr.message, 500, { requestId });

  const settings = (orgData?.settings as Record<string, unknown>) || {};
  const currentList = (settings.instagram_automations as InstagramAutomationRule[]) || [];

  const updatedList = currentList.map((item) =>
    item.id === id ? { ...item, is_active, updated_at: new Date().toISOString() } : item,
  );

  await supabase
    .from("organizations")
    .update({
      settings: {
        ...settings,
        instagram_automations: updatedList,
      },
    })
    .eq("id", activeOrg.orgId);

  return ok({ automations: updatedList }, { requestId });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "instagram_automations" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return fail("validation_failed", "ID é obrigatório na query string.", 422, { requestId });
  }

  const supabase = await createClient();
  const { data: orgData, error: fetchErr } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .single();

  if (fetchErr) return fail("database_error", fetchErr.message, 500, { requestId });

  const settings = (orgData?.settings as Record<string, unknown>) || {};
  const currentList = (settings.instagram_automations as InstagramAutomationRule[]) || [];

  const updatedList = currentList.filter((item) => item.id !== id);

  await supabase
    .from("organizations")
    .update({
      settings: {
        ...settings,
        instagram_automations: updatedList,
      },
    })
    .eq("id", activeOrg.orgId);

  return ok({ automations: updatedList }, { requestId });
}
