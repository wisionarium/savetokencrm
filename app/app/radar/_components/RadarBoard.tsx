"use client";
import { useMemo, useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { useBoard } from "@/hooks/kanban/useBoard";
import { useAtRiskLeads } from "@/hooks/leads/useAtRiskLeads";
import { idsEmRisco } from "@/lib/leads/radar-board";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, PaperPlaneTilt } from "@/lib/ui/icons";

export interface FunilDoRadar {
  id: string;
  name: string;
  is_default: boolean;
}

function followupWhen(iso: string, t: (texto: string) => string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return t("agora");
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 48) return `${t("em")} ${Math.max(1, hours)}h`;
  return `${t("em")} ${Math.round(hours / 24)}d`;
}

/**
 * O Radar virou quadro (decisão do dono, 2026-10-06): colunas são as etapas do
 * funil, cards são SÓ os leads em risco — e arrastar move a etapa de verdade
 * (o mesmo `KanbanBoard` do CRM, com tags, responsáveis, dossiê e foguinho).
 *
 * O filtro vem do MESMO radar que alimentava a lista (`useAtRiskLeads`), pelo
 * contrato §3.3: `critico` + `em_risco` entram, `em_voo` fica de fora (a IA já
 * prometeu voltar). A faixa "sem próximo passo" continua acima do quadro: é o
 * invariante 4 em forma acionável, e quadro nenhum a substitui.
 */
export function RadarBoard({ funis }: { funis: FunilDoRadar[] }) {
  const t = useT();
  const [pipelineId, setPipelineId] = useState<string | null>(
    () => funis.find((f) => f.is_default)?.id ?? funis[0]?.id ?? null,
  );
  const board = useBoard(pipelineId);
  const { data: risco, isLoading: riscoCarregando } = useAtRiskLeads();

  const emRisco = useMemo(
    () => idsEmRisco(risco?.items, pipelineId ?? ""),
    [risco?.items, pipelineId],
  );
  const leads = useMemo(
    () => (board.data?.leads ?? []).filter((l) => emRisco.has(l.id)),
    [board.data?.leads, emRisco],
  );
  // Contagens DO FUNIL VISTO, não da org: os badges da org inteira ao lado de
  // um quadro filtrado fariam o operador caçar cards que não estão aqui.
  const contagens = useMemo(() => {
    let critico = 0;
    let emRiscoN = 0;
    let emVoo = 0;
    for (const item of risco?.items ?? []) {
      if (item.pipeline_id !== pipelineId) continue;
      if (item.risk === "critico") critico += 1;
      else if (item.risk === "em_risco") emRiscoN += 1;
      else if (item.risk === "em_voo") emVoo += 1;
    }
    return { critico, emRisco: emRiscoN, emVoo };
  }, [risco?.items, pipelineId]);

  const semPasso = risco?.sem_proximo_passo ?? [];
  // Em voo fica FORA do quadro (contrato §3.3: a IA já prometeu voltar), mas
  // NÃO some da tela: a promessa é a afirmação de que a demanda não está
  // morrendo, e escondê-la seria trocar "não precisa agir" por "não existe".
  const emVoo = useMemo(
    () =>
      (risco?.items ?? []).filter(
        (item) => item.pipeline_id === pipelineId && item.risk === "em_voo",
      ),
    [risco?.items, pipelineId],
  );
  const carregando = board.isLoading || riscoCarregando;

  if (!pipelineId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm font-medium">{t("Nenhum funil para exibir")}</p>
        <p className="text-xs text-muted-foreground">
          {t("Crie um funil em Funis para ver o quadro do Radar.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="radar-funil" className="text-xs font-medium text-muted-foreground">
          {t("Funil")}
        </label>
        <Select value={pipelineId} onValueChange={setPipelineId}>
          <SelectTrigger id="radar-funil" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {funis.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2" data-testid="radar-counts">
          <Badge variant="error">
            {contagens.critico} {t("crítico")}
          </Badge>
          <Badge variant="warning">
            {contagens.emRisco} {t("em risco")}
          </Badge>
          <Badge variant="info">
            {contagens.emVoo} {t("em voo")}
          </Badge>
        </div>
      </div>

      {semPasso.length > 0 ? (
        <section
          className="rounded-lg border border-warning-border bg-warning-bg/40 p-3"
          data-testid="radar-sem-proximo-passo"
        >
          <p className="text-sm font-medium">
            {semPasso.length}{" "}
            {semPasso.length === 1
              ? t("demanda aberta sem próximo passo")
              : t("demandas abertas sem próximo passo")}
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            {t(
              "Ninguém marcou o que acontece a seguir. Cada uma é alguém esperando sem que nada esteja combinado.",
            )}
          </p>
          <ul className="flex flex-col gap-1">
            {semPasso.slice(0, 8).map((d) => (
              <li key={d.id} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate">{d.contact_name ?? t("Contato sem nome")}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {t("aberta há")} {d.horas_aberta}h
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {emVoo.length > 0 ? (
        <section
          className="rounded-lg border border-info-border bg-info-bg/40 p-3"
          data-testid="radar-em-voo"
        >
          <p className="text-sm font-medium">
            {emVoo.length}{" "}
            {emVoo.length === 1 ? t("retorno agendado") : t("retornos agendados")}
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {emVoo.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate">{item.title}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-info-fg">
                  <PaperPlaneTilt size={13} aria-hidden />
                  {t("Assistente retorna")}{" "}
                  {item.next_followup_at ? followupWhen(item.next_followup_at, t) : t("agora")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {carregando ? (
        <div className="flex gap-3 overflow-hidden p-4">
          {[0, 1, 2].map((c) => (
            <div
              key={c}
              className="flex w-80 shrink-0 flex-col gap-2 rounded-lg border border-border bg-surface-muted/40 p-3"
            >
              <Skeleton className="h-5 w-32" />
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : board.isError || !board.data ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
          {t("Não consegui carregar este funil.")}
        </div>
      ) : leads.length === 0 ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center"
          data-testid="radar-empty"
        >
          <CheckCircle size={28} className="text-success-fg/70" aria-hidden />
          <p className="text-sm font-medium">{t("Nenhuma demanda em risco")}</p>
          <p className="text-xs text-muted-foreground">
            {t("Toda demanda aberta teve atividade recente ou já tem um retorno agendado.")}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <KanbanBoard
            pipelineId={pipelineId}
            stages={board.data.stages}
            leads={leads}
            pipeline={board.data.pipeline}
            pulses={board.pulses}
          />
        </div>
      )}
    </div>
  );
}
