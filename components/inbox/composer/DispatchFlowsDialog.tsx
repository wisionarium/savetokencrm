"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useT } from "@/hooks/i18n/useT";
import { useFollowupFlows } from "@/hooks/followup/useFollowupFlows";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlowArrow, MagnifyingGlass, PaperPlaneTilt } from "@/lib/ui/icons";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function DispatchFlowsDialog({ open, onOpenChange, conversationId }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const { data: flows, isPending } = useFollowupFlows();
  const [search, setSearch] = useState("");

  const dispatchMutation = useMutation({
    mutationFn: async (pointerId: string) => {
      const res = await apiClient.post<{ data: { dispatched: boolean; flow_name: string } }>(
        `/api/v1/conversations/${conversationId}/dispatch-flow`,
        { pointer_id: pointerId }
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(t(`Fluxo "${data.flow_name}" disparado com sucesso!`));
      qc.invalidateQueries({ queryKey: ["conversation", conversationId, "messages"] });
      onOpenChange(false);
      setSearch("");
    },
    onError: (err) => {
      showApiError(err);
    },
  });

  // Filtrar apenas os fluxos ATIVOS e HABILITADOS para Caixa de Entrada
  const activeInboxFlows = (flows ?? []).filter(
    (f) => f.status === "active" && f.inbox_enabled
  );

  const filteredFlows = activeInboxFlows.filter((f) =>
    f.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlowArrow size={20} className="text-primary" />
            {t("Fluxos de Disparo")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Pesquisar fluxo de disparo...")}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto flex flex-col gap-2 pr-1">
            {isPending ? (
              <p className="py-6 text-center text-xs text-muted-foreground">{t("Carregando fluxos…")}</p>
            ) : filteredFlows.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {activeInboxFlows.length === 0
                  ? t("Nenhum fluxo ativo habilitado para a Caixa de Entrada.")
                  : t("Nenhum fluxo encontrado com esse termo.")}
              </div>
            ) : (
              filteredFlows.map((flow) => (
                <Card
                  key={flow.id}
                  className="flex items-center justify-between p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">{flow.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {flow.active_version_id ? t("Pronto para envio") : t("Rascunho")}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    disabled={dispatchMutation.isPending}
                    onClick={() => dispatchMutation.mutate(flow.id)}
                  >
                    <PaperPlaneTilt size={14} className="mr-1.5" />
                    {t("Enviar")}
                  </Button>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
