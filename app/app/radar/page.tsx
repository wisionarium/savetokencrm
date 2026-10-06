import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import { RadarBoard, type FunilDoRadar } from "./_components/RadarBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Radar" };

export default async function RadarPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  // `t` local em vez do hook: esta página é componente de SERVIDOR, e lá o
  // idioma vem resolvido em `user.idioma` (a cadeia pessoa → organização →
  // padrão vive em `lib/auth/server.ts`), sem reler o `locale` cru.
  const idioma = user.idioma;
  const t = (texto: string) => traduzir(texto, idioma);

  // Os funis vêm do servidor (mesma consulta da lista de Funis): o quadro do
  // Radar é por funil, e o seletor precisa da lista antes do primeiro render.
  // RLS responde "pode ver?"; o `eq` abaixo responde "quer ver agora?" — o
  // mesmo par da página de Funis.
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_pipelines")
    .select("id, name, is_default")
    .eq("organization_id", activeOrg.orgId)
    .eq("is_archived", false)
    .order("position");

  const funis = ((data ?? []) as FunilDoRadar[]).filter((f) => f?.id && f?.name);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Radar de risco")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Os negócios em risco, no quadro do funil: arrastar move a etapa de verdade. Se o assistente já agendou um retorno, aparece como “em voo”; sem próximo passo, é risco de perder o cliente.",
          )}
        </p>
      </header>
      <RadarBoard funis={funis} />
    </div>
  );
}
