"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Upload,
  X,
  Loader2,
  Link as LinkIcon,
  Play,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Images,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { CaretLeft } from "@/lib/ui/icons";
import { useDispatchImageUpload } from "@/hooks/followup/useDispatchImageUpload";
import {
  buildDispatchGraph,
  classifyDispatchMedia,
  DISPATCH_DEFAULT_DELAY_MS,
  DISPATCH_MAX_DELAY_MS,
  readDispatchDelay,
  readDispatchSteps,
  type DispatchStep,
} from "@/lib/followup/dispatch-graph";
import {
  followupFlowQueryKey,
  type FollowupFlowDetailRow,
} from "@/hooks/followup/useFollowupFlow";
import { followupFlowsListQueryKey } from "@/hooks/followup/useFollowupFlows";
import { DeleteFollowupFlowButton } from "../../_components/DeleteFollowupFlowButton";
import { FlowStatusBadge } from "../../_components/FlowStatusBadge";
import { SeletorDaGaleria, type GaleriaPick } from "@/components/galeria/SeletorDaGaleria";

interface Props {
  /** null = modo criação (POST); string = modo edição (PATCH). */
  flowId: string | null;
  initialData?: FollowupFlowDetailRow;
}

interface StepState extends DispatchStep {
  key: string;
}

/** 2600 → "2,6 segundos"; 5000 → "5 segundos". */
function formatDelay(ms: number): string {
  const s = ms / 1000;
  return `${s.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${s === 1 ? "segundo" : "segundos"}`;
}

let stepSeq = 0;
const nextKey = () => `step-${Date.now()}-${stepSeq++}`;

/**
 * Editor de fluxo de DISPARO em estilo nodes (estrutura da referência:
 * breadcrumb + painel de configuração à esquerda + canvas com cartões
 * encadeados + salvar no topo). Serve CRIAÇÃO (flowId null) e edição com o
 * mesmo layout. Sem o que não existe aqui (tipo de mensagem IA/WhatsApp):
 * o "digitando por N segundos" (0–30s) vai no trigger do grafo.
 *
 * Fluxos de IA (inbox_enabled=false) continuam no FlowCanvas com xyflow.
 */
