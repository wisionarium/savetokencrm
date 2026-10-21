"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { useConversationCounts } from "@/hooks/inbox/useConversationCounts";
import { abasMoveis, rotuloDaAba } from "@/lib/navigation/mobile";
import { DotsThree } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * A BARRA DE BAIXO DO CELULAR — o desenho do mensageiro, com o nosso tema.
 *
 * ─── O que ela é, e o que não é ─────────────────────────────────────────────
 *
 * Não é uma segunda navegação: as abas vêm de `abasMoveis`, e `abasMoveis` é
 * `sidebarGroups` — o MENU do produto (catálogo ∩ RBAC ∩ interface por vínculo ∩
 * curadoria do menu). O que muda no telefone é ONDE elas moram: o polegar
 * alcança o rodapé, não a gaveta. Destino que sai do menu sai das duas.
 *
 * ─── Por que "Mais" é uma TELA, e não uma gaveta ────────────────────────────
 *
 * O topo fixo do celular acabou: no lugar dele, a home abre com a marca e o
 * filtro. Tudo o que vivia lá — busca, idioma, tema, conta, organização — e o
 * menu inteiro passam a morar em `/app/mais`, uma tela cheia de configurações.
 * Gaveta lateral esconde o conteúdo atrás de um gesto e não dá endereço; a
 * tela tem URL, botão de voltar e o mesmo espaço de leitura do resto do app.
 *
 * ─── Só abaixo de `md` ─────────────────────────────────────────────────────
 *
 * `md:hidden`: a partir de 768px CSS a casca é a de sempre (sidebar + painel).
 * Desktop intocado é requisito, não preferência.
 */
export function MobileTabBar() {
  const t = useT();
  const pathname = usePathname();
  const { user, activeOrg } = useAuth();
  const orgId = activeOrg?.orgId ?? null;
  const platform = user.is_platform_admin && !user.support;

  const abas = useMemo(
    () => abasMoveis(activeOrg?.interface_settings, platform, activeOrg?.role ?? null),
    [activeOrg?.interface_settings, activeOrg?.role, platform],
  );

  // A contagem da Fila é o único número que este app sabe dizer sobre "tem
  // coisa esperando você". É a mesma visão que a aba Mensagens abre por padrão
  // (`unassigned`) — por isso o badge fica honesto: o número é o que você vê
  // ao tocar. Não é "mensagens não lidas", e o rótulo acessível diz isso.
  const { data: contagens } = useConversationCounts(orgId);
  const naFila = contagens?.fila;

  function ativo(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  const maisAtivo = ativo("/app/mais");
  // Fora de qualquer aba (Configurações, Perfil, Conexões…), "Mais" acende:
  // é de lá que se chega a tudo o que não coube no polegar.
  const nenhumaAbaAtiva = !abas.some((a) => ativo(a.href));

  return (
    <nav
      data-barra-movel=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label={t("Navegação rápida")}
    >
      <ul className="flex h-14 items-stretch">
        {abas.map((aba) => {
          const Icon = aba.icon;
          const selecionada = ativo(aba.href);
          return (
            <li key={aba.href} className="flex-1">
              <Link
                href={aba.href}
                aria-current={selecionada ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
                  selecionada ? "text-accent" : "text-text-muted hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon size={22} weight={selecionada ? "fill" : "regular"} aria-hidden />
                  {aba.href === "/app/inbox" && typeof naFila === "number" && naFila > 0 && (
                    <span
                      className="absolute -right-2 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium tabular-nums text-accent-foreground"
                      aria-label={`${naFila} ${t("na fila")}`}
                    >
                      {naFila > 99 ? "99+" : naFila}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-1">{t(rotuloDaAba(aba))}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <Link
            href="/app/mais"
            aria-current={maisAtivo ? "page" : undefined}
            className={cn(
              "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
              maisAtivo || nenhumaAbaAtiva
                ? "text-accent"
                : "text-text-muted hover:text-foreground",
            )}
          >
            <DotsThree
              size={22}
              weight={maisAtivo || nenhumaAbaAtiva ? "bold" : "regular"}
              aria-hidden
            />
            {t("Mais")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
