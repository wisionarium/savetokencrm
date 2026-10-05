/**
 * De ONDE a tela busca as definiÃ§Ãµes aprovadas de uma conversa.
 *
 * â”€â”€â”€ Por que isto nÃ£o Ã© um `if` na tela â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * HÃ¡ duas rotas: a do canal oficial (`/channels/templates`, que resolve a
 * conexÃ£o pela sessÃ£o da Meta) e a do canal intermediado
 * (`/channels/partner/templates`, que resolve pela conexÃ£o de parceiro).
 * Perguntar "qual delas?" com o nome do provider na mÃ£o Ã© o `if (provider ===
 * ...)` que o invariante 1 da doutrina proÃ­be â€” e que o `lint:channels` reprova.
 *
 * A tela recebe um rÃ³tulo NEUTRO e monta a URL com ele. Um canal novo entra
 * aqui, e nenhuma linha muda do lado de lÃ¡.
 *
 * â”€â”€â”€ Por que nÃ£o basta juntar as duas listas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * Porque a definiÃ§Ã£o Ã© aprovada POR CONTA. Oferecer no seletor de uma conversa
 * um modelo que existe sÃ³ na outra conta produz um envio que a plataforma
 * recusa â€” e o operador, que escolheu de uma lista que o CRM lhe ofereceu,
 * conclui que o sistema estÃ¡ quebrado. Melhor mostrar menos e certo.
 */
import type { ProviderDeMensagem } from "./types";

export type FonteDeTemplates = "oficial" | "parceiro";

/**
 * Qual rota serve as definiÃ§Ãµes de cada canal.
 *
 * MAPA EXPLÃCITO, e nÃ£o derivado de uma capability. A primeira versÃ£o usava
 * `canManageTemplates` como discriminante e estava errada: o canal oficial
 * TAMBÃ‰M gerencia definiÃ§Ãµes pela API, entÃ£o os dois respondiam `true` e todo
 * canal caÃ­a na mesma rota. Capability descreve o que o CANAL faz; isto aqui Ã©
 * uma decisÃ£o da NOSSA arquitetura de rotas, e as duas nÃ£o coincidem por sorte.
 *
 * `Record<ProviderDeMensagem, â€¦>` de propÃ³sito: um canal DE MENSAGEM novo nÃ£o
 * compila atÃ©
 * alguÃ©m decidir de onde vÃªm as definiÃ§Ãµes dele. Esquecer essa decisÃ£o devolve
 * lista vazia em silÃªncio â€” que foi exatamente o defeito de origem.
 */
const FONTE: Record<ProviderDeMensagem, FonteDeTemplates | null> = {
  // Legado `waha` removido: sem entrada cai em null via `?? null`.
  meta_cloud: "oficial",
  // Canal novo sem entrada aqui tambem cai em null (fail-closed na tela).
  zernio: "parceiro",
};

/** `null` quando este canal nÃ£o trabalha com definiÃ§Ãµes aprovadas. */
export function fonteDeTemplates(provider: string | null | undefined): FonteDeTemplates | null {
  if (!provider) return null;
  return FONTE[provider as ProviderDeMensagem] ?? null;
}

/** A rota que serve as definiÃ§Ãµes desta fonte. */
export function rotaDeTemplates(fonte: FonteDeTemplates): string {
  return fonte === "parceiro"
    ? "/api/v1/channels/partner/templates"
    : "/api/v1/channels/templates";
}
