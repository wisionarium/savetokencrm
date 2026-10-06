/**
 * Streak de engajamento do lead — o foguinho (v2, regra do dono 2026-10-06).
 *
 * ─── O que ela responde ────────────────────────────────────────────────────
 * "Este lead está quente AGORA?" — quente = o cliente ESCREVEU (2+ mensagens,
 * última há até 1h). É o sinal que o atendente usa para escolher quem chamar
 * primeiro — no inbox e no quadro do Radar.
 *
 * ─── A regra, sem inventar ──────────────────────────────────────────────────
 * Pedido do dono: dura 1h; a próxima mensagem dele renova (o `last_inbound_at`
 * anda); UMA mensagem sozinha nunca acende — streak é conversa, não visita.
 * Formalizado: `inbound_total >= 2 && idade(last_inbound_at) <= 1h`.
 *
 * ─── De onde vem o total ────────────────────────────────────────────────────
 * `fn_conversa_inbound_total` (migration 0346), anexado pela lista do inbox e
 * pelo board (`withConversas`). Ausente (`null`, RPC falhou) = 0 = sem chama:
 * o foguinho é realce progressivo, nunca motivo para a tela não abrir.
 */

export interface EntradaDoEngajamento {
  last_inbound_at: string | null;
  /**
   * Total de mensagens inbound do contato nesta conversa. `null` = não medido
   * (a RPC falhou ou o payload é antigo) e vale como 0 — sem chama.
   */
  inbound_total: number | null;
}

export type NivelDeEngajamento = "quente" | null;

export interface Engajamento {
  nivel: NivelDeEngajamento;
  /** Frase pronta para `title`/tooltip — o "e daí?" do invariante 5. */
  motivo: string | null;
}

/** Dura 1h: a próxima mensagem dele renova; 1h parado apaga. */
const JANELA_STREAK_MS = 60 * 60 * 1000;
/** UMA mensagem sozinha nunca acende — piso do pedido do dono. */
const PISO_DE_MENSAGENS = 2;

export function engajamentoDaConversa(
  entrada: EntradaDoEngajamento,
  agora: Date = new Date(),
): Engajamento {
  const total = entrada.inbound_total ?? 0;
  if (total < PISO_DE_MENSAGENS) return { nivel: null, motivo: null };

  const inbound = entrada.last_inbound_at ? new Date(entrada.last_inbound_at).getTime() : NaN;
  if (Number.isNaN(inbound)) return { nivel: null, motivo: null };

  const idade = agora.getTime() - inbound;
  // Data futura (relógio torto) não é engajamento — é dado ruim.
  if (idade < 0) return { nivel: null, motivo: null };
  if (idade > JANELA_STREAK_MS) return { nivel: null, motivo: null };

  return {
    nivel: "quente",
    motivo: `${total} mensagens na última hora — cliente engajado`,
  };
}
