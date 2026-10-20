"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { BotaoInstalarApp } from "@/components/shell/BotaoInstalarApp";
import { SidebarContent } from "@/components/shell/Sidebar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
 * ─── Por que "Mais" abre o sidebar inteiro ─────────────────────────────────
 *
 * Esconder o que não cabe na barra transformaria o rodapé num teto. "Mais" abre
 * a mesma `SidebarContent` da gaveta: nenhuma porta some, e o app instalável
 * continua tendo todas as telas a um toque.
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
  const [maisAberto, setMaisAberto] = useState(false);
  const orgId = activeOrg?.orgId ?? null;
  const platform = user.is_platform_admin && !user.support;

  const abas = useMemo(
    () => abasMoveis(activeOrg?.interface_settings, platform, activeOrg?.role ?? null),
    [activeOrg?.interface_settings, activeOrg?.role, platform],
  );

  // A contagem da Fila é o único número que este app sabe dizer sobre "tem
  // coisa esperando você". É a mesma visão que a aba Conversas abre por padrão
  // (`unassigned`) — por isso o badge fica honesto: o número é o que você vê
  // ao tocar. Não é "mensagens não lidas", e o rótulo acessível diz isso.
  const { data: contagens } = useConversationCounts(orgId);
  const naFila = contagens?.fila;

  function ativo(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
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
          <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={t("Mais opções")}
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
                  nenhumaAbaAtiva ? "text-accent" : "text-text-muted hover:text-foreground",
                )}
              >
                <DotsThree size={22} weight={nenhumaAbaAtiva ? "bold" : "regular"} aria-hidden />
                {t("Mais")}
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-0 p-0 sm:max-w-xs"
            >
              <SheetTitle className="sr-only">{t("Mais")}</SheetTitle>
              <BotaoInstalarApp />
              <SidebarContent
                collapsed={false}
                showCollapseControl={false}
                onNavigate={() => setMaisAberto(false)}
              />
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
