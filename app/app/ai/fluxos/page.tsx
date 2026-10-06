import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import type { FollowupFlowPointerRow } from "@/hooks/followup/useFollowupFlows";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlowsList } from "../followups/_components/FlowsList";
import { RulesTab } from "../../webhooks/_components/RulesTab";

export const dynamic = "force-dynamic";

const FLOW_COLUMNS = "id, name, status, active_version_id, handoff_policy, inbox_enabled, draft_graph, updated_at";

/**
 * Os 3 fluxos num lugar só, FORA de Agentes (decisão do dono, 2026-10-06):
 * follow-up, disparo e automação. As rotas antigas (/app/ai/followups,
 * /app/webhooks) seguem existindo como rotas internas — a porta navegável é
 * esta página (ver `sidebar: true` em lib/navigation/catalogo.ts).
 */
export default async function FluxosPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("followup_flow_pointers")
    .select(FLOW_COLUMNS)
    .eq("organization_id", activeOrg.orgId)
    .order("updated_at", { ascending: false });

  const flows = (data ?? []) as unknown as FollowupFlowPointerRow[];
  const canWrite = ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Fluxos")}</h1>
          <p className="text-sm text-text-muted">
            {t("Follow-up, disparo e automação num lugar só — fora da configuração dos agentes.")}
          </p>
        </div>
      </header>
      <Tabs defaultValue="followup" className="flex flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="followup">{t("Fluxo de follow-up")}</TabsTrigger>
          <TabsTrigger value="disparo">{t("Fluxos de disparo")}</TabsTrigger>
          <TabsTrigger value="automacao">{t("Fluxo de automação")}</TabsTrigger>
        </TabsList>
        <TabsContent value="followup">
          <FlowsList initialData={flows} canWrite={canWrite} filterMode="ai" />
        </TabsContent>
        <TabsContent value="disparo">
          <FlowsList initialData={flows} canWrite={canWrite} filterMode="disparo" />
        </TabsContent>
        <TabsContent value="automacao">
          <RulesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
