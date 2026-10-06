import type { RiskBucket } from "@/lib/leads/risk-radar";

/**
 * Quais leads o quadro do Radar mostra — o recorte "em risco" do funil.
 *
 * Pura e testável: o contrato §3.3 (que o `KanbanBoard` também segue para o
 * selo "esfriando") mora aqui, e não em dois componentes. `em_voo` fica de
 * fora de propósito: a IA já prometeu voltar, então não há decisão pendente
 * para o humano — e `em_dia` nunca entra, porque o Radar é a lista do que
 * esfriou, não o funil inteiro.
 */
export interface RiscoParaQuadro {
  id: string;
  pipeline_id: string;
  risk: RiskBucket;
}

export function idsEmRisco(
  itens: RiscoParaQuadro[] | undefined | null,
  pipelineId: string,
): Set<string> {
  const ids = new Set<string>();
  for (const item of itens ?? []) {
    if (item.pipeline_id !== pipelineId) continue;
    if (item.risk === "critico" || item.risk === "em_risco") ids.add(item.id);
  }
  return ids;
}
