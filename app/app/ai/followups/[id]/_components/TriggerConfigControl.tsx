"use client";

import { useT } from "@/hooks/i18n/useT";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUpdateTriggerConfig } from "@/hooks/followup/useFollowupFlow";
import { etapasPorFunil, nomeDaEtapa, useEtapasDeGatilho } from "@/hooks/followup/useEtapasDeGatilho";

/**
 * Controle de `trigger_config` do pointer (Task 8.5) — como o fluxo começa.
 *
 * ⚠️ SÓ APARECE AQUI O QUE TEM MOTOR VIVO:
 *  - `first_message`: primeira mensagem ou novo contato recebido (boas-vindas)
 *  - `keyword`: mensagem contendo palavras-chave específicas (estilo ManyChat)
 *  - `tag_added`: quando uma etiqueta é adicionada ao contato
 *  - `stage_change`: quando o lead entra numa etapa do funil (arrasto ou automação)
 *  - `silence`: silêncio/inatividade do contato por X minutos
 *  - `case_opened`: transbordo humano quando o agente precisa de ajuda
 *  - `webhook`: disparado por regra externa em Webhooks
 *  - `appointment_no_show`: falta confirmada na agenda
 *  - `manual`: início sob demanda pelo operador
 */
type TriggerKind =
  | "first_message"
  | "keyword"
  | "tag_added"
  | "stage_change"
  | "silence"
  | "case_opened"
  | "webhook"
  | "appointment_no_show"
  | "manual";

interface TriggerFormState {
  kind: TriggerKind;
  thresholdMinutes: number;
  segments: string;
  stageId: string;
  cancelOnReply: boolean;
  eventTypeIds: string[];
  keywords: string;
  tag: string;
}

const DEFAULT_THRESHOLD_MINUTES = 60;
const MIN_THRESHOLD_MINUTES = 5;

const KIND_LABEL: Record<TriggerKind, string> = {
  first_message: "Primeira mensagem (Boas-vindas)",
  keyword: "Palavra-chave na mensagem",
  tag_added: "Etiqueta / Tag adicionada",
  stage_change: "Etapa do funil (Kanban)",
  silence: "Silêncio (inatividade)",
  case_opened: "Agente pediu ajuda (Handoff)",
  webhook: "Automação (Webhooks)",
  appointment_no_show: "Falta confirmada pela equipe",
  manual: "Manual",
};

function parseTriggerConfig(raw: Record<string, unknown>): TriggerFormState {
  const kind: TriggerKind =
    raw.kind === "first_message"
      ? "first_message"
      : raw.kind === "keyword"
        ? "keyword"
        : raw.kind === "tag_added"
          ? "tag_added"
          : raw.kind === "appointment_no_show"
            ? "appointment_no_show"
            : raw.kind === "silence"
              ? "silence"
              : raw.kind === "stage_change"
                ? "stage_change"
                : raw.kind === "case_opened"
                  ? "case_opened"
                  : raw.kind === "webhook"
                    ? "webhook"
                    : "manual";

  const params =
    (raw.params as {
      threshold_minutes?: number;
      segments?: string[];
      stage_id?: string;
      event_type_ids?: string[];
      keywords?: string[];
      tag?: string;
    } | undefined) ?? {};

  return {
    kind,
    eventTypeIds: Array.isArray(params.event_type_ids) ? params.event_type_ids : [],
    thresholdMinutes:
      kind === "silence" && typeof params.threshold_minutes === "number"
        ? params.threshold_minutes
        : DEFAULT_THRESHOLD_MINUTES,
    segments: kind === "silence" && Array.isArray(params.segments) ? params.segments.join(", ") : "",
    stageId: kind === "stage_change" && typeof params.stage_id === "string" ? params.stage_id : "",
    keywords: kind === "keyword" && Array.isArray(params.keywords) ? params.keywords.join(", ") : "",
    tag: kind === "tag_added" && typeof params.tag === "string" ? params.tag : "",
    cancelOnReply: raw.cancel_on_reply === true,
  };
}

