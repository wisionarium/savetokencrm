import type { ConversationsFilters } from "@/hooks/inbox/useConversationsRealtime";
import { buscaValeConsulta } from "@/lib/inbox/termo-de-busca";
import type { LeituraDoFiltro } from "@/components/inbox/InboxFilters";

/**
 * Os refinamentos da barra do inbox — tudo que NÃO é a aba. A aba vem pronta
 * de `tabToFilter` (`daAba`); aqui ela se encontra com o que o operador ligou
 * por cima. Um `ConversationsFilters` SÓ sai daqui: duas montagens divergem
 * (foi assim que "Não lidos" virou ilha filtrada em memória, fora do contrato).
 */
export interface FiltrosAuxiliaresDaTela {
  search: string;
  leitura: LeituraDoFiltro;
  channel_session_id?: string;
  tag?: string;
  assigned_to?: string;
}

/**
 * Junta aba + auxiliares num filtro só, que é o que viaja na query.
 *
 * - O `assigned_to` do seletor VENCE o que a aba pediu: sem isso, escolher uma
 *   atendente com a aba Minhas aberta faria AND (`me` E `<uuid>`) — lista
 *   sempre vazia sem nada dizendo por quê. (Na prática a UI nem oferece o
 *   seletor nessas abas — `aoTrocarDeAba` larga o valor —, mas o contrato aqui
 *   é explícito em vez de depender da tela.)
 * - `unread=false` NÃO é "lidas": é ausência de filtro. O outro lado tem nome
 *   próprio (`read`), mesma regra do schema.
 */
export function montarFiltrosDaLista(
  daAba: Partial<ConversationsFilters>,
  aux: FiltrosAuxiliaresDaTela,
): ConversationsFilters {
  return {
    ...daAba,
    assigned_to: aux.assigned_to ?? daAba.assigned_to,
    // A tela NÃO pede o que a rota recusa: o hook trata falha com
    // `showApiError`, então digitar a primeira letra de qualquer busca faria
    // piscar um erro na cara de quem digita. A regra é a MESMA que o schema
    // usa (`lib/inbox/termo-de-busca.ts`) — nunca repetida aqui.
    search: buscaValeConsulta(aux.search) ? aux.search : undefined,
    channel_session_id: aux.channel_session_id,
    tag: aux.tag,
    unread: aux.leitura === "nao_lidas" || undefined,
    read: aux.leitura === "lidas" || undefined,
  };
}
