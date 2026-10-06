/**
 * "Fulano está digitando…" — a metade do atraso humano que é da TELA.
 *
 * ─── O par deste módulo ────────────────────────────────────────────────────
 * `lib/messaging/presenca.ts` acende o indicador no APARELHO do cliente (via
 * canal); aqui o indicador aparece no CRM, para os outros olhos na mesma
 * conversa. Os dois andam juntos: o composer avisa os dois quando o atendente
 * digita, e o thread mostra este.
 *
 * ─── Transporte ────────────────────────────────────────────────────────────
 * Broadcast do Realtime, tópico `digitacao:<conversationId>`, evento
 * `digitacao` — SEM prefixo `private:`, de propósito: canal privado exigiria
 * policy em `realtime.messages`, e sem ela o indicador morreria calado. O
 * preço é declarado: o isolamento aqui é o uuid da conversa (imprevisível),
 * não a RLS. O payload não carrega PII além do primeiro nome de quem digita —
 * que qualquer ouvido da conversa já vê no próprio inbox.
 *
 * ─── Falha silenciosa por desenho ───────────────────────────────────────────
 * Broadcast não entregue (socket caído, policy ausente no projeto) = sem
 * indicador, e só isso. Mensagem continua chegando pelo `postgres_changes`,
 * que é o caminho que carrega valor. Indicador é decoração, como no canal.
 */

/** O que o atendente está fazendo — decide o verbo que a tela mostra. */
export type TipoDeDigitacao = "text" | "audio" | "file";

export interface AvisoDeDigitacao {
  user_id: string;
  nome: string;
  kind: TipoDeDigitacao;
  /** ms desde a época — quem recebe compara com o próprio relógio. */
  ts: number;
}

/** Tópico fixo por conversa — emissor e ouvinte TÊM de usar o mesmo nome. */
export function topicoDeDigitacao(conversationId: string): string {
  return `digitacao:${conversationId}`;
}

/** Nome do evento dentro do tópico. */
export const EVENTO_DE_DIGITACAO = "digitacao" as const;

/**
 * Por quanto tempo um aviso vale sem refresco (6s). O emissor re-avisa a cada
 * ~2,5s digitando; 6s cobre um intervalo perdido sem grudar o indicador.
 */
export const TETO_DE_DIGITACAO_MS = 6_000;

export function montarAvisoDeDigitacao(
  userId: string,
  nome: string,
  kind: TipoDeDigitacao,
  agora: number = Date.now(),
): AvisoDeDigitacao {
  return { user_id: userId, nome, kind, ts: agora };
}

/** Tira os avisos vencidos — puro para ser testável sem timer. */
export function semExpirados(avisos: readonly AvisoDeDigitacao[], agora: number): AvisoDeDigitacao[] {
  return avisos.filter((a) => agora - a.ts <= TETO_DE_DIGITACAO_MS);
}

/** Dobra um aviso novo sobre a lista: mesmo autor atualiza, outro soma. */
export function dobrarAviso(
  avisos: readonly AvisoDeDigitacao[],
  novo: AvisoDeDigitacao,
): AvisoDeDigitacao[] {
  return [...avisos.filter((a) => a.user_id !== novo.user_id), novo];
}
