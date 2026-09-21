import { requireSupportWrite } from "@/lib/impersonate/support";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;
  if (!UUID_RX.test(id)) {
    return fail("invalid_request", "id inválido.", 400, { requestId });
  }

  const authz = await requireRole("manager", { requestId, resource: "followup_flows" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user, org: activeOrg } = authz;

  const supabase = await createClient();

  const { data: source, error: fetchErr } = await supabase
    .from("followup_flow_pointers")
    .select("id, name, draft_graph, trigger_config, handoff_policy, inbox_enabled")
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();

  if (fetchErr) return fail("internal_error", fetchErr.message, 500, { requestId });
  if (!source) return fail("not_found", t("Fluxo não encontrado."), 404, { requestId });

  const newName = `Cópia de ${source.name}`.slice(0, 80);

  const { data: created, error: createErr } = await supabase
    .from("followup_flow_pointers")
    .insert({
      organization_id: activeOrg.orgId,
      name: newName,
      status: "draft",
      draft_graph: source.draft_graph,
      trigger_config: source.trigger_config,
      handoff_policy: source.handoff_policy,
      inbox_enabled: source.inbox_enabled ?? false,
    })
    .select("id, name, status, draft_graph, trigger_config, handoff_policy, inbox_enabled, created_at, updated_at")
    .single();

  if (createErr || !created) {
    if (createErr?.code === "23505") {
      // Append random suffix if name collisions
      const suffixName = `Cópia de ${source.name} (${Math.floor(Math.random() * 1000)})`.slice(0, 80);
      const { data: createdRetry, error: retryErr } = await supabase
        .from("followup_flow_pointers")
        .insert({
          organization_id: activeOrg.orgId,
          name: suffixName,
          status: "draft",
          draft_graph: source.draft_graph,
          trigger_config: source.trigger_config,
          handoff_policy: source.handoff_policy,
          inbox_enabled: source.inbox_enabled ?? false,
        })
        .select("id, name, status, draft_graph, trigger_config, handoff_policy, inbox_enabled, created_at, updated_at")
        .single();

      if (retryErr || !createdRetry) {
        return fail("internal_error", retryErr?.message ?? "duplicate_failed", 500, { requestId });
      }

      void audit({
        action: "followup_flow.created",
        actorUserId: user.id,
        organizationId: activeOrg.orgId,
        resourceType: "followup_flow_pointer",
        resourceId: createdRetry.id,
        requestId,
        metadata: { duplicated_from: id },
      });

      return ok(createdRetry, { requestId });
    }
    return fail("internal_error", createErr?.message ?? "duplicate_failed", 500, { requestId });
  }

  void audit({
    action: "followup_flow.created",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "followup_flow_pointer",
    resourceId: created.id,
    requestId,
    metadata: { duplicated_from: id },
  });

  return ok(created, { requestId });
}