function toTriggerConfig(form: TriggerFormState): Record<string, unknown> {
  const cancelOnReply = form.cancelOnReply ? { cancel_on_reply: true } : {};

  if (form.kind === "first_message") {
    return { kind: "first_message", ...cancelOnReply };
  }

  if (form.kind === "keyword") {
    const kws = form.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    return { kind: "keyword", params: { keywords: kws }, ...cancelOnReply };
  }

  if (form.kind === "tag_added") {
    return { kind: "tag_added", params: { tag: form.tag.trim() }, ...cancelOnReply };
  }

  if (form.kind === "appointment_no_show") {
    return { kind: "appointment_no_show", params: { event_type_ids: form.eventTypeIds } };
  }

  if (form.kind === "manual") {
    return { kind: "manual", ...cancelOnReply };
  }

  if (form.kind === "stage_change") {
    return { kind: "stage_change", params: { stage_id: form.stageId }, ...cancelOnReply };
  }

  if (form.kind === "case_opened") {
    return { kind: "case_opened", ...cancelOnReply };
  }

  if (form.kind === "webhook") {
    return { kind: "webhook", ...cancelOnReply };
  }

  const segments = form.segments
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    kind: "silence",
    params: { threshold_minutes: form.thresholdMinutes, ...(segments.length > 0 ? { segments } : {}) },
    ...cancelOnReply,
  };
}

function summaryLabel(
  cfg: Record<string, unknown>,
  etapa: { stageName: string; pipelineName: string } | null,
  t: (texto: string) => string = (texto) => texto,
): string {
  if (cfg.kind === "first_message") return t("Gatilho: Primeira mensagem (Boas-vindas)");
  if (cfg.kind === "keyword") {
    const kws = (cfg.params as { keywords?: string[] } | undefined)?.keywords;
    return `Gatilho: Palavra-chave ${kws?.length ? `(${kws.join(", ")})` : ""}`;
  }
  if (cfg.kind === "tag_added") {
    const tag = (cfg.params as { tag?: string } | undefined)?.tag;
    return `Gatilho: Tag adicionada ${tag ? `(«${tag}»)` : ""}`;
  }
  if (cfg.kind === "appointment_no_show") return t("Gatilho: falta confirmada pela equipe");
  if (cfg.kind === "silence") {
    const minutes = (cfg.params as { threshold_minutes?: number } | undefined)?.threshold_minutes;
    return `Gatilho: Silêncio${typeof minutes === "number" ? ` (${minutes} min)` : ""}`;
  }
  if (cfg.kind === "stage_change") {
    return etapa ? `Gatilho: entrou em «${etapa.stageName}» em ${etapa.pipelineName}` : "Gatilho: Etapa do funil";
  }
  if (cfg.kind === "case_opened") return `${t("Gatilho")}: ${t("quando o agente pede ajuda")}`;
  if (cfg.kind === "webhook") return t("Disparado por uma automação em Webhooks");
  if (cfg.kind === "manual" || cfg.kind === undefined) return `${t("Gatilho")}: ${t("Manual")}`;
  return `Gatilho: ${String(cfg.kind)} (indisponível)`;
}

interface Props {
  flowId: string;
  triggerConfig: Record<string, unknown>;
}

