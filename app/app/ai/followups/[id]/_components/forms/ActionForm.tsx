"use client";

import { useState } from "react";
import {
  ChatCircle,
  ImageSquare,
  VideoCamera,
  FileText,
  Clock,
  Plus,
  Trash,
  UploadSimple,
  X as ClearIcon,
  CircleNotch,
  Code,
  Smiley,
} from "@phosphor-icons/react/dist/ssr";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { actionConfigSchema } from "@/lib/followup/graph-schema";
import { MODOS_DA_ACAO, opcoes, type ModoDaAcao } from "@/lib/followup/vocabulario";
import { useMessageTemplates } from "@/hooks/inbox/useMessageTemplates";
import { useT } from "@/hooks/i18n/useT";

import type { ConfigOf } from "./shared";

function SeletorDeModelo({
  id,
  valor,
  onChange,
  permiteVazio,
}: {
  id: string;
  valor: string;
  onChange: (templateId: string) => void;
  permiteVazio: boolean;
}) {
  const t = useT();
  const { data: modelos, isLoading, isError } = useMessageTemplates();

  if (isLoading) return <p className="text-xs text-text-muted">{t("Carregando seus modelos…")}</p>;
  if (isError) {
    return (
      <p className="text-xs text-error-fg">
        {t("Não consegui carregar seus modelos de mensagem. Recarregue a página.")}
      </p>
    );
  }
  if (!modelos?.length) {
    return (
      <p className="text-xs text-text-muted">
        {t("Você ainda não tem modelos de mensagem. Crie um em Ajustes → Modelos e ele aparece aqui.")}
      </p>
    );
  }

  const SEM_MODELO = "__nenhum__";
  return (
    <Select
      value={valor === "" ? SEM_MODELO : valor}
      onValueChange={(v) => onChange(v === SEM_MODELO ? "" : v)}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={t("Escolha um modelo")} />
      </SelectTrigger>
      <SelectContent>
        {permiteVazio && <SelectItem value={SEM_MODELO}>{t("Nenhum")}</SelectItem>}
        {modelos.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ActionForm({
  config,
  onChange,
}: {
  config: ConfigOf<"action">;
  onChange: (c: ConfigOf<"action">) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState(config.mode);
  const [body, setBody] = useState(config.mode === "text" ? config.body : "");
  const [mediaUrl, setMediaUrl] = useState(
    config.mode === "text" ? (config as { media_url?: string }).media_url ?? "" : "",
  );
  const [isUploading, setIsUploading] = useState(false);
  const [promptHint, setPromptHint] = useState(config.mode === "ai_message" ? config.prompt_hint : "");
  const [fallbackTemplateId, setFallbackTemplateId] = useState(
    config.mode === "ai_message" ? (config.fallback_template_id ?? "") : "",
  );
  const [templateId, setTemplateId] = useState(config.mode === "template" ? config.template_id : "");
  const [error, setError] = useState<string | null>(null);

  const commit = (next: {
    mode: ModoDaAcao;
    body: string;
    mediaUrl: string;
    promptHint: string;
    fallbackTemplateId: string;
    templateId: string;
  }) => {
    const candidate =
      next.mode === "text"
        ? {
            mode: "text" as const,
            body: next.body,
            ...(next.mediaUrl.trim() ? { media_url: next.mediaUrl.trim() } : {}),
          }
        : next.mode === "ai_message"
          ? {
              mode: "ai_message" as const,
              prompt_hint: next.promptHint,
              ...(next.fallbackTemplateId.trim() ? { fallback_template_id: next.fallbackTemplateId } : {}),
            }
          : { mode: "template" as const, template_id: next.templateId };

    const parsed = actionConfigSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("Configuração inválida."));
      return;
    }
    setError(null);
    onChange(parsed.data);
  };

  const fields = { body, mediaUrl, promptHint, fallbackTemplateId, templateId };

  const insertVariable = (variable: string) => {
    const updated = body ? `${body} ${variable}` : variable;
    setBody(updated);
    commit({ mode, ...fields, body: updated });
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/ai/followup-flows/upload-media", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.data) {
        throw new Error(json.error?.message || "Erro ao fazer upload da imagem.");
      }

      const url = json.data.url || json.data.storage_path;
      setMediaUrl(url);
      commit({ mode, ...fields, mediaUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item?.type.includes("image")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void handleFileUpload(file);
          break;
        }
      }
    }
  };

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      {/* Seletor de Tipo de Mensagem / Canal (estilo Image 4) */}
      <div className="space-y-1.5">
        <Label htmlFor="channel-type" className="text-xs font-semibold text-text-muted">
          {t("Tipo de Mensagem")}
        </Label>
        <Select defaultValue="whatsapp">
          <SelectTrigger id="channel-type" className="h-9 rounded-xl">
            <SelectValue placeholder="WhatsApp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="instagram">Instagram Direct</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="action-mode" className="text-xs font-semibold text-text-muted">
          {t("Modo de Envio")}
        </Label>
        <Select
          value={mode}
          onValueChange={(v) => {
            const next = v as ModoDaAcao;
            setMode(next);
            commit({ mode: next, ...fields });
          }}
        >
          <SelectTrigger id="action-mode" className="h-9 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes(MODOS_DA_ACAO).map(({ valor, rotulo }) => (
              <SelectItem key={valor} value={valor}>
                {t(rotulo)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === "text" ? (
        <>
          {/* Card Editor de Mensagem com Textarea e Variáveis (Image 4) */}
          <div className="rounded-2xl border border-primary/30 bg-surface p-3 shadow-xs space-y-2.5">
            <div className="relative">
              <Textarea
                id="action-body"
                maxLength={4000}
                rows={4}
                value={body}
                placeholder={t("Mensagem...")}
                className="resize-none border-none p-0 focus-visible:ring-0 text-xs text-text shadow-none bg-transparent"
                onChange={(e) => {
                  setBody(e.target.value);
                  commit({ mode, ...fields, body: e.target.value });
                }}
              />
              <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-2">
                <span className="text-[10px] text-text-muted">
                  {body.length} / 4000
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md text-text-muted hover:text-text hover:bg-muted"
                    onClick={() => insertVariable("😊")}
                    title={t("Inserir emoji")}
                  >
                    <Smiley size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md text-text-muted hover:text-text hover:bg-muted"
                    onClick={() => insertVariable("{{primeiro_nome}}")}
                    title={t("Inserir variável")}
                  >
                    <Code size={14} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Chips de Variáveis Rápidas */}
            <div className="flex flex-wrap gap-1 border-t border-border/30 pt-2">
              {[
                { tag: "{{primeiro_nome}}", label: "Nome" },
                { tag: "{{telefone}}", label: "Telefone" },
                { tag: "{{empresa}}", label: "Empresa" },
                { tag: "{{email}}", label: "E-mail" },
              ].map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag)}
                  className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-text-muted hover:bg-accent/20 hover:text-accent transition-colors"
                >
                  +{v.label}
                </button>
              ))}
            </div>

            {/* Botões Rápidos de Ação (Image 4) */}
            <div className="space-y-1.5 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-center text-xs h-8 rounded-xl font-medium"
                onClick={() => insertVariable("\n[1] Falar com Atendente")}
              >
                <Plus size={13} className="mr-1" />
                {t("Adicionar Botão")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-center text-xs h-8 rounded-xl font-normal text-text-muted hover:text-text"
                onClick={() => insertVariable("\n[Opção 1] Sim | [Opção 2] Não")}
              >
                + {t("Resposta Rápida")}
              </Button>
            </div>
          </div>

          {/* Anexo de Imagem (opcional) */}
          <div className="space-y-2 rounded-2xl border border-border/80 p-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <ImageSquare size={16} className="text-primary" />
                {t("Imagem / Mídia")}
              </Label>
              {mediaUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive"
                  onClick={() => {
                    setMediaUrl("");
                    commit({ mode, ...fields, mediaUrl: "" });
                  }}
                >
                  <ClearIcon size={12} className="mr-1" />
                  {t("Remover")}
                </Button>
              )}
            </div>

            {mediaUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-border bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="Preview" className="h-32 w-full object-cover rounded-xl" />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    placeholder={t("Cole a URL da imagem ou dê Ctrl+V...")}
                    value={mediaUrl}
                    className="text-xs h-9 rounded-xl"
                    onChange={(e) => {
                      const val = e.target.value;
                      setMediaUrl(val);
                      commit({ mode, ...fields, mediaUrl: val });
                    }}
                  />
                  <label className="cursor-pointer shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFileUpload(file);
                      }}
                    />
                    <div className="flex h-9 items-center gap-1 rounded-xl border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground">
                      {isUploading ? (
                        <CircleNotch size={14} className="animate-spin" />
                      ) : (
                        <UploadSimple size={14} />
                      )}
                      <span>{t("Upload")}</span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        </>
      ) : mode === "ai_message" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="action-prompt-hint" className="text-xs font-semibold text-text-muted">
              {t("Instrução para a IA")}
            </Label>
            <Textarea
              id="action-prompt-hint"
              maxLength={1000}
              rows={4}
              className="rounded-xl text-xs"
              value={promptHint}
              placeholder={t("Ex: Parabenizar o cliente pelo interesse e perguntar se prefere atendimento online ou presencial.")}
              onChange={(e) => {
                setPromptHint(e.target.value);
                commit({ mode, ...fields, promptHint: e.target.value });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action-fallback" className="text-xs font-semibold text-text-muted">
              {t("Fallback: Se a IA falhar, enviar este modelo")}
            </Label>
            <SeletorDeModelo
              id="action-fallback"
              valor={fallbackTemplateId}
              permiteVazio
              onChange={(v) => {
                setFallbackTemplateId(v);
                commit({ mode, ...fields, fallbackTemplateId: v });
              }}
            />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="action-template-id" className="text-xs font-semibold text-text-muted">
            {t("Modelo de Mensagem (WhatsApp HSM)")}
          </Label>
          <SeletorDeModelo
            id="action-template-id"
            valor={templateId}
            permiteVazio={false}
            onChange={(v) => {
              setTemplateId(v);
              commit({ mode, ...fields, templateId: v });
            }}
          />
        </div>
      )}
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
