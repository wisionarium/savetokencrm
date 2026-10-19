import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { type Role } from "@/lib/auth/types";
import {
  Bell,
  Buildings,
  CalendarBlank,
  ChartLineUp,
  ClockCountdown,
  ClockCounterClockwise,
  FileText,
  FlowArrow,
  Funnel,
  ImageSquare,
  Inbox,
  Kanban,
  Key,
  ListChecks,
  Lock,
  Megaphone,
  Palette,
  Plugs,
  PlugsConnected,
  PuzzlePiece,
  Receipt,
  ScalesSimple,
  ShieldCheck,
  Signpost,
  Storefront,
  Tag,
  UserCircle,
  Users,
  UsersThree,
  WebhooksLogo,
} from "@/lib/ui/icons";

import {
  NAV_CATALOG,
  NAV_GROUPS,
  type NavMetadata,
  type NavGroup,
  type NavGroupId,
} from "./catalogo";
import { destinosDaInterface, type InterfaceSettings } from "./interface";
export { NAV_GROUPS, GRUPO_NO_RODAPE } from "./catalogo";
export type { NavGroup, NavGroupId } from "./catalogo";
const ICONS = {
  Bell,
  Buildings,
  CalendarBlank,
  ChartLineUp,
  ClockCountdown,
  ClockCounterClockwise,
  FileText,
  FlowArrow,
  Funnel,
  ImageSquare,
  Inbox,
  Kanban,
  Key,
  ListChecks,
  Lock,
  Megaphone,
  Palette,
  Plugs,
  PlugsConnected,
  PuzzlePiece,
  Receipt,
  ScalesSimple,
  ShieldCheck,
  Signpost,
  Storefront,
  Tag,
  UserCircle,
  Users,
  UsersThree,
  WebhooksLogo,
};
export interface NavDestination extends Omit<NavMetadata, "icon"> {
  icon: PhosphorIcon;
}
export const NAV_DESTINATIONS: NavDestination[] = NAV_CATALOG.map((d) => ({
  ...d,
  icon: ICONS[d.icon],
}));
/**
 * Único ponto de decisão de permissão da navegação.
 *
 * É o que dispensa os sete `usePermission()` que o Sidebar chamava em sequência
 * — hooks não rodam em laço condicional, então cada permissão exigia sua linha.
 * Como função pura, um `.filter()` resolve todas.
 */
export { canSee } from "./interface";

/** Projeção do sidebar: só o uso diário, agrupado, sem grupo vazio. */
export function sidebarGroups(
  isPlatformAdmin: boolean,
  role: Role | null,
  settings?: InterfaceSettings,
): Array<{ group: NavGroup; items: NavDestination[] }> {
  const visible = new Set<string>(
    destinosDaInterface(settings, isPlatformAdmin, role).map((d) => d.href),
  );
  return NAV_GROUPS.map((group) => ({
    group,
    items: NAV_DESTINATIONS.filter(
      (d) => d.group === group.id && (d.sidebar || (!group.hub && !!settings?.destinos)) && visible.has(d.href),
    ),
  })).filter(
    (g) =>
      g.items.length > 0 ||
      (g.group.hub && NAV_DESTINATIONS.some((d) => d.group === g.group.id && visible.has(d.href))),
  );
}

/**
 * RAIL ENCOLHIDO (mock do dono): um ícone por grupo — o PRIMEIRO do catálogo.
 *
 * O catálogo já é ordenado por uso ("grupos por objetivo, na ordem de uso"),
 * então "o primeiro" É o principal (Inbox, Contatos, Respostas rápidas, Fluxos)
 * sem um segundo campo para manter em sincronia. Recebe os grupos já
 * projetados para o papel, então papel sem item visível no grupo some do rail
 * sozinho. Grupo sem item (só hub, como Organização) não tem principal e é
 * pulado — o Config do rodapé é outra peça e não entra aqui.
 */
export function principaisDoRail(
  grupos: Array<{ group: NavGroup; items: NavDestination[] }>,
): NavDestination[] {
  return grupos.flatMap(({ items }) => (items.length > 0 ? [items[0]!] : []));
}

/**
 * Projeção do hub: TODAS as telas do grupo — inclusive as que já estão no
 * sidebar. O hub é inventário, não sobra; é onde se descobre o que existe.
 *
 * A ordem das seções é a de primeira aparição no registro, então reordenar a
 * jornada é reordenar o array — não há uma segunda lista para manter em sincronia.
 */
export function hubSections(
  group: NavGroupId,
  isPlatformAdmin: boolean,
  role: Role | null,
  settings?: InterfaceSettings,
): Array<{ section: string; items: NavDestination[] }> {
  const porSecao = new Map<string, NavDestination[]>();
  const visible = new Set<string>(
    destinosDaInterface(settings, isPlatformAdmin, role).map((d) => d.href),
  );
  for (const d of NAV_DESTINATIONS) {
    if (d.group !== group || !visible.has(d.href)) continue;
    const secao = d.section ?? "";
    const atual = porSecao.get(secao);
    if (atual) atual.push(d);
    else porSecao.set(secao, [d]);
  }
  return [...porSecao.entries()].map(([section, items]) => ({ section, items }));
}

/** Projeção do ⌘K: todo destino visível, do sidebar ou não. */
export function searchable(
  isPlatformAdmin: boolean,
  role: Role | null,
  settings?: InterfaceSettings,
): NavDestination[] {
  const visible = new Set<string>(
    destinosDaInterface(settings, isPlatformAdmin, role).map((d) => d.href),
  );
  return NAV_DESTINATIONS.filter((d) => visible.has(d.href));
}
