"use client";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Image as ImageIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FlowArrow,
  Plus,
  Sparkle,
  Info,
  Copy,
  TreeStructure,
  MagnifyingGlass,
  Trash,
  X,
} from "@/lib/ui/icons";
import {
  useFollowupFlows,
  useUpdateFollowupFlow,
  followupFlowsListQueryKey,
  type FollowupFlowPointerRow,
} from "@/hooks/followup/useFollowupFlows";
import { useDuplicateFollowupFlow } from "@/hooks/followup/useFollowupFlow";
import { apiClient } from "@/lib/api/client";
import { dispatchImagePreview } from "@/lib/followup/dispatch-graph";
import type { FlowGraph } from "@/lib/followup/graph-schema";
import { DeleteFollowupFlowButton } from "./DeleteFollowupFlowButton";
import { FlowStatusBadge } from "./FlowStatusBadge";
import { ModelosDialog } from "./ModelosDialog";
import { NewFlowDialog } from "./NewFlowDialog";
import { useRouter } from "next/navigation";

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

function getFlowImage(graphRaw: unknown): string | null {
  return dispatchImagePreview(graphRaw as FlowGraph | null | undefined);
}

export function FlowsList({ initialData, canWrite, filterMode = "ai" }: Props) {
  const tagDoIdioma = useTagDeIdioma();
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();
  const { data } = useFollowupFlows({ initialData });
  const updateFlow = useUpdateFollowupFlow();
  const duplicateFlow = useDuplicateFollowupFlow();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [modelosOpen, setModelosOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  const allFlows = data ?? [];

  // Filtrar os fluxos de acordo com a aba ativa
  const tabFlows =
    filterMode === "disparo"
      ? allFlows.filter((f) => f.inbox_enabled)
      : allFlows.filter((f) => !f.inbox_enabled);

  // Filtrar por busca
  const flows = tabFlows.filter((f) =>
    f.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const modelosButton = (
    <Button onClick={() => setModelosOpen(true)} className="w-full sm:w-auto">
      <Sparkle size={14} aria-hidden className="mr-2" /> {t("Começar de um modelo")}
    </Button>
  );

  const newFlowButton =
    filterMode === "disparo" ? (
      <Button onClick={() => router.push("/app/ai/followups/novo-disparo")} className="w-full sm:w-auto">
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
      <ModelosDialog
        open={modelosOpen}
        onOpenChange={setModelosOpen}
        nomesExistentes={allFlows.map((f) => f.name)}
      />
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Excluir")} {selectedIds.length} {t("fluxos selecionados")}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("Todos os fluxos selecionados serão apagados permanentemente. Esta ação não pode ser desfeita.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingBatch}>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingBatch}
              onClick={async (e) => {
                e.preventDefault();
                setIsDeletingBatch(true);
                try {
                  await Promise.all(
                    selectedIds.map((id) => apiClient.delete(`/api/v1/ai/followup-flows/${id}`)),
                  );
                  await qc.invalidateQueries({ queryKey: followupFlowsListQueryKey });
                  toast.success(t(`${selectedIds.length} fluxo(s) excluído(s) com sucesso.`));
                  setSelectedIds([]);
                  setBatchDeleteOpen(false);
                } catch {
                  toast.error(t("Erro ao excluir alguns dos fluxos selecionados."));
                } finally {
                  setIsDeletingBatch(false);
                }
              }}
            >
              {isDeletingBatch ? t("Excluindo...") : t("Excluir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

  if (tabFlows.length === 0 && !search) {
    return (
      <>
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <FlowArrow size={36} aria-hidden className="text-text-muted" />
          <h2 className="font-medium">
            {filterMode === "disparo"
              ? t("Nenhum fluxo de disparo cadastrado")
              : t("Nenhum fluxo automático de IA ainda")}
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
      {/* Barra de Ferramentas: Pesquisa e Botões de Criação */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass size={16} className="absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              filterMode === "disparo"
                ? t("Pesquisar fluxos de disparo por nome...")
                : t("Pesquisar fluxos de IA...")
            }
            className="pl-9 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              aria-label={t("Limpar pesquisa")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {canWrite && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {filterMode === "ai" && modelosButton}
            {newFlowButton}
          </div>
        )}
      </div>

      {/* Barra de Ações em Lote */}
      {selectedIds.length > 0 && canWrite && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5 text-sm transition-all animate-in fade-in">
          <span className="font-medium text-foreground">
            {selectedIds.length} {t("fluxo(s) selecionado(s)")}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              {t("Limpar seleção")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBatchDeleteOpen(true)}
            >
              <Trash size={14} className="mr-1.5" />
              {t("Excluir selecionados")}
            </Button>
          </div>
        </div>
      )}

      {flows.length === 0 && search ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t(`Nenhum fluxo encontrado com o termo "${search}".`)}
          </p>
          <Button variant="outline" size="sm" onClick={() => setSearch("")}>
            {t("Limpar pesquisa")}
          </Button>
        </Card>
      ) : filterMode === "disparo" ? (
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
                  <th className="w-16 px-4 py-3 text-center font-semibold text-foreground">{t("Mídia")}</th>
                  <th className="px-4 py-3 font-semibold text-foreground">{t("Nome")}</th>
                  <th className="w-32 px-4 py-3 text-center font-semibold text-foreground">{t("Estado")}</th>
                  <th className="w-40 px-4 py-3 text-center font-semibold text-foreground">
                    <div className="flex items-center justify-center gap-1">
                      <span>{t("Caixa de Entrada")}</span>
                      <span title={t("Habilita a exibição e disparo manual deste fluxo no chat do operador")}>
                        <Info size={14} className="text-muted-foreground" />
                      </span>
                    </div>
                  </th>
                  <th className="w-32 px-4 py-3 text-right font-semibold text-foreground">{t("Atualizado")}</th>
                  {canWrite && <th className="w-40 px-4 py-3 text-center font-semibold text-foreground">{t("Ações")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flows.map((flow) => {
                  const isSelected = selectedIds.includes(flow.id);
                  const isActive = flow.status === "active";
                  const imageUrl = getFlowImage(flow.draft_graph);

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
                      <td className="px-4 py-3 text-center">
                        {imageUrl ? (
                          <div className="relative h-10 w-10 mx-auto overflow-hidden rounded-md border border-border bg-background">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <span
                            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground text-xs mx-auto"
                            title={t("Sem imagem cadastrada")}
                          >
                            <ImageIcon size={16} />
                          </span>
                        )}
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
                                title={t("Abrir editor visual de nós")}
                              >
                                <TreeStructure size={15} />
                              </Button>
                            </Link>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                duplicateFlow.mutate(flow.id, {
                                  onSuccess: () => {
                                    toast.success(t("Fluxo duplicado com sucesso."));
                                  },
                                });
                              }}
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
                              onClick={() => router.push(`/app/ai/followups/${flow.id}`)}
                              title={t("Edição rápida")}
                            >
                              <Pencil size={15} />
                            </Button>
                            <DeleteFollowupFlowButton
                              flowId={flow.id}
                              flowName={flow.name}
                              variant="ghost"
                              size="icon"
                              iconOnly
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            />
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
                  <div className="flex items-center justify-end gap-1 border-t border-border pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        duplicateFlow.mutate(flow.id, {
                          onSuccess: () => {
                            toast.success(t("Fluxo duplicado com sucesso."));
                          },
                        });
                      }}
                      disabled={duplicateFlow.isPending}
                      title={t("Duplicar fluxo")}
                    >
                      <Copy size={15} />
                    </Button>
                    <DeleteFollowupFlowButton
                      flowId={flow.id}
                      flowName={flow.name}
                      variant="ghost"
                      size="icon"
                      iconOnly
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    />
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