export function DispatchFlowEditor({ flowId, initialData }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCreate = flowId === null;

  const initialSteps: StepState[] = (() => {
    const steps = initialData ? readDispatchSteps(initialData.draft_graph) : [];
    if (steps.length === 0)
      return [
        { key: nextKey(), image: "", preview: "", text: "", position: { x: 100, y: 250 } },
      ];
    return steps.map((s) => ({ ...s, key: nextKey() }));
  })();

  const [name, setName] = useState(initialData?.name ?? "");
  const [steps, setSteps] = useState<StepState[]>(initialSteps);
  const [delayMs, setDelayMs] = useState(
    initialData ? readDispatchDelay(initialData.draft_graph) : DISPATCH_DEFAULT_DELAY_MS,
  );
  // Estado de publicação: tudo nasce/muda para RASCUNHO; só o Publicar ativa.
  const [status, setStatus] = useState<"draft" | "active">(
    initialData && initialData.status === "active" ? "active" : "draft",
  );
  const [selectedKey, setSelectedKey] = useState<string>(initialSteps[0]!.key);
  const [isSaving, setIsSaving] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [galeriaOpen, setGaleriaOpen] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Upload mecânico (sem estado próprio de imagem: o destino é o passo
  // selecionado).
  const uploader = useDispatchImageUpload();

  const selected = steps.find((s) => s.key === selectedKey) ?? steps[0]!;
  const patchStep = (key: string, patch: Partial<StepState>) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const patchStepRef = useRef(patchStep);
  useEffect(() => {
    patchStepRef.current = patchStep;
  });

  // Previews de imagens já salvas (storage path cru não renderiza num
  // `<img>`): resolve uma vez por abertura via URL assinada.
  const previewsResolved = useRef(false);
  useEffect(() => {
    if (previewsResolved.current || isCreate) return;
    previewsResolved.current = true;
    const pendentes = initialSteps.filter((s) => s.image.trim() && !s.preview.trim());
    if (pendentes.length === 0) return;
    void (async () => {
      for (const s of pendentes) {
        try {
          const res = await apiClient.get<{ data: { preview_url: string } }>(
            `/api/v1/media/galeria/preview?path=${encodeURIComponent(s.image.trim())}`,
          );
          const url = res.data.preview_url;
          if (url) patchStepRef.current(s.key, { preview: url });
        } catch {
          // sem preview: o cartão mostra o espaço reservado, o envio segue
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId]);

  const dirty = JSON.stringify({ name, steps, delayMs, status }) !== JSON.stringify({
    name: initialData?.name ?? "",
    steps: initialSteps,
    delayMs: initialData ? readDispatchDelay(initialData.draft_graph) : DISPATCH_DEFAULT_DELAY_MS,
    status: initialData && initialData.status === "active" ? "active" : "draft",
  });

  const montaGrafo = () => {
    const valid = steps.filter((s) => s.image.trim() || s.text.trim());
    return {
      valid,
      draftGraph: buildDispatchGraph({
        steps: valid.map((s) => ({
          ...(s.image.trim() ? { imageMediaUrl: s.image.trim() } : {}),
          ...(s.text.trim() ? { text: s.text.trim() } : {}),
        })),
        typingDelayMs: delayMs,
      }),
    };
  };

  const validaConteudo = (): boolean => {
    const valid = steps.filter((s) => s.image.trim() || s.text.trim());
    if (valid.length === 0) {
      setErro(t("Cadastre ao menos uma mensagem (imagem ou texto)."));
      return false;
    }
    const badIdx = valid.findIndex((s) => s.image.trim() && !classifyDispatchMedia(s.image));
    if (badIdx >= 0) {
      const numero = steps.indexOf(valid[badIdx]!) + 1;
      setErro(
        `${t("A imagem da mensagem")} #${numero} ${t("não pode ser enviada: use URL https ou suba o arquivo pela Galeria.")}`,
      );
      return false;
    }
    return true;
  };

  /** Salvar RASCUNHO: nunca ativa. Nome não exigido (rascunho pode nascer sem). */
  const salvarRascunho = async () => {
    if (!validaConteudo()) return;
    setIsSaving(true);
    setErro(null);
    try {
      const { draftGraph } = montaGrafo();
      if (isCreate) {
        if (!name.trim()) {
          // O POST exige nome (schema): sem nome nem o rascunho nasce.
          setErro(t("Dê um nome ao fluxo para criar o rascunho."));
          setIsSaving(false);
          return;
        }
        const created = await apiClient.post<{ data: { id: string } }>(
          "/api/v1/ai/followup-flows",
          {
            name: name.trim(),
            inbox_enabled: true,
            status: "draft",
            trigger_config: { kind: "manual", cancel_on_reply: false },
            draft_graph: draftGraph,
          },
        );
        await qc.invalidateQueries({ queryKey: followupFlowsListQueryKey });
        toast.success(t("Rascunho criado."));
        router.push(`/app/ai/followups/${created.data.id}`);
        return;
      }
      await apiClient.patch(`/api/v1/ai/followup-flows/${flowId}`, {
        ...(name.trim() ? { name: name.trim() } : {}),
        status: "draft",
        draft_graph: draftGraph,
      });
      await qc.invalidateQueries({ queryKey: followupFlowsListQueryKey });
      await qc.invalidateQueries({ queryKey: followupFlowQueryKey(flowId) });
      setStatus("draft");
      toast.success(t("Rascunho salvo."));
    } catch (err) {
      setErro(
        err instanceof Error && err.message
          ? t(err.message)
          : t("Erro ao salvar. Tente novamente."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  /** Publicar: salva o conteúdo e ativa. Exige nome. */
  const publicar = async () => {
    if (!name.trim()) {
      setErro(t("Dê um nome ao fluxo para publicá-lo."));
      return;
    }
    if (!validaConteudo()) return;
    setIsSaving(true);
    setErro(null);
    try {
      const { draftGraph } = montaGrafo();
      if (isCreate) {
        const created = await apiClient.post<{ data: { id: string } }>(
          "/api/v1/ai/followup-flows",
          {
            name: name.trim(),
            inbox_enabled: true,
            status: "active",
            trigger_config: { kind: "manual", cancel_on_reply: false },
            draft_graph: draftGraph,
          },
        );
        await qc.invalidateQueries({ queryKey: followupFlowsListQueryKey });
        toast.success(t("Fluxo de disparo publicado."));
        router.push(`/app/ai/followups/${created.data.id}`);
        return;
      }
      await apiClient.patch(`/api/v1/ai/followup-flows/${flowId}`, {
        name: name.trim(),
        status: "active",
        draft_graph: draftGraph,
      });
      await qc.invalidateQueries({ queryKey: followupFlowsListQueryKey });
      await qc.invalidateQueries({ queryKey: followupFlowQueryKey(flowId) });
      setStatus("active");
      toast.success(t("Fluxo de disparo publicado."));
    } catch (err) {
      setErro(
        err instanceof Error && err.message
          ? t(err.message)
          : t("Erro ao publicar. Tente novamente."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  /** Desativar: só muda o status (funciona sem nome). */
  const desativar = async () => {
    if (isCreate) return;
    setIsSaving(true);
    setErro(null);
    try {
      await apiClient.patch(`/api/v1/ai/followup-flows/${flowId}`, { status: "draft" });
      await qc.invalidateQueries({ queryKey: followupFlowsListQueryKey });
      await qc.invalidateQueries({ queryKey: followupFlowQueryKey(flowId) });
      setStatus("draft");
      toast.success(t("Fluxo desativado."));
    } catch (err) {
      setErro(err instanceof Error && err.message ? t(err.message) : t("Erro ao desativar."));
    } finally {
      setIsSaving(false);
    }
  };
  const addStep = () => {
    const key = nextKey();
    setSteps((prev) => [...prev, { key, image: "", preview: "", text: "", position: { x: 100, y: 250 } }]);
    setSelectedKey(key);
  };

  const removeStep = (key: string) => {
    setSteps((prev) => {
      const next = prev.filter((s) => s.key !== key);
      return next.length > 0
        ? next
        : [{ key: nextKey(), image: "", preview: "", text: "", position: { x: 100, y: 250 } }];
    });
    if (selectedKey === key) {
      const idx = steps.findIndex((s) => s.key === key);
      const rest = steps.filter((s) => s.key !== key);
      setSelectedKey(rest[Math.max(0, idx - 1)]?.key ?? rest[0]!.key);
    }
  };

  const moveStep = (key: string, dir: -1 | 1) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(j, 0, item!);
      return next;
    });
  };

  const onDropOnStep = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) return;
    setSteps((prev) => {
      const from = prev.findIndex((s) => s.key === dragKey);
      const to = prev.findIndex((s) => s.key === targetKey);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
    setDragKey(null);
  };

  const uploadToSelected = async (file: File) => {
    setErro(null);
    const uploaded = await uploader.uploadFile(file);
    if (!uploaded) {
      setErro(t("Falha no envio da imagem."));
      return;
    }
    patchStep(selected.key, {
      image: uploaded.storage_path || uploaded.url,
      preview: uploaded.url,
    });
  };

  const pickFromGallery = (pick: GaleriaPick) => {
    patchStep(selected.key, {
      image: pick.storage_path,
      preview: pick.preview_url || pick.storage_path,
    });
    setGaleriaOpen(false);
  };

  const stepImage = (s: StepState) => s.image.trim();
  /** O que o `<img>` mostra: preview assinada/https — nunca storage path cru. */
  const stepPreview = (s: StepState) => {
    const p = s.preview.trim();
    if (p) return p;
    const v = s.image.trim();
    return v.startsWith("https://") ? v : "";
  };
  const captionLimit = (s: StepState) => (stepImage(s) ? 1024 : 4000);

  return (
    <div className="flex h-full min-h-[600px] flex-col" data-testid="dispatch-flow-editor">
      {/* Barra topo: voltar + nome | status + salvar (espelha a referência) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href="/app/ai/followups"
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-text-muted hover:bg-muted hover:text-text"
            title={t("Voltar para Fluxos")}
            aria-label={t("Voltar para Fluxos")}
          >
            <CaretLeft size={14} />
          </Link>
          <span className="text-xs text-text-muted">{t("Fluxos")}</span>
          <span className="text-xs text-text-muted">/</span>
          <h1 className="text-sm font-semibold text-text">
            {isCreate ? t("Novo fluxo de disparo") : name || initialData?.name}
          </h1>
          <FlowStatusBadge status={status} />
          {dirty && (
            <Badge variant="warning" data-testid="dirty-indicator">
              {t("Alterações não salvas")}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCreate && (
            <DeleteFollowupFlowButton flowId={flowId} flowName={name} redirectToList />
          )}
          {/* Rascunho primeiro: salvar nunca ativa; publicar é decisão explícita. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => void salvarRascunho()}
          >
            {isSaving ? t("Salvando…") : t("Salvar rascunho")}
          </Button>
          {status === "active" && !isCreate ? (
            <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={() => void desativar()}>
              {t("Desativar")}
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={isSaving} onClick={() => void publicar()}>
              {isSaving ? t("Publicando…") : isCreate ? t("Criar e publicar") : t("Publicar")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Painel de configuração (esquerda, como a referência) */}
        <aside className="w-full shrink-0 space-y-4 overflow-y-auto border-b border-border p-4 lg:w-80 lg:border-b-0 lg:border-r">
          <div className="space-y-2">
            <Label htmlFor="dispatch-name">{t("Nome do fluxo")}</Label>
            <Input
              id="dispatch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={t("Ex: Scooter Elétrica 1000W - Oferta")}
            />
          </div>

          {/* "Digitando por N segundos" da referência (0–30s). */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label htmlFor="dispatch-delay" className="flex items-center gap-1.5 text-xs">
              <span className="text-primary">{t("Digitando")}</span> {t("por")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="dispatch-delay"
                type="number"
                min={0}
                max={DISPATCH_MAX_DELAY_MS / 1000}
                step={0.5}
                value={delayMs / 1000}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  if (!Number.isFinite(s)) return;
                  setDelayMs(Math.min(DISPATCH_MAX_DELAY_MS, Math.max(0, Math.round(s * 1000))));
                }}
                className="w-20"
              />
              <span className="text-xs text-text-muted">{t("segundos")}</span>
            </div>
            <p className="text-[11px] text-text-muted">
              {t("O cliente vê “digitando…” neste intervalo entre as mensagens.")}
            </p>
          </div>

          {/* Passo selecionado: imagem + texto juntos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                {t("Mensagem")} #{steps.findIndex((s) => s.key === selected.key) + 1}
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveStep(selected.key, -1)}
                  title={t("Subir na ordem de envio")}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveStep(selected.key, 1)}
                  title={t("Descer na ordem de envio")}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => removeStep(selected.key)}
                  title={t("Excluir mensagem")}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("Imagem (opcional)")}</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGaleriaOpen(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Images size={12} />
                  {t("Galeria")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUrlInput((p) => !p)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <LinkIcon size={12} />
                  {showUrlInput ? t("Upload") : t("URL")}
                </button>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadToSelected(file);
              }}
              accept="image/*"
              className="hidden"
            />
            {stepImage(selected) ? (
              <div className="space-y-2">
                {stepPreview(selected) ? (
                  <>
                    {/* Proporção ORIGINAL: contain + altura automática — retrato
                        continua retrato, paisagem continua paisagem. O envio
                        nunca cortou (só a prévia cortava com object-cover). */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={stepPreview(selected)}
                      alt={t("Prévia da imagem")}
                      className="h-auto max-h-96 w-full rounded-md border border-border object-contain"
                    />
                  </>
                ) : (
                  <p className="rounded-md border border-dashed border-border p-3 text-xs text-text-muted">
                    {t("Imagem salva — a prévia carrega em instantes.")}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploader.isUploading}
                  >
                    {uploader.isUploading ? (
                      <Loader2 size={12} className="mr-1 animate-spin" />
                    ) : (
                      <Upload size={12} className="mr-1" />
                    )}
                    {t("Trocar")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => patchStep(selected.key, { image: "", preview: "" })}
                    disabled={uploader.isUploading}
                  >
                    <X size={12} className="mr-1" />
                    {t("Remover")}
                  </Button>
                </div>
              </div>
            ) : showUrlInput ? (
              <Input
                value={selected.image}
                onChange={(e) => {
                  const v = e.target.value;
                  patchStep(selected.key, {
                    image: v,
                    preview: v.trim().startsWith("https://") ? v.trim() : "",
                  });
                }}
                placeholder={t("https://... URL pública da imagem")}
              />
            ) : (
              <button
                type="button"
                onClick={() => !uploader.isUploading && fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/70"
              >
                {uploader.isUploading ? (
                  <Loader2 size={20} className="animate-spin text-primary" />
                ) : (
                  <Upload size={20} className="text-primary" />
                )}
                <span className="text-xs text-text-muted">{t("PNG, JPG, WEBP até 15MB")}</span>
              </button>
            )}

            <div className="space-y-2 pt-1">
              <Label htmlFor="dispatch-step-text" className="text-xs">
                {stepImage(selected) ? t("Legenda (vai junto da imagem)") : t("Texto")}
              </Label>
              <Textarea
                id="dispatch-step-text"
                value={selected.text}
                onChange={(e) => patchStep(selected.key, { text: e.target.value })}
                rows={5}
                maxLength={captionLimit(selected)}
                placeholder={t("Ex: 12x de R$ 825,00 no cartão…")}
              />
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addStep}>
            <Plus size={14} className="mr-1" />
            {t("Adicionar mensagem")}
          </Button>

          {erro && (
            <p role="alert" className="text-sm text-error-fg">
              {erro}
            </p>
          )}
        </aside>

        {/* Canvas: cartões encadeados e REORDENÁVEIS por arrasto */}
        <div className="flex flex-1 flex-col items-center gap-0 overflow-y-auto bg-muted/20 p-6">
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-text-muted">
            <Play size={12} className="text-primary" />
            {t("Início")}
          </span>
          <span className="h-6 w-px bg-border" aria-hidden />

          {steps.map((s, i) => (
            <div key={s.key} className="flex w-full max-w-sm flex-col items-center">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedKey(s.key)}
                onKeyDown={(e) => e.key === "Enter" && setSelectedKey(s.key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropOnStep(s.key)}
                className={`w-full rounded-xl border-2 bg-background p-3 text-left transition-colors ${
                  selected.key === s.key ? "border-primary" : "border-border hover:border-primary/50"
                } ${dragKey === s.key ? "opacity-50" : ""}`}
              >
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text">
                  <span
                    draggable
                    onDragStart={() => setDragKey(s.key)}
                    onDragEnd={() => setDragKey(null)}
                    className="cursor-grab text-text-muted hover:text-text"
                    title={t("Arrastar para reordenar")}
                  >
                    <GripVertical size={14} />
                  </span>
                  {s.image.trim() ? (
                    <ImageIcon size={14} className="text-primary" />
                  ) : null}
                  {t("Mensagem")} #{i + 1}
                  {s.image.trim() && s.text.trim()
                    ? t("· Imagem + legenda")
                    : s.image.trim()
                      ? t("· Imagem")
                      : t("· Texto")}
                </p>
                {s.image.trim() ? (
                  stepPreview(s) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={stepPreview(s)}
                      alt=""
                      className="mb-2 h-auto max-h-[28rem] w-full rounded-lg border border-border object-contain"
                    />
                  ) : (
                    <p className="mb-2 rounded-lg border border-dashed border-border p-3 text-xs text-text-muted">
                      {t("Imagem salva — a prévia carrega em instantes.")}
                    </p>
                  )
                ) : null}
                <p className="whitespace-pre-wrap text-sm text-text">
                  {s.text.trim() || t("Clique para configurar…")}
                </p>
              </div>
              <span className="h-6 w-px bg-border" aria-hidden />
              {i < steps.length - 1 ? (
                <>
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] text-text-muted">
                    {t("Digitando por")} {formatDelay(delayMs)}
                  </span>
                  <span className="h-6 w-px bg-border" aria-hidden />
                </>
              ) : null}
            </div>
          ))}

          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-text-muted">
            {t("Fim")}
          </span>
        </div>
      </div>

      <SeletorDaGaleria
        open={galeriaOpen}
        onOpenChange={setGaleriaOpen}
        onPick={pickFromGallery}
      />
    </div>
  );
}
