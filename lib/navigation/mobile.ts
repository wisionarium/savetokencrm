import type { Role } from "@/lib/auth/types";

import { lerInterface } from "./interface";
import { NAV_DESTINATIONS, sidebarGroups, type NavDestination } from "./registry";

/**
 * AS ABAS FIXAS DO CELULAR — projeção do MESMO menu, não uma segunda lista.
 *
 * ─── Por que existe ────────────────────────────────────────────────────────
 *
 * No telefone a casca troca o menu lateral por uma barra fixa no rodapé, no
 * desenho do mensageiro: poucos alvos, sempre à mão, sem abrir gaveta. A barra
 * NÃO decide o que existe — ela escolhe quais destinos do MENU merecem o
 * polegar. Quem não está nela continua no "Mais" (o menu inteiro) e no ⌘K.
 *
 * ─── Por que ela passa por `sidebarGroups`, e não pelo catálogo cru ─────────
 *
 * Porque "o menu" É `sidebarGroups`: papel (RBAC) ∩ apresentação por vínculo ∩
 * a curadoria do próprio menu — o campo `sidebar` do catálogo. Olhar só o
 * catálogo deixa a barra divergir do desktop em silêncio, e isso não é
 * hipótese: no commit 5ceeec40 o dono tirou `/app/kanban` ("Funis") do menu, e
 * uma barra que ignorasse esse campo traria de volta, no celular, exatamente a
 * porta que ele acabou de esconder — a mesma tela com dois comportamentos,
 * dependendo do tamanho da janela.
 *
 * Reusar a projeção do sidebar é o que faz as duas superfícies concordarem POR
 * CONSTRUÇÃO: curadoria nova no catálogo chega às duas sem uma segunda lista
 * para alguém manter em sincronia.
 *
 * ─── Por que `/app/tasks` e não `/app/agenda` ───────────────────────────────
 *
 * A Agenda virou ABA de Tarefas (`/app/tasks/agenda`, migration de navegação
 * anterior) e `/app/agenda` é só redirect. Pôr a Agenda como alvo próprio
 * criaria um segundo endereço para a mesma tela e uma rota que o registro de
 * navegação não conhece (`tests/unit/navegacao-completude.test.ts`).
 *
 * A ordem é a do desenho aprovado (imagem 4): pessoas → o que ficou
 * combinado → conversa → catálogo. "Mais" fecha a barra, mas NÃO entra aqui:
 * ele não é destino do catálogo (é a tela que abre o menu inteiro) e a
 * catraca de `navegacao-completude` cobraria uma porta que não existe.
 */
export const ABAS_MOVEIS = ["/app/contacts", "/app/tasks", "/app/inbox", "/app/products"] as const;

/**
 * O rótulo da barra pode divergir do catálogo de propósito — e só aqui.
 *
 * "Inbox" é palavra de quem construiu o sistema; no telefone, onde a barra é a
 * única navegação visível, a mesma tela se chama "Mensagens". O catálogo
 * continua sendo a fonte: isto é a projeção, não uma segunda verdade.
 */
const ROTULO_NA_BARRA: Record<string, string> = {
  "/app/inbox": "Mensagens",
};

export function rotuloDaAba(destino: Pick<NavDestination, "href" | "label">): string {
  return ROTULO_NA_BARRA[destino.href] ?? destino.label;
}

/**
 * As abas visíveis para ESTE vínculo, na ordem de `ABAS_MOVEIS`.
 *
 * Passa por `sidebarGroups` — a MESMA projeção que alimenta o menu lateral:
 * papel (RBAC) ∩ apresentação por vínculo ∩ curadoria do menu. Um `viewer` sem
 * o destino configurado não vê a aba; destino que saiu do menu também não. A
 * barra nunca oferece uma porta que a rota vai fechar em /403.
 */
export function abasMoveis(
  raw: unknown,
  platform: boolean,
  role: Role | null,
): NavDestination[] {
  const { settings } = lerInterface(raw);
  const noMenu = new Set(
    sidebarGroups(platform, role, settings).flatMap((grupo) => grupo.items.map((d) => d.href)),
  );
  return ABAS_MOVEIS.map((href) => NAV_DESTINATIONS.find((d) => d.href === href)).filter(
    (d): d is NavDestination => d !== undefined && noMenu.has(d.href),
  );
}
