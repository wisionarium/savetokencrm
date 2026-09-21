"use client";

import { useEffect, useState } from "react";
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
import { followupFlowsListQueryKey, type FollowupFlowPointerRow } from "@/hooks/followup/useFollowupFlows";
import type { FlowGraph } from "@/lib/followup/graph-schema";
import { Image } from "lucide-react";

interface Props {
  flow: FollowupFlowPointerRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDispatchFlowDialog({ flow, open, onOpenChange }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!flow || !open) return;
    setName(flow.name);
    setErro(null);
    setIsLoading(true);

    apiClient
      .get<{ data: { draft_graph?: FlowGraph; active_version_id?: string } }>(`/api/v1/ai/followup-flows/${flow.id}`)
      .then((res) => {
        const graph = res.data?.draft_graph;
        if (graph?.nodes) {
          const imgNode = graph.nodes.find(
            (n) =>
              n.label === "Imagem do produto" ||
              (n as unknown as { data?: { media_storage_path?: string } }).data?.media_storage_path,
          );
          const textNode = graph.nodes.find(
            (n) => n.label === "Especificações" || (n.type === "action" && n !== imgNode),
          );

          let path = (imgNode as unknown as { data?: { media_storage_path?: string } })?.data?.media_storage_path ?? "";
          if (!path && imgNode && imgNode.type === "action" && imgNode.config.mode === "text") {
            path = imgNode.config.body;
          }
          setImageUrl(path && !path.startsWith("Imagem do") ? path : "");

          let specs = "";
          if (textNode && textNode.type === "action" && textNode.config.mode === "text") {
            specs = textNode.config.body;
          }
          setSpecifications(specs);
        }
      })
      .catch(() => {
        // ignore load error
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [flow, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flow || !name.trim()) return;

    setIsSubmitting(true);
    setErro(null);

    try {
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

      await apiClient.patch(`/api/v1/ai/followup-flows/${flow.id}`, {
        name: name.trim(),
        draft_graph: draftGraph,
      });

      await qc.invalidateQueries({ queryKey: followupFlowsListQueryKey });
      toast.success(t("Fluxo de disparo atualizado."));
      onOpenChange(false);
    } catch (err) {
      setErro(
        err instanceof Error && err.message
          ? t(err.message)
          : t("Erro ao atualizar fluxo de disparo."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Editar fluxo de disparo")}</DialogTitle>
          <DialogDescription>
            {t("Altere o nome, imagem ou o texto de especificações deste fluxo de disparo.")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("Carregando...")}</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-flow-name">{t("Nome do fluxo")}</Label>
              <Input
                id="edit-flow-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-flow-image">{t("URL ou Caminho da Imagem")}</Label>
              <div className="relative">
                <Image size={16} className="absolute left-3 top-3 text-muted-foreground" />
                <Input
                  id="edit-flow-image"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... ou caminho no Supabase"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-flow-specs">{t("Texto com Especificações")}</Label>
              <Textarea
                id="edit-flow-specs"
                value={specifications}
                onChange={(e) => setSpecifications(e.target.value)}
                rows={4}
                required
              />
            </div>

            {erro && <p role="alert" className="text-sm text-error-fg">{erro}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                {t("Cancelar")}
              </Button>
              <Button type="submit" disabled={isSubmitting || !name.trim() || !specifications.trim()}>
                {isSubmitting ? t("Salvando...") : t("Salvar alterações")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
