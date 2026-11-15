/**
 * GET /api/v1/ai/followups/logs — Histórico e logs de execução dos fluxos de automação.
 * Lista as execuções recentes com dados do contato, fluxo acionado, palavra-chave e timeline de passos.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "followup_enrollments" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number.parseInt(limitParam ?? "50", 10) || 50, 1), 100);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("followup_enrollments")
    .select(`
      id,
      pointer_id,
      contact_id,
      conversation_id,
      status,
      current_node_id,
      outcome,
      cancel_reason,
      attempts,
      last_error,
      started_at,
      updated_at,
      completed_at,
      pointer:followup_flow_pointers(id, name, trigger_config),
      contact:contacts(id, name, phone_number),
      events:followup_enrollment_events(id, event_type, node_id, payload, created_at)
    `)
    .eq("organization_id", activeOrg.orgId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    return fail("internal_error", error.message, 500, { requestId });
  }

  return ok(data ?? [], { requestId });
}
