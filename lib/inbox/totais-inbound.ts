import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

/**
 * Total de mensagens inbound por conversa — o combustível do foguinho de
 * streak (`lib/inbox/engajamento.ts`).
 *
 * UMA consulta para a página inteira (`fn_conversa_inbound_total`, migration
 * 0346), e não uma por linha: a lista do inbox e o quadro do Radar chamam
 * isto uma vez por render com todos os ids.
 *
 * Falha NÃO derruba quem chama: sem o total a régua vale como 0 e a chama
 * apaga — realce progressivo, nunca motivo para a tela não abrir (o
 * precedente é `avisaAmbiguas` na rota do board). O `warn` deixa rastro para
 * quem investiga por que os foguinhos sumiram.
 */
export async function totaisInboundPorConversa(
  supabase: SupabaseClient,
  conversationIds: string[],
): Promise<Map<string, number>> {
  const totais = new Map<string, number>();
  if (conversationIds.length === 0) return totais;
  try {
    const { data, error } = await supabase.rpc("fn_conversa_inbound_total" as never, {
      p_conversation_ids: conversationIds,
    });
    if (error) {
      logger.warn("[totais-inbound] rpc falhou — chamas apagadas nesta carga", {
        detail: error.message.slice(0, 200),
      });
      return totais;
    }
    for (const row of (data ?? []) as Array<{
      conversation_id: string;
      inbound_total: number | string | null;
    }>) {
      if (!row?.conversation_id) continue;
      totais.set(row.conversation_id, Number(row.inbound_total ?? 0) || 0);
    }
  } catch (err) {
    logger.warn("[totais-inbound] rpc lançou — chamas apagadas nesta carga", {
      detail: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    });
  }
  return totais;
}
