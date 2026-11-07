import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", authz.org.orgId);

  if (error) {
    return fail("internal_error", t("Erro ao consultar contatos."), 500, { requestId });
  }

  const total = count ?? 0;
  const limit = 100_000;
  const percentage = Number(((total / limit) * 100).toFixed(1));
  const exceeded = total > limit;
  const overage = Math.max(0, total - limit);
  const overage_rate_cents = 5; // R$ 0,05 por contato excedente
  const overage_cost_cents = overage * overage_rate_cents;

  return ok(
    {
      total,
      limit,
      percentage,
      exceeded,
      overage,
      overage_rate_cents,
      overage_cost_cents,
    },
    { requestId },
  );
}

