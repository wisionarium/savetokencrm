"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useTransition } from "react";

import { BotaoInstalarApp } from "@/components/shell/BotaoInstalarApp";
import { SearchTrigger } from "@/components/shell/SearchTrigger";
import { SeletorDeIdioma } from "@/components/shell/SeletorDeIdioma";
import { TenantSwitcher } from "@/components/shell/TenantSwitcher";
import { VersionFooter } from "@/components/shell/VersionFooter";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { rotuloDaAba } from "@/lib/navigation/mobile";
import { sidebarGroups } from "@/lib/navigation/registry";
import { CaretRight, Gear, MagnifyingGlass, SignOut, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { SupportBotButton } from "@/components/support/SupportBotWidget";

/**
 * O CONTEÚDO DA TELA "MAIS".
 *
 * Três blocos, na ordem em que a pessoa resolve o dia: quem ela é (conta e
 * organização), o que muda a aparência (busca, idioma, tema), e por onde se
 * chega ao resto do produto (o MESMO `sidebarGroups` do desktop — nenhuma
 * segunda lista de navegação).
 *
 * A barra de baixo continua visível: "Mais" é uma aba, não um modal. O X leva
 * de volta à home; o botão de voltar do navegador faz o mesmo.
 */
function iniciais(nome: string | null, email: string): string {
  if (nome && nome.trim()) {
    return nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join("")
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function TelaMais() {
  const t = useT();
  const pathname = usePathname();
  const { user, activeOrg, signOut } = useAuth();
  const [saindo, startTransition] = useTransition();

  const platform = user.is_platform_admin && !user.support;
  const grupos = useMemo(
    () =>
      sidebarGroups(platform, activeOrg?.role ?? null, activeOrg?.interface_settings).filter(
        ({ items, group }) => items.length > 0 || group.hub,
      ),
    [platform, activeOrg?.role, activeOrg?.interface_settings],
  );

  function ativo(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="sticky top-0 z-10 -mx-3 flex items-center gap-1 border-b border-border bg-background/95 px-2 py-2 backdrop-blur">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0">
          <Link href="/app/inbox" aria-label={t("Fechar")}>
            <X size={20} aria-hidden />
          </Link>
        </Button>
        <h1 className="text-base font-semibold tracking-tight">{t("Mais")}</h1>
      </header>

      <div className="space-y-6 py-4">
        <section aria-labelledby="mais-conta" className="space-y-2">
          <h2
            id="mais-conta"
            className="px-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
          >
            {t("Conta")}
          </h2>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <Avatar className="h-11 w-11 shrink-0">
              {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
              <AvatarFallback>{iniciais(user.full_name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.full_name ?? user.email}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              {activeOrg && (
                <p className="truncate text-xs text-muted-foreground">{activeOrg.name}</p>
              )}
            </div>
            <TenantSwitcher />
          </div>
        </section>

        <section aria-labelledby="mais-preferencias" className="space-y-2">
          <h2
            id="mais-preferencias"
            className="px-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
          >
            {t("Preferências")}
          </h2>
          <ul className="overflow-hidden rounded-xl border border-border bg-card">
            <li className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <MagnifyingGlass size={18} className="shrink-0" aria-hidden />
                <span className="truncate">{t("Buscar")}</span>
              </span>
              <SearchTrigger />
            </li>
            <li className="flex items-center justify-between gap-3 border-t border-border px-3 py-1.5">
              <span className="text-sm">{t("Idioma")}</span>
              <SeletorDeIdioma />
            </li>
            <li className="flex items-center justify-between gap-3 border-t border-border px-3 py-1.5">
              <span className="text-sm">{t("Tema")}</span>
              <ThemeToggle />
            </li>
          </ul>
          <BotaoInstalarApp />
        </section>

        <section aria-labelledby="mais-navegacao" className="space-y-3">
          <h2
            id="mais-navegacao"
            className="px-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
          >
            {t("Navegação")}
          </h2>
          {/*
            `aria-label` é o mesmo do sidebar de desktop: os testes e quem usa
            leitor de tela reconhecem esta lista como a navegação principal,
            mesmo com a barra lateral fora da árvore abaixo de `md`.
          */}
          <nav aria-label={t("Navegação principal")} className="space-y-4">
            {grupos.map(({ group, items }) => (
              <div key={group.id} className="space-y-1">
                <h3 className="px-1 text-[11px] font-medium tracking-wider text-text-subtle uppercase">
                  {t(group.label)}
                </h3>
                <ul className="overflow-hidden rounded-xl border border-border bg-card">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const selecionado = ativo(item.href);
                    return (
                      <li key={item.href} className="border-b border-border last:border-b-0">
                        <Link
                          href={item.href}
                          aria-current={selecionado ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                            selecionado
                              ? "bg-accent-soft text-accent"
                              : "text-foreground hover:bg-accent/40",
                          )}
                        >
                          <Icon
                            size={19}
                            weight={selecionado ? "fill" : "regular"}
                            className="shrink-0"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate">{t(rotuloDaAba(item))}</span>
                          <CaretRight size={14} className="shrink-0 opacity-40" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                  {group.hub && (
                    <li className="border-t border-border">
                      <Link
                        href={group.hub.href}
                        aria-current={ativo(group.hub.href) ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                          ativo(group.hub.href)
                            ? "bg-accent-soft text-accent"
                            : "text-foreground hover:bg-accent/40",
                        )}
                      >
                        <Gear size={19} className="shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{t(group.hub.label)}</span>
                        <CaretRight size={14} className="shrink-0 opacity-40" aria-hidden />
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </nav>
        </section>

        <section aria-labelledby="mais-suporte" className="space-y-2">
          <h2
            id="mais-suporte"
            className="px-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
          >
            {t("Ajuda")}
          </h2>
          <SupportBotButton className="w-full justify-start py-5 text-sm" />
        </section>

        <section className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2 text-destructive"
            disabled={saindo}
            onClick={() => startTransition(async () => { await signOut(); })}
          >
            <SignOut size={18} aria-hidden />
            {t("Sair")}
          </Button>
          <VersionFooter collapsed={false} />
        </section>
      </div>
    </div>
  );
}