export function TriggerConfigControl({ flowId, triggerConfig }: Props) {
  const t = useT();
  const update = useUpdateTriggerConfig(flowId);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<TriggerFormState>(() => parseTriggerConfig(triggerConfig));
  const [form, setForm] = useState<TriggerFormState>(saved);
  const eventTypes = useQuery({
    queryKey: ["agenda", "tipos"],
    enabled: open && form.kind === "appointment_no_show",
    queryFn: async () =>
      (await apiClient.get<{ data: Array<{ id: string; name: string }> }>("/api/v1/agenda/tipos")).data,
  });

  const { etapas, carregando: etapasCarregando } = useEtapasDeGatilho();
  const etapaSalva = etapas.find((e) => e.stageId === parseTriggerConfig(triggerConfig).stageId);

  useEffect(() => {
    if (open) return;
    const next = parseTriggerConfig(triggerConfig);
    setSaved(next);
    setForm(next);
  }, [triggerConfig, open]);

  const thresholdInvalid =
    form.kind === "silence" && (!Number.isFinite(form.thresholdMinutes) || form.thresholdMinutes < MIN_THRESHOLD_MINUTES);
  const stageInvalid = form.kind === "stage_change" && form.stageId.trim().length === 0;
  const keywordInvalid = form.kind === "keyword" && form.keywords.trim().length === 0;
  const tagInvalid = form.kind === "tag_added" && form.tag.trim().length === 0;

  const dirty =
    form.kind !== saved.kind ||
    (form.kind === "appointment_no_show" && form.eventTypeIds.join() !== saved.eventTypeIds.join()) ||
    form.cancelOnReply !== saved.cancelOnReply ||
    (form.kind === "silence" && (form.thresholdMinutes !== saved.thresholdMinutes || form.segments !== saved.segments)) ||
    (form.kind === "stage_change" && form.stageId !== saved.stageId) ||
    (form.kind === "keyword" && form.keywords !== saved.keywords) ||
    (form.kind === "tag_added" && form.tag !== saved.tag);

  const onSave = () => {
    if (thresholdInvalid || stageInvalid || keywordInvalid || tagInvalid) return;
    update.mutate(toTriggerConfig(form), {
      onSuccess: () => {
        setSaved(form);
        setOpen(false);
      },
    });
  };

  const funis = etapasPorFunil(etapas);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-testid="trigger-config-button">
          {summaryLabel(triggerConfig, etapaSalva ?? null, t)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-84 max-h-[85vh] overflow-y-auto" align="end" data-testid="trigger-config-panel">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trigger-kind">{t("Tipo de gatilho")}</Label>
            <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v as TriggerKind }))}>
              <SelectTrigger id="trigger-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first_message">{t(KIND_LABEL.first_message)}</SelectItem>
                <SelectItem value="keyword">{t(KIND_LABEL.keyword)}</SelectItem>
                <SelectItem value="tag_added">{t(KIND_LABEL.tag_added)}</SelectItem>
                <SelectItem value="stage_change">{t(KIND_LABEL.stage_change)}</SelectItem>
                <SelectItem value="silence">{t(KIND_LABEL.silence)}</SelectItem>
                <SelectItem value="case_opened">{t(KIND_LABEL.case_opened)}</SelectItem>
                <SelectItem value="webhook">{t(KIND_LABEL.webhook)}</SelectItem>
                <SelectItem value="appointment_no_show">{t(KIND_LABEL.appointment_no_show)}</SelectItem>
                <SelectItem value="manual">{t(KIND_LABEL.manual)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.kind === "first_message" && (
            <div className="space-y-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground border">
              <span className="font-semibold text-foreground block">
                {t("Gatilho de Boas-vindas")}
              </span>
              <p>
                {t("O fluxo começa automaticamente quando um contato novo envia a primeira mensagem no WhatsApp ou no chat.")}
              </p>
              <p>
                {t("Ideal para mensagens de recepção imediata, apresentação da empresa e início da qualificação/triagem.")}
              </p>
            </div>
          )}

          {form.kind === "keyword" && (
            <div className="space-y-2">
              <Label htmlFor="trigger-keywords">{t("Palavras-chave que disparam o fluxo")}</Label>
              <Input
                id="trigger-keywords"
                placeholder={t("ex: QUERO, PREÇO, PROMOÇÃO, CARDÁPIO, SUPORTE")}
                value={form.keywords}
                onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                aria-invalid={keywordInvalid}
              />
              {keywordInvalid && (
                <p className="text-xs text-error-fg">{t("Informe ao menos uma palavra-chave.")}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("Separe as palavras por vírgula. Quando o cliente enviar qualquer uma dessas palavras no chat, o fluxo inicia automaticamente.")}
              </p>
            </div>
          )}

          {form.kind === "tag_added" && (
            <div className="space-y-2">
              <Label htmlFor="trigger-tag">{t("Nome da etiqueta / tag")}</Label>
              <Input
                id="trigger-tag"
                placeholder={t("ex: lead-quente, vip, carrinho-abandonado")}
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                aria-invalid={tagInvalid}
              />
              {tagInvalid && (
                <p className="text-xs text-error-fg">{t("Informe o nome da tag.")}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("O fluxo inicia assim que esta tag for adicionada ao contato ou lead no CRM.")}
              </p>
            </div>
          )}

          {form.kind === "stage_change" && (
            <div className="space-y-2">
              <Label htmlFor="trigger-stage">{t("Em qual etapa do funil a automação vai entrar?")}</Label>
              <Select
                value={form.stageId}
                onValueChange={(v) => setForm((f) => ({ ...f, stageId: v }))}
                disabled={etapasCarregando || etapas.length === 0}
              >
                <SelectTrigger id="trigger-stage" data-testid="trigger-stage-select" aria-invalid={stageInvalid}>
                  <SelectValue placeholder={etapasCarregando ? "Carregando etapas…" : "Escolha a etapa"} />
                </SelectTrigger>
                <SelectContent>
                  {funis.map((funil) => (
                    <SelectGroup key={funil.id}>
                      <SelectLabel className="font-bold text-foreground">{funil.nome}</SelectLabel>
                      {funil.etapas.map((etapa) => (
                        <SelectItem key={etapa.stageId} value={etapa.stageId}>
                          {nomeDaEtapa(etapa)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {!etapasCarregando && etapas.length === 0 && (
                <p className="text-xs text-error-fg">
                  {t("Nenhuma etapa ativa encontrada — configure seu funil no Kanban antes de armar este gatilho.")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("O fluxo começa quando um negócio entra nesta etapa no Kanban, seja por arrasto no quadro, pelo assistente de IA ou por automações.")}
              </p>
            </div>
          )}

          {form.kind === "appointment_no_show" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("Só começa após falta confirmada pela equipe na agenda. Remarcação, cancelamento ou nova resposta interrompem a recuperação.")}
              </p>
              <p className="text-xs">{t("Tipos de compromisso (nenhum selecionado = todos)")}</p>
              {eventTypes.data?.map((type) => (
                <label key={type.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.eventTypeIds.includes(type.id)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        eventTypeIds: e.target.checked
                          ? [...f.eventTypeIds, type.id]
                          : f.eventTypeIds.filter((id) => id !== type.id),
                      }))
                    }
                  />
                  {type.name}
                </label>
              ))}
              {eventTypes.isError && (
                <p role="alert" className="text-xs text-error-fg">
                  {t("Não foi possível carregar os tipos de compromisso.")}
                </p>
              )}
            </div>
          )}

          {form.kind === "case_opened" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("O fluxo começa quando o agente de IA abre um caso de escalação (momento em que precisa transferir para um atendente humano).")}
              </p>
              <p className="text-xs text-muted-foreground">
                <strong className="font-medium">{t("Comece o fluxo por uma espera.")}</strong> {t("O agente continua conversando depois de abrir o caso — sem espera, o cliente recebe duas mensagens ao mesmo tempo.")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("Se o caso for resolvido antes, o follow-up é cancelado sozinho.")}
              </p>
            </div>
          )}

          {form.kind === "webhook" && (
            <p className="text-xs text-muted-foreground">
              {t(
                "O fluxo começa quando uma regra em Webhooks usa a ação «Iniciar fluxo de mensagem» apontando para este fluxo publicado.",
              )}
            </p>
          )}

          {form.kind === "silence" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="trigger-threshold">{t("Minutos de silêncio (inatividade)")}</Label>
                <Input
                  id="trigger-threshold"
                  type="number"
                  min={MIN_THRESHOLD_MINUTES}
                  value={form.thresholdMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, thresholdMinutes: Number(e.target.value) }))}
                  aria-invalid={thresholdInvalid}
                />
                {thresholdInvalid && (
                  <p className="text-xs text-error-fg">{t("Mínimo de")} {MIN_THRESHOLD_MINUTES} {t("minutos.")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger-segments">{t("Segmentos (tags, opcional)")}</Label>
                <Input
                  id="trigger-segments"
                  placeholder={t("ex: vip, carrinho-abandonado")}
                  value={form.segments}
                  onChange={(e) => setForm((f) => ({ ...f, segments: e.target.value }))}
                />
              </div>
            </>
          )}

          {form.kind === "manual" && (
            <p className="text-xs text-muted-foreground">
              {t("O fluxo não inicia sozinho. Ele é disparado manualmente por atendentes ou pelo botão na conversa.")}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <Label htmlFor="trigger-cancel-on-reply">{t("Cancelar se o lead responder")}</Label>
            <Switch
              id="trigger-cancel-on-reply"
              checked={form.kind === "appointment_no_show" || form.cancelOnReply}
              disabled={form.kind === "appointment_no_show"}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, cancelOnReply: checked }))}
            />
          </div>

          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={!dirty || thresholdInvalid || stageInvalid || keywordInvalid || tagInvalid || update.isPending}
            onClick={onSave}
            data-testid="trigger-config-save"
          >
            {update.isPending ? t("Salvando…") : t("Salvar gatilho")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
