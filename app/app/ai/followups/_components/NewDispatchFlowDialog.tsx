"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, X, Loader2, Link as LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { followupFlowsListQueryKey } from "@/hooks/followup/useFollowupFlows";
import type { FlowGraph } from "@/lib/followup/graph-schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewDispatchFlowDialog({ open, onOpenChange }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [storagePath, setStoragePath] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [mediaMime, setMediaMime] = useState("image/jpeg");
  const [fileName, setFileName] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setImageUrl("");
    setStoragePath("");
    setPreviewUrl("");
    setMediaMime("image/jpeg");
    setFileName("");
    setSpecifications("");
    setShowUrlInput(false);
    setIsUploading(false);
    setErro(null);
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("Selecione um arquivo de imagem válido (PNG, JPG, WEBP)."));
      return;
    }

    setIsUploading(true);
    setErro(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/ai/followup-flows/upload-media", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.data) {
        throw new Error(json.error?.message || t("Erro ao fazer upload da imagem."));
      }

      const { storage_path, url, mime, name: uploadedName } = json.data;
      setStoragePath(storage_path);
      setPreviewUrl(url);
      setImageUrl(url || storage_path);
      setMediaMime(mime || file.type || "image/jpeg");
      setFileName(uploadedName || file.name);
      toast.success(t("Imagem carregada com sucesso!"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("Falha no envio da imagem.");
      setErro(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void uploadFile(file);
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
          void uploadFile(file);
          break;
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      void uploadFile(file);
    }
  };

  const removeImage = () => {
    setImageUrl("");
    setStoragePath("");
    setPreviewUrl("");
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !specifications.trim()) return;

    setIsSubmitting(true);
    setErro(null);

    const activeImage = previewUrl || imageUrl || storagePath;

    try {
      // Montar o grafo de disparo: Imagem -> Espera 2.6s -> Especificações
      const draftGraph: FlowGraph = {
        nodes: [
          {
            id: "node_trigger",
            type: "trigger",
            label: "Disparo manual",
            position: { x: 100, y: 100 },
            config: {},
          },
          {
            id: "node_image",
            type: "action",
            label: "Imagem do produto",
            position: { x: 100, y: 250 },
            config: {
              mode: "text",
              body: "Imagem do produto",
              ...(activeImage.trim() ? { media_url: activeImage.trim() } : {}),
            },
          },
          {
            id: "node_wait",
            type: "wait",
            label: "Aguardar 2.6s",
            position: { x: 100, y: 400 },
            config: {
              mode: "fixed",
              duration_ms: 2600,
            },
          },
          {
            id: "node_specs",
            type: "action",
            label: "Especificações",
            position: { x: 100, y: 550 },
            config: {
              mode: "text",
              body: specifications.trim(),
            },
          },
          {
            id: "node_end",
            type: "end",
            label: "Fim",
            position: { x: 100, y: 700 },
            config: { outcome: "converted" },
          },
        ],
        edges: [
          { id: "e1", source: "node_trigger", target: "node_image", condition: { type: "always" }, priority: 0 },
          { id: "e2", source: "node_image", target: "node_wait", condition: { type: "always" }, priority: 0 },
          { id: "e3", source: "node_wait", target: "node_specs", condition: { type: "always" }, priority: 0 },
          { id: "e4", source: "node_specs", target: "node_end", condition: { type: "always" }, priority: 0 },
        ],
      };

      await apiClient.post("/api/v1/ai/followup-flows", {
        name: name.trim(),
        inbox_enabled: true,
        status: "active",
        trigger_config: { kind: "manual", cancel_on_reply: false },
        draft_graph: draftGraph,
      });

      await qc.invalidateQueries({ queryKey: followupFlowsListQueryKey });
      toast.success(t("Fluxo de disparo criado com sucesso."));
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setErro(
        err instanceof Error && err.message
          ? t(err.message)
          : t("Erro ao criar fluxo de disparo. Tente novamente.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasImage = Boolean(previewUrl || imageUrl || storagePath);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg" onPaste={handlePaste}>
        <DialogHeader>
          <DialogTitle>{t("Novo fluxo de disparo")}</DialogTitle>
          <DialogDescription>
            {t("Cadastre o nome, a imagem e o texto de especificações. Os atendentes poderão disparar no chat enviando a imagem e a legenda com 2.6s de intervalo.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="flow-name">{t("Nome do fluxo")}</Label>
            <Input
              id="flow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Ex: Scooter Elétrica 1000W - Oferta")}
              maxLength={80}
              required
              autoFocus
            />
          </div>

          {/* Área de Upload de Imagem / Galeria */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("Imagem do produto")}</Label>
              <button
                type="button"
                onClick={() => setShowUrlInput((prev) => !prev)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <LinkIcon size={12} />
                {showUrlInput ? t("Upload por arquivo") : t("Ou colar URL da imagem")}
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {hasImage ? (
              <div className="relative flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-border bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl || imageUrl}
                    alt="Prévia"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col min-w-0 gap-1">
                  <span className="text-xs font-medium truncate">
                    {fileName || t("Imagem selecionada")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {t("Pronta para envio no WhatsApp")}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Upload size={12} className="mr-1" />
                      {t("Trocar imagem")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                      onClick={removeImage}
                      disabled={isUploading}
                    >
                      <X size={12} className="mr-1" />
                      {t("Remover")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : showUrlInput ? (
              <div className="space-y-1.5">
                <div className="relative">
                  <ImageIcon size={16} className="absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    id="flow-image"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setPreviewUrl(e.target.value);
                    }}
                    placeholder="https://... URL pública da imagem"
                    className="pl-9"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("Cole um link público direto de imagem.")}
                </p>
              </div>
            ) : (
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="group relative flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/70 transition-colors cursor-pointer bg-muted/10 hover:bg-muted/20 text-center"
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("Enviando imagem...")}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="rounded-full bg-primary/10 p-2.5 text-primary group-hover:scale-105 transition-transform">
                      <Upload size={20} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-foreground">
                        {t("Carregar imagem da galeria ou arquivo")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {t("PNG, JPG, WEBP até 15MB · Arraste ou use Ctrl+V")}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="flow-specs">{t("Texto com Especificações")}</Label>
            <Textarea
              id="flow-specs"
              value={specifications}
              onChange={(e) => setSpecifications(e.target.value)}
              placeholder={t("Ex: Ficha técnica:\n- Motor 1000W\n- Autonomia: 45km\n- Valor: R$ 5.990,00")}
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("Este texto será enviado automaticamente 2,6 segundos após a imagem.")}
            </p>
          </div>

          {erro && (
            <p role="alert" className="text-sm text-error-fg">
              {erro}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isUploading}
            >
              {t("Cancelar")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploading || !name.trim() || !specifications.trim()}
            >
              {isSubmitting ? t("Criando...") : t("Criar fluxo de disparo")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
