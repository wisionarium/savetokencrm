"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import { Image } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewDispatchFlowDialog({ open, onOpenChange }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setImageUrl("");
    setSpecifications("");
    setErro(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !specifications.trim()) return;

    setIsSubmitting(true);
    setErro(null);

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
              body: imageUrl.trim() ? imageUrl.trim() : "Imagem do produto",
            },
            ...(imageUrl.trim()
              ? {
                  data: {
                    media_storage_path: imageUrl.trim(),
                    media_type: "image",
                    media_mime: "image/jpeg",
                  },
                }
              : {}),
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
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

          <div className="space-y-2">
            <Label htmlFor="flow-image">{t("URL ou Caminho da Imagem")}</Label>
            <div className="relative">
              <Image size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <Input
                id="flow-image"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... ou caminho da imagem"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("URL pública da imagem ou caminho de mídia. Se deixado em branco, enviará apenas o texto.")}
            </p>
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
              disabled={isSubmitting}
            >
              {t("Cancelar")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || !specifications.trim()}
            >
              {isSubmitting ? t("Criando...") : t("Criar fluxo de disparo")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
