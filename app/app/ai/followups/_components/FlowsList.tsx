"use client";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { FlowArrow, Plus, Sparkle, Info, Copy, TreeStructure } from "@/lib/ui/icons";
import { useFollowupFlows, useUpdateFollowupFlow, type FollowupFlowPointerRow } from "@/hooks/followup/useFollowupFlows";
import { useDuplicateFollowupFlow } from "@/hooks/followup/useFollowupFlow";
import { DeleteFollowupFlowButton } from "./DeleteFollowupFlowButton";
import { FlowStatusBadge } from "./FlowStatusBadge";
import { ModelosDialog } from "./ModelosDialog";
import { NewFlowDialog } from "./NewFlowDialog";
import { NewDispatchFlowDialog } from "./NewDispatchFlowDialog";
import { EditDispatchFlowDialog } from "./EditDispatchFlowDialog";

interface Props {
  initialData: FollowupFlowPointerRow[];
  canWrite: boolean;
  filterMode?: "disparo" | "ai";
}

function formatUpdatedAt(iso: string, idioma: string): string {
  return new Date(iso).toLocaleDateString(idioma, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function FlowsList({ initialData, canWrite, filterMode = "ai" }: Props) {
  const tagDoIdioma = useTagDeIdioma();
  const t = useT();
  const { data } = useFollowupFlows({ initialData });
  const updateFlow = useUpdateFollowupFlow();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDispatchOpen, setNewDispatchOpen] = useState(false);
  const [editDispatchFlow, setEditDispatchFlow] = useState<FollowupFlowPointerRow | null>(null);
  const [modelosOpen, setModelosOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allFlows = data ?? [];

  // Filtrar os fluxos de acordo com a aba ativa
  const flows =
    filterMode === "disparo"
      ? allFlows.filter((f) => f.inbox_enabled)
      : allFlows.filter((f) => !f.inbox_enabled);

  const modelosButton = (
    <Button onClick={() => setModelosOpen(true)} className="w-full sm:w-auto">
      <Sparkle size={14} aria-hidden className="mr-2" /> {t("Começar de um modelo")}
    </Button>
  );

  const newFlowButton = filterMode === "disparo" ? (
    <Button onClick={() => setNewDispatchOpen(true)} className="w-full sm:w-auto">
      <Plus size={14} aria-hidden className="mr-2" /> {t("Novo fluxo de disparo")}
    </Button>
  ) : (
    <Button onClick={() => setDialogOpen(true)} variant="outline" className="w-full sm:w-auto">
      <Plus size={14} aria-hidden className="mr-2" /> {t("Novo fluxo de IA")}
    </Button>
  );

  const dialogos = canWrite && (
    <>
      <NewFlowDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <NewDispatchFlowDialog open={newDispatchOpen} onOpenChange={setNewDispatchOpen} />
      <EditDispatchFlowDialog
        flow={editDispatchFlow}
        open={!!editDispatchFlow}
        onOpenChange={(open) => !open && setEditDispatchFlow(null)}
      />
      <ModelosDialog
        open={modelosOpen}
        onOpenChange={setModelosOpen}
        nomesExistentes={allFlows.map((f) => f.name)}
      />
    </>
  );

  const toggleAll = () => {
    if (selectedIds.length === flows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(flows.map((f) => f.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const duplicateFlow = useDuplicateFollowupFlow();

  const handleToggleStatus = async (flow: FollowupFlowPointerRow) => {
    const nextStatus = flow.status === "active" ? "disabled" : "active";
    await updateFlow.mutateAsync({
      id: flow.id,
      patch: { status: nextStatus },
    });
  };

  const handleToggleInbox = async (flow: FollowupFlowPointerRow) => {
    await updateFlow.mutateAsync({
      id: flow.id,
      patch: { inbox_enabled: !flow.inbox_enabled },
    });
  };

  if (flows.length === 0) {
    return (
      <>
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <FlowArrow size={36} aria-hidden className="text-text-muted" />
          <h2 className="font-medium">
            {filterMode === "disparo"
              ? t("Nenhum fluxo de disparo cadastrado")
              : t("Nenhum fluxo automáticos de IA ainda")}
          </h2>
          <p className="max-w-sm text-sm text-text-muted">
            {filterMode === "disparo"
              ? t("Crie fluxos de imagem + especificações para os atendentes dispararem facilmente no chat.")
              : t("Follow-ups automáticos reengajam contatos após silêncio ou mudança de etapa.")}
          </p>
          {canWrite && (
            <div className="mt-1 flex flex-col items-center gap-2 sm:flex-row">
              {filterMode === "ai" && modelosButton}
              {newFlowButton}
            </div>
          )}
        </Card>
        {dialogos}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {filterMode === "ai" && modelosButton}
          {newFlowButton}
        </div>
      )}

      {filterMode === "disparo" ? (
        /* Tabela de Fluxos de Disparo */
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                      checked={flows.length > 0 && selectedIds.length === flows.length}
                      onChange={toggleAll}
                      aria-label={t("Selecionar todos")}
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold text-foreground">{t("Nome")}</th>
                  <th className="w-36 px-4 py-3 text-center font-semibold text-foreground">{t("Estado")}</th>
                  <th className="w-44 px-4 py-3 text-center font-semibold text-foreground">
                    <div className="flex items-center justify-center gap-1">
                      <span>{t("Caixa de Entrada")}</span>
                      <span title={t("Habilita a exibição e disparo manual deste fluxo no chat do operador")}>
                        <Info size={14} className="text-muted-foreground" />
                      </span>
                    </div>
                  </th>
                  <th className="w-36 px-4 py-3 text-right font-semibold text-foreground">{t("Atualizado")}</th>
                  {canWrite && <th className="w-36 px-4 py-3 text-center font-semibold text-foreground">{t("Ações")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flows.map((flow) => {
                  const isSelected = selectedIds.includes(flow.id);
                  const isActive = flow.status === "active";

                  return (
                    <tr key={flow.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(flow.id)}
                          aria-label={`Selecionar ${flow.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/app/ai/followups/${flow.id}`}
                          className="font-medium text-foreground hover:underline hover:text-primary flex items-center gap-1.5"
                        >
                          <span>{flow.name}</span>
                          <TreeStructure size={13} className="text-muted-foreground opacity-70" />
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => handleToggleStatus(flow)}
                            disabled={!canWrite || updateFlow.isPending}
                            aria-label={`Estado de ${flow.name}`}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={!!flow.inbox_enabled}
                            onCheckedChange={() => handleToggleInbox(flow)}
                            disabled={!canWrite || updateFlow.isPending}
                            aria-label={`Caixa de entrada para ${flow.name}`}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                        {formatUpdatedAt(flow.updated_at, tagDoIdioma)}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Link href={`/app/ai/followups/${flow.id}`}>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title={t("Abrir editor de nodes")}
                              >
                                <TreeStructure size={15} />
                              </Button>
                            </Link>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => duplicateFlow.mutate(flow.id)}
                              disabled={duplicateFlow.isPending}
                              title={t("Duplicar fluxo")}
                            >
                              <Copy size={15} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditDispatchFlow(flow)}
                              title={t("Edição rápida")}
                            >
                              <Pencil size={15} />
                            </Button>
                            <DeleteFollowupFlowButton flowId={flow.id} flowName={flow.name} />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Visão em Grid de Cards para Fluxos de IA */
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {flows.map((flow) => (
            <li key={flow.id}>
              <Card className="flex h-full flex-col gap-3 p-4 transition-colors hover:border-accent-400">
                <Link href={`/app/ai/followups/${flow.id}`} className="flex flex-1 flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 truncate font-medium" title={flow.name}>
                      {flow.name}
                    </h3>
                    <FlowStatusBadge status={flow.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div>
                      <dt className="text-text-muted">{t("Versão")}</dt>
                      <dd className="font-mono">{flow.active_version_id ? "publicada" : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">Handoff</dt>
                      <dd className="font-mono">{flow.handoff_policy}</dd>
                    </div>
                  </dl>
                  <p className="mt-auto pt-2 text-xs text-text-muted">
                    Atualizado em {formatUpdatedAt(flow.updated_at, tagDoIdioma)}
                  </p>
                </Link>
                {canWrite && (
                  <div className="flex justify-end border-t border-border pt-2">
                    <DeleteFollowupFlowButton flowId={flow.id} flowName={flow.name} />
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {dialogos}
    </div>
  );
}
