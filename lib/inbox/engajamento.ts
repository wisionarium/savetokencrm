/**
 * Streak de engajamento do lead — a chaminha da lista (v1, só visual).
 *
 * ─── O que ela responde ────────────────────────────────────────────────────
 * "Este lead está quente AGORA?" — quente = o cliente escreveu há pouco e ainda
 * espera resposta, ou escreveu várias vezes sem que ninguém respondesse. É o
 * sinal que o atendente usa para escolher quem chamar primeiro na Fila.
 *
 * ─── Por que só com o que a lista já tem ────────────────────────────────────
 * A lista (`ConversationWithContact`) não traz contagem de mensagens, tipo de
 * mídia nem tempo de resposta medido — trazer isso pediria agregação no banco
 * (migration + baseline + MANIFEST). Esta v1 é função pura sobre o que a linha
 * já carrega: recência do inbound + não-lidas. Quando o backend agregar de
 * verdade, a régua troca por dentro e a tela não muda.
 *
 * ─── INFERIDO, não medido ───────────────────────────────────────────────────
 * Os pisos abaixo (5 min, 15 min, 3 mensagens) são ponto de partida calibrável,
 * não número de negócio: nenhum PRD deste repo define "lead quente". Se a
 * operação achar a chama acesa demais ou de menos, é aqui que se mexe.
 */

export interface EntradaDoEngajamento {
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  unread_count_for_assignee: number;
}

export type NivelDeEngajamento = "quente" | null;

export interface Engajamento {
  nivel: NivelDeEngajamento;
  /** Frase pronta para `title`/tooltip — o "e daí?" do invariante 5. */
  motivo: string | null;
}

/** Respondeu há pouco = inbound nos últimos 5 min ainda sem resposta. */
const JANELA_QUENTE_MS = 5 * 60 * 1000;
/** Engajando = inbound nos últimos 15 min (respondeu e segue por perto). */
const JANELA_MORNA_MS = 15 * 60 * 1000;
/** "Responde muito" = 3+ mensagens sem resposta. Piso INFERIDO. */
const PISO_DE_VOLUME = 3;

export function engajamentoDaConversa(
  entrada: EntradaDoEngajamento,
  agora: Date = new Date(),
): Engajamento {
  const naoLidas = entrada.unread_count_for_assignee ?? 0;
  if (naoLidas <= 0) return { nivel: null, motivo: null };

  const inbound = entrada.last_inbound_at ? new Date(entrada.last_inbound_at).getTime() : NaN;
  if (Number.isNaN(inbound)) return { nivel: null, motivo: null };

  const idade = agora.getTime() - inbound;
  // Data futura (relógio torto) não é engajamento — é dado ruim.
  if (idade < 0) return { nivel: null, motivo: null };

  // Volume alto segura a chama mesmo quando a última mensagem já esfriou um
  // pouco: quem escreveu 3+ vezes sem resposta está insistindo, não passeando.
  if (naoLidas >= PISO_DE_VOLUME && idade <= JANELA_MORNA_MS) {
    return {
      nivel: "quente",
      motivo:
        naoLidas === 1
          ? "1 mensagem sem resposta — cliente insistindo"
          : `${naoLidas} mensagens sem resposta — cliente insistindo`,
    };
  }
  if (idade <= JANELA_QUENTE_MS) {
    return { nivel: "quente", motivo: "Respondeu agora há pouco" };
  }
  return { nivel: null, motivo: null };
}
