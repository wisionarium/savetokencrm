"use client";
import Link from "next/link";
import { useT } from "@/hooks/i18n/useT";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { CaretDoubleLeft, CaretDoubleRight, Gear } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { toggleSidebar } from "@/app/actions/shell/toggleSidebar";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { ConnectionHealthDot } from "@/components/connections/ConnectionHealthDot";
import { VersionFooter } from "@/components/shell/VersionFooter";
import { LogotipoDoProduto, SimboloDoProduto } from "@/components/branding/MarcaDoProduto";
import { logoDaMarca, marcaEhADoProduto } from "@/lib/branding";
import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import { GRUPO_NO_RODAPE, sidebarGroups } from "@/lib/navigation/registry";

interface SidebarContentProps {
  collapsed: boolean;
  showCollapseControl?: boolean;
  onNavigate?: () => void;
}

/**
 * Navegação principal, agrupada por objetivo.
 *
 * Não decide nada: `sidebarGroups()` (lib/navigation/registry.ts) resolve quais
 * grupos e destinos este papel vê, e este componente desenha. Antes, a lista de
 * itens e sete `usePermission()` viviam aqui — e divergiam do hub de
 * Configurações e das abas de IA, que mantinham suas próprias listas.
 */
export function SidebarContent({
  collapsed,
  showCollapseControl = true,
  onNavigate,
}: SidebarContentProps) {
  // A barra lateral aparece em TODA tela — traduzi-la aqui é o que faz a
  // escolha de idioma virar algo visível no primeiro clique.
  const t = useT();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const { user, activeOrg } = useAuth();
  const todos = useMemo(
    () =>
      sidebarGroups(
        user.is_platform_admin && !user.support,
        activeOrg?.role ?? null,
        activeOrg?.interface_settings,
      ),
    [user.is_platform_admin, user.support, activeOrg?.role, activeOrg?.interface_settings],
  );
  // Configurações sai da área que rola e vai para o rodapé fixo: medido em
  // 1280x768, ele caía fora da dobra mesmo em telas de 1080px.
  const grupos = useMemo(() => todos.filter((g) => g.group.id !== GRUPO_NO_RODAPE), [todos]);
  const rodape = todos.find((g) => g.group.id === GRUPO_NO_RODAPE)?.group.hub;

  /**
   * Lista plana de todos os itens do sidebar — sem cabeçalhos de grupo, sem
   * colapsar. Com poucos itens, a bandeja toda cabe sem rolar e cada destino
   * está a um clique de distância.
   */
  const itensPlanos = useMemo(
    () => grupos.flatMap(({ items }) => items),
    [grupos],
  );

  const brand = useMarcaDaInstalacao();
  /**
   * O CONSUMIDOR do nome por organização.
   *
   * Sem ele, `settings.branding.app_name` seria campo decorativo: medido, o nome
   * da org não aparece em lugar nenhum da casca para o cliente típico de um
   * revendedor — o único leitor é o `TenantSwitcher`, e ele devolve `null` com
   * uma organização só.
   *
   * A marca da INSTALAÇÃO continua embaixo: a organização que não definiu nome
   * vê exatamente o que via antes. O que mudou é POR ONDE ela chega — era
   * `branding()`, que no navegador lê `window.__PUBLIC_ENV__` e no servidor lê
   * `process.env`, e essas duas fontes passaram a divergir quando o layout raiz
   * começou a injetar a marca do BANCO. Divergência entre SSR e cliente aqui não
   * é detalhe: com logo no banco e `APP_LOGO_URL` vazio, o servidor desenhava o
   * `<span>` de baixo e o cliente desenhava o `<img>` — React #418 em toda tela.
   * Hoje a marca vem por PROP do servidor (`useMarcaDaInstalacao`), pela mesma
   * rota de `activeOrg`, e os dois lados leem o mesmo objeto por construção.
   */
  const nome = activeOrg?.marca?.nome ?? brand.name;
  /**
   * O mesmo desenho para o LOGO — e é este par de linhas que fecha o caminho do
   * `logo_url` gravado até a tela.
   *
   * `||` e não `??`: vazio é AUSÊNCIA de logo, não "logo em branco". É a regra
   * que `resolveBranding` e `primeiroDefinido` já aplicam nas camadas de baixo, e
   * com `??` um `""` vindo de cima apagaria o logo do revendedor em vez de
   * descer para ele — que é o contrário do que a precedência por campo promete.
   */
  const logo = logoDaMarca(nome, activeOrg?.marca?.logoUrl || brand.logoUrl);
  // Só quando NINGUÉM — nem a instalação, nem a organização — pôs marca própria:
  // é a condição de `lib/branding.ts`, avaliada sobre o que a barra vai mostrar.
  const marcaDoProduto = marcaEhADoProduto({ name: nome, logoUrl: logo });

  return (
    <>
      <div
        className={cn(
          "flex h-14 items-center gap-2 border-b px-4",
          collapsed ? "justify-center" : "justify-start",
        )}
      >
        {logo ? (
          // O PNG de quem hospeda é desenhado CRU — sem moldura: mostra o logo
          // como ele é, sobre o fundo da barra. Existia um chip branco no tema
          // escuro (`dark:bg-white`) para salvar arte escura contra
          // `--color-surface` (#1d1c17); ele saiu a pedido do dono — a moldura
          // aparecia como um bloco branco em volta do logo, inclusive no celular.
          // Arte escura agora precisa vir preparada para os dois temas.
          //
          // Recolhida, só a imagem (é o único desenho que cabe em 64px, e é o
          // que substitui a inicial em texto). Aberta, imagem + nome: o logo do
          // fork é um símbolo, não um logotipo que soletre a marca.
          <>
            {/* <img> em vez de next/image de propósito: a URL vem de quem hospeda
              (banco ou .env), e next/image exige allowlist de domínios fechada em
              build — a imagem pré-buildada rejeitaria o domínio do self-hoster.
              Altura fixa e largura livre porque a arte enviada tem proporção
              desconhecida; forçar as duas distorceria o logo de quem configurou.
              `alt` vazio quando o nome está ao lado: quem lê a tela ouve o nome
              uma vez só. Recolhida, a imagem É a marca e passa a nomeá-la. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt={collapsed ? nome : ""}
              className={cn(
                "shrink-0 object-contain",
                collapsed ? "h-8 w-8" : "h-7 w-auto max-w-[8rem]",
              )}
            />
            {!collapsed && (
              <span className="min-w-0 truncate font-semibold tracking-tight">{nome}</span>
            )}
          </>
        ) : marcaDoProduto ? (
          // O desenho do produto, inline (ver `components/branding/MarcaDoProduto.tsx`):
          // logotipo com a barra aberta, só o símbolo com ela recolhida.
          collapsed ? (
            <SimboloDoProduto nome={nome} className="h-8 w-8" />
          ) : (
            <LogotipoDoProduto nome={nome} className="h-8 w-auto" />
          )
        ) : (
          <>
            <span className={cn("font-semibold tracking-tight", collapsed && "sr-only")}>
              {nome}
            </span>
            {collapsed && (
              <span aria-hidden className="text-lg font-bold text-primary">
                {/* Spread e não `[0]`: nome começando com emoji ou acento composto
                    quebraria no meio do code point. Mesma regra de `resolveBranding`
                    — a inicial precisa acompanhar o nome que a barra mostra, senão
                    recolher o menu troca a marca. */}
                {[...nome][0]?.toUpperCase() ?? brand.initial}
              </span>
            )}
          </>
        )}
      </div>
      {/*
        Lista plana — todos os itens do sidebar expostos, sem cabeçalhos de
        grupo nem colapsar. Com poucos destinos, a bandeja cabe sem rolar e
        cada porta está a um clique de distância.
      */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label={t("Navegação principal")}>
        {/*
          RAIL (mock do dono): recolhido, UM ícone por grupo — o principal, e o
          clique NAVEGA direto para ele. Expandir no clique seria brigar com o
          hover transitório (que já abre o menu com o cursor em cima e o fecha
          ao sair): mirar clique fino num alvo que foge é o defeito que este
          desenho existe para não ter. O resto segue a um hover de distância,
          no ⌘K e por URL — nenhuma porta se perde, e o expandido abaixo fica
          idêntico ao de antes.
        */}
        {collapsed ? (
          <ul className="space-y-1">
            {itensPlanos.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={t(item.label)}
                    aria-label={t(item.label)}
                    aria-current={isActive ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex items-center justify-center rounded-md px-2 py-1 transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <Icon size={18} weight={isActive ? "fill" : "regular"} aria-hidden />
                    {item.healthDot && (
                      <ConnectionHealthDot className="absolute top-1.5 right-1.5" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="space-y-1">
            {itensPlanos.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-1 text-sm transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <Icon size={18} weight={isActive ? "fill" : "regular"} aria-hidden />
                    <span className="truncate">{t(item.label)}</span>
                    {item.healthDot && <ConnectionHealthDot className="ml-auto" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      <div className="border-t p-2">
        {rodape && (
          <Link
            href={rodape.href}
            title={collapsed ? t(rodape.label) : undefined}
            aria-current={pathname.startsWith(rodape.href) ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "mb-1 flex items-center gap-3 rounded-md px-3 py-1 text-sm transition-colors",
              pathname.startsWith(rodape.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            <Gear size={18} aria-hidden />
            {!collapsed && <span className="truncate">{t(rodape.label)}</span>}
          </Link>
        )}
        <VersionFooter collapsed={collapsed} onNavigate={onNavigate} />
        {showCollapseControl && (
          <button
            type="button"
            onClick={() => startTransition(() => toggleSidebar(collapsed))}
            disabled={isPending}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              collapsed && "justify-center px-2",
            )}
            aria-label={collapsed ? t("Expandir sidebar") : t("Recolher sidebar")}
          >
            {collapsed ? (
              <CaretDoubleRight size={14} aria-hidden />
            ) : (
              <CaretDoubleLeft size={14} aria-hidden />
            )}
            {!collapsed && <span>{t("Recolher")}</span>}
          </button>
        )}
      </div>
    </>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  /**
   * HOVER TRANSITÓRIO (novo visual): com a barra desafixada (`collapsed`), o
   * cursor em cima expande e fora recolhe. O estado persistido (`collapsed`,
   * cookie via `toggleSidebar`) NÃO muda — hover é visor, fixar é decisão.
   *
   * Guardas: sem hover em touch (`matchMedia("(hover: hover)")` — no celular a
   * barra nem existe, `hidden md:block` no `AppShell`); `focus-within` expande
   * para teclado; `Esc` recolhe; `prefers-reduced-motion` desliga a transição.
   */
  const [hoverExpand, setHoverExpand] = useState(false);
  const abrirTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fecharTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function limparTimers() {
    if (abrirTimer.current) clearTimeout(abrirTimer.current);
    if (fecharTimer.current) clearTimeout(fecharTimer.current);
    abrirTimer.current = null;
    fecharTimer.current = null;
  }
  function dispositivoComHover(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover)").matches
    );
  }
  function aoEntrarCursor() {
    if (!collapsed || !dispositivoComHover()) return;
    limparTimers();
    abrirTimer.current = setTimeout(() => setHoverExpand(true), 180);
  }
  function aoSairCursor() {
    limparTimers();
    if (!collapsed) return;
    fecharTimer.current = setTimeout(() => setHoverExpand(false), 300);
  }
  const visualmenteRecolhida = collapsed && !hoverExpand;
  return (
    <aside
      onMouseEnter={aoEntrarCursor}
      onMouseLeave={aoSairCursor}
      onFocus={() => {
        if (collapsed && dispositivoComHover()) {
          limparTimers();
          setHoverExpand(true);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          limparTimers();
          setHoverExpand(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          limparTimers();
          setHoverExpand(false);
        }
      }}
      className={cn(
        // ⚠️ `sticky`, e NUNCA `fixed`.
        //
        // Com `fixed` a barra sai do fluxo: ela não ocupa lugar nenhum na linha,
        // e quem afastava o conteúdo era um `md:ml-16`/`md:ml-60` do lado de lá.
        // Duas medidas para a mesma coisa, em componentes diferentes — e no dia
        // em que discordassem (largura de 60 com margem de 16), a barra passava
        // POR CIMA da lista de conversas, escondendo o começo de cada linha.
        //
        // Foi assim que apareceu numa instalação real: a barra expandida, com as
        // etiquetas legíveis, e a lista atrás dela cortada. Um F5 "consertava",
        // que é a assinatura de servidor e navegador terem pintado estados
        // diferentes — e `AppShell` e `Sidebar` são ambos `"use client"`.
        //
        // `sticky top-0 h-screen` dá o mesmo efeito visual (a barra não rola com
        // a página) e ela VOLTA a ocupar lugar: sobra para o conteúdo exatamente
        // o que ela não usou, e não há segunda medida para discordar.
        //
        // `shrink-0` porque item de flex encolhe por padrão, e uma barra de 60
        // espremida para caber é o mesmo defeito por outro caminho.
        "sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200 motion-reduce:transition-none",
        visualmenteRecolhida ? "w-16" : "w-60",
      )}
    >
      <SidebarContent collapsed={visualmenteRecolhida} />
    </aside>
  );
}
