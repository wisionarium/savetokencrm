"use client";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import {
  TreeStructure,
  Plus,
  Sparkle,
  Clock,
  ChatCircle,
  Users,
  Copy,
  Trash,
  PencilSimple,
  MagnifyingGlass,
  FlowArrow,
  Check,
} from "@/lib/ui/icons";
import {
  useFollowupFlows,
  useUpdateFollowupFlow,
  followupFlowsListQueryKey,
  type FollowupFlowPointerRow,
} from "@/hooks/followup/useFollowupFlows";
import { useDuplicateFollowupFlow } from "@/hooks/followup/useFollowupFlow";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";

interface Props {
  initialData: FollowupFlowPointerRow[];
  canWrite: boolean;
}

interface AutomacaoTemplate {
  id: string;
  title: string;
  description: string;
  badge: string;
  icon: typeof ChatCircle;
  defaultName: string;
  draftGraph: Record<string, unknown>;
}

const TEMPLATES_AUTOMACAO: AutomacaoTemplate[] = [
  {
    id: "boas-vindas",
    title: "Boas-vindas (1ª Mensagem)",
    description: "Mensagem imediata ao receber a 1ª mensagem do contato no WhatsApp, com delay humanizado e menu de opções.",
    badge: "Mais Usado",
    icon: ChatCircle,
    defaultName: "Boas-vindas - Primeira Mensagem",
    draftGraph: {
      version: 2,
      nodes: [
        {
          id: "node_trigger",
          type: "trigger",
          position: { x: 100, y: 120 },
          data: {
            title: "Gatilho: Primeira Mensagem",
            description: "Dispara quando um contato novo envia a primeira mensagem",
            trigger_type: "first_message",
          },
        },
        {
          id: "node_delay",
          type: "wait",
          position: { x: 100, y: 260 },
          data: {
            title: "Delay de Digitação",
            description: "Aguardar 3 segundos para parecer digitação humana",
            wait_seconds: 3,
          },
        },
        {
          id: "node_msg",
          type: "action",
          position: { x: 100, y: 400 },
          data: {
            title: "Mensagem de Saudação",
            description: "Saudação com nome do contato e apresentação",
            action_type: "send_message",
            message_text: "Olá @primeiro_nome! Seja muito bem-vindo(a). 👋\n\nComo posso ajudar você hoje?",
          },
        },
        {
          id: "node_menu",
          type: "action",
          position: { x: 100, y: 560 },
          data: {
            title: "Menu de Opções",
            description: "Menu interativo de triagem",
            action_type: "send_message",
            message_text: "Escolha uma opção:\n1️⃣ Conhecer serviços\n2️⃣ Falar com atendente\n3️⃣ Horários e dúvidas",
          },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_delay" },
        { id: "e2", source: "node_delay", target: "node_msg" },
        { id: "e3", source: "node_msg", target: "node_menu" },
      ],
    },
  },
  {
    id: "sequencia-delays",
    title: "Sequência com Timers & Delays",
    description: "Etapas encadeadas com pausas inteligentes (ex: 5 min, 1 hora, 1 dia) para nutrir e manter o lead engajado.",
    badge: "Nutrição",
    icon: Clock,
    defaultName: "Sequência com Delays e Timers",
    draftGraph: {
      version: 2,
      nodes: [
        {
          id: "node_trigger",
          type: "trigger",
          position: { x: 100, y: 120 },
          data: {
            title: "Gatilho Inicial",
            description: "Disparo programado ou após atendimento",
            trigger_type: "lead_status_changed",
          },
        },
        {
          id: "node_msg_1",
          type: "action",
          position: { x: 100, y: 260 },
          data: {
            title: "1ª Etapa: Mensagem Inicial",
            action_type: "send_message",
            message_text: "Olá @primeiro_nome! Tudo bem por aí?",
          },
        },
        {
          id: "node_wait_1",
          type: "wait",
          position: { x: 100, y: 400 },
          data: {
            title: "Timer: Aguardar 1 hora",
            wait_seconds: 3600,
          },
        },
        {
          id: "node_msg_2",
          type: "action",
          position: { x: 100, y: 540 },
          data: {
            title: "2ª Etapa: Acompanhamento",
            action_type: "send_message",
            message_text: "@primeiro_nome, ficou alguma dúvida sobre o que conversamos?",
          },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_msg_1" },
        { id: "e2", source: "node_msg_1", target: "node_wait_1" },
        { id: "e3", source: "node_wait_1", target: "node_msg_2" },
      ],
    },
  },
  {
    id: "triagem-humana",
    title: "Triagem & Transbordo Humano",
    description: "Qualifica o lead com perguntas e direciona automaticamente para atendente humano ou fila do time.",
    badge: "Atendimento",
    icon: Users,
    defaultName: "Triagem e Atribuição para Atendente",
    draftGraph: {
      version: 2,
      nodes: [
        {
          id: "node_trigger",
          type: "trigger",
          position: { x: 100, y: 120 },
          data: {
            title: "Gatilho: Solicitação de Atendimento",
            trigger_type: "manual",
          },
        },
        {
          id: "node_pergunta",
          type: "action",
          position: { x: 100, y: 260 },
          data: {
            title: "Pergunta de Triagem",
            action_type: "send_message",
            message_text: "Por favor @primeiro_nome, informe em poucas palavras qual assunto deseja tratar:",
          },
        },
        {
          id: "node_wait_resp",
          type: "wait",
          position: { x: 100, y: 400 },
          data: {
            title: "Aguardar Resposta",
            wait_seconds: 60,
          },
        },
        {
          id: "node_handoff",
          type: "action",
          position: { x: 100, y: 540 },
          data: {
            title: "Transbordo para Atendente Humano",
            action_type: "transfer_human",
            message_text: "Transferindo seu atendimento para a nossa equipe agora mesmo! 👨‍💼",
          },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_pergunta" },
        { id: "e2", source: "node_pergunta", target: "node_wait_resp" },
        { id: "e3", source: "node_wait_resp", target: "node_handoff" },
      ],
    },
  },
  {
    id: "em-branco",
    title: "Automação em Branco (Canvas)",
    description: "Abra o editor visual estilo ManyChat do zero e monte seus próprios nós, timers, delays e integrações.",
    badge: "Personalizado",
    icon: TreeStructure,
    defaultName: "Nova Automação em Nodes",
    draftGraph: {
      version: 2,
      nodes: [
        {
          id: "node_start",
          type: "trigger",
          position: { x: 100, y: 120 },
          data: {
            title: "Início do Fluxo",
            description: "Ponto de entrada da automação",
            trigger_type: "manual",
          },
        },
      ],
      edges: [],
    },
  },
];

export function AutomacoesClient({ initialData, canWrite }: Props) {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const qc = useQueryClient();
  const router = useRouter();

  const { data } = useFollowupFlows({ initialData });
  const updateFlow = useUpdateFollowupFlow();
  const duplicateFlow = useDuplicateFollowupFlow();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AutomacaoTemplate>(TEMPLATES_AUTOMACAO[0]!);
  const [flowName, setFlowName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const flows = (data ?? []).filter((f) =>
    f.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const formatData = (iso: string) => {
    return new Date(iso).toLocaleDateString(tagDoIdioma, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const openCreateDialog = (template?: AutomacaoTemplate) => {
    const tpl = template ?? TEMPLATES_AUTOMACAO[0]!;
    setSelectedTemplate(tpl);
    setFlowName(tpl.defaultName);
    setDialogOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flowName.trim()) return;

    setIsCreating(true);
    try {
      const res = await apiClient.post<{ data: FollowupFlowPointerRow }>("/api/v1/ai/followup-flows", {
        name: flowName.trim(),
        draft_graph: selectedTemplate.draftGraph,
      });

      await qc.invalidateQueries({ queryKey: followupFlowsListQueryKey });
      toast.success(t("Automação criada com sucesso!"));
      setDialogOpen(false);
      // Redireciona diretamente para o editor de canvas de nodes
      router.push(`/app/ai/followups/${res.data.id}`);
    } catch (err) {
      showApiError(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleStatus = async (flow: FollowupFlowPointerRow) => {
    const nextStatus = flow.status === "active" ? "disabled" : "active";
    await updateFlow.mutateAsync({
      id: flow.id,
      patch: { status: nextStatus },
    });
    toast.success(
      nextStatus === "active" ? t("Automação ativada.") : t("Automação desativada."),
    );
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiClient.delete(`/api/v1/ai/followup-flows/${deleteId}`);
      await qc.invalidateQueries({ queryKey: followupFlowsListQueryKey });
      toast.success(t("Automação excluída com sucesso."));
      setDeleteId(null);
    } catch (err) {
      showApiError(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cards de Início Rápido / Modelos ManyChat */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkle size={18} className="text-primary" />
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {t("Modelos de Automação Rápida (Estilo ManyChat)")}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {t("Clique para criar com os nós pré-configurados")}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES_AUTOMACAO.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <div
                key={tpl.id}
                onClick={() => openCreateDialog(tpl)}
                className="group relative flex cursor-pointer flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:bg-card/80 hover:shadow-md"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon size={18} />
                    </div>
                    <Badge variant="neutral" className="text-[10px]">
                      {tpl.badge}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                      {tpl.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {tpl.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary">
                  <span>{t("Criar esta automação")}</span>
                  <Plus size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Barra de Ações e Busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Buscar automações por nome...")}
            className="pl-9"
          />
        </div>

        {canWrite && (
          <Button onClick={() => openCreateDialog()} className="gap-2 shrink-0">
            <Plus size={16} />
            {t("Nova Automação")}
          </Button>
        )}
      </div>

      {/* Lista de Automações */}
      {flows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center border-dashed">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <TreeStructure size={24} />
          </div>
          <div>
            <h3 className="text-base font-semibold">{t("Nenhuma automação encontrada")}</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              {search
                ? t("Nenhum fluxo encontrado com o termo buscado.")
                : t("Crie automações em nodes estilo ManyChat para responder na 1ª mensagem, agendar timers, delays e transbordar para atendentes.")}
            </p>
          </div>
          {canWrite && (
            <Button onClick={() => openCreateDialog()} variant="default" className="mt-2 gap-2">
              <Plus size={16} />
              {t("Criar Primeira Automação")}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => {
            const isActive = flow.status === "active";
            const draftGraph = flow.draft_graph as { nodes?: unknown[] } | undefined;
            const nodesCount = draftGraph?.nodes?.length ?? 0;

            return (
              <Card
                key={flow.id}
                className="flex flex-col justify-between p-4 transition-all hover:border-border/80 hover:shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{flow.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <TreeStructure size={13} className="text-primary" />
                          {nodesCount > 0 ? `${nodesCount} nós` : t("Nodes em rascunho")}
                        </span>
                        <span>•</span>
                        <span>{formatData(flow.updated_at)}</span>
                      </div>
                    </div>

                    {canWrite && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {isActive ? t("Ativo") : t("Inativo")}
                        </span>
                        <Switch
                          checked={isActive}
                          onCheckedChange={() => handleToggleStatus(flow)}
                          aria-label={t("Ativar ou desativar automação")}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Link href={`/app/ai/followups/${flow.id}`}>
                      <PencilSimple size={14} />
                      {t("Editar no Canvas")}
                    </Link>
                  </Button>

                  {canWrite && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title={t("Duplicar automação")}
                        onClick={() => duplicateFlow.mutate(flow.id)}
                        disabled={duplicateFlow.isPending}
                      >
                        <Copy size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title={t("Excluir automação")}
                        onClick={() => setDeleteId(flow.id)}
                      >
                        <Trash size={15} />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Diálogo de Criação de Automação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TreeStructure size={20} className="text-primary" />
              {t("Nova Automação em Nodes")}
            </DialogTitle>
            <DialogDescription>
              {t("Escolha um nome e o modelo inicial para começar a montar o fluxo estilo ManyChat.")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auto-name">{t("Nome da Automação")}</Label>
              <Input
                id="auto-name"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                placeholder={t("Ex: Boas-vindas para novos contatos")}
                maxLength={80}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>{t("Estrutura Inicial de Nós")}</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {TEMPLATES_AUTOMACAO.map((tpl) => {
                  const isChosen = selectedTemplate.id === tpl.id;
                  const Icon = tpl.icon;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => {
                        setSelectedTemplate(tpl);
                        if (!flowName || TEMPLATES_AUTOMACAO.some((x) => x.defaultName === flowName)) {
                          setFlowName(tpl.defaultName);
                        }
                      }}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors ${
                        isChosen
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                            isChosen ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-foreground">
                            {tpl.title}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {tpl.badge}
                          </div>
                        </div>
                      </div>
                      {isChosen && <Check size={16} className="text-primary shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                {t("Cancelar")}
              </Button>
              <Button type="submit" disabled={isCreating || !flowName.trim()}>
                {isCreating ? t("Criando e abrindo canvas...") : t("Criar e Abrir Canvas")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Excluir esta automação?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Esta ação não pode ser desfeita. Todos os nós e conexões serão removidos permanentemente.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("Excluir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
