import type { Metadata } from "next";
import { NavHub } from "@/components/shell/NavHub";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações" };

/**
 * Hub de Organização.
 *
 * A lista de cards que vivia aqui era uma segunda navegação escrita à mão, e
 * divergia do sidebar. Agora o conteúdo vem do registro, e o que sobra aqui é
 * o que de fato é organização e configuração sensível: sua conta, sua empresa
 * (Conexões, Provedores, Roteadores), e quem tem acesso ao quê — decisão do
 * dono em 2026-10-06. Funis e Audit Log continuam fora: são CRM e Análise.
 */
export default async function SettingsHubPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  const idioma = user.idioma;

  return (
    <NavHub
      group="organizacao"
      isPlatformAdmin={user.is_platform_admin && !user.support}
      role={activeOrg?.role ?? null}
      interfaceSettings={activeOrg?.interface_settings}
      title={traduzir("Configurações", idioma)}
      subtitle={traduzir("Sua conta, os dados da empresa e quem tem acesso ao quê.", idioma)}
      locale={idioma}
    />
  );
}
