"use client";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CheckCircle,
  CircleNotch,
  InstagramLogo,
  ArrowsClockwise,
  ImageIcon,
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

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramAutomationRule {
  id: string;
  name: string;
  target_type: "all_posts" | "specific_post";
  post_id?: string | null;
  post_thumbnail?: string | null;
  post_caption?: string | null;
  keywords: string[];
  reply_comment_text: string;
  dm_message_text: string;
  flow_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_delay" },
        { id: "e2", source: "node_delay", target: "node_msg" },
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
      ],
      edges: [{ id: "e1", source: "node_trigger", target: "node_msg_1" }],
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
          data: { title: "Gatilho: Solicitação de Atendimento", trigger_type: "manual" },
        },
        {
          id: "node_handoff",
          type: "action",
          position: { x: 100, y: 260 },
          data: {
            title: "Transbordo para Atendente Humano",
            action_type: "transfer_human",
            message_text: "Transferindo seu atendimento para a nossa equipe agora mesmo! 👨‍💼",
          },
        },
      ],
      edges: [{ id: "e1", source: "node_trigger", target: "node_handoff" }],
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
          data: { title: "Início do Fluxo", description: "Ponto de entrada da automação", trigger_type: "manual" },
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

  // ─── ABA ATIVA (Instagram vs Fluxos de Nós) ──────────────────────────────
  const [activeTab, setActiveTab] = useState<"instagram" | "nodes">("instagram");

  // ─── DADOS DO INSTAGRAM ──────────────────────────────────────────────────
  const [instaAutomations, setInstaAutomations] = useState<InstagramAutomationRule[]>([]);
  const [instaConnection, setInstaConnection] = useState<Record<string, unknown> | null>(null);
  const [loadingInsta, setLoadingInsta] = useState(false);

  // Mídias do Instagram (Posts e Reels reais)
  const [instaMedia, setInstaMedia] = useState<InstagramMediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Modal de Automação de Comentário
  const [modalInstaOpen, setModalInstaOpen] = useState(false);
  const [savingInsta, setSavingInsta] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<InstagramAutomationRule> | null>(null);

  // Form State do Instagram
  const [ruleName, setRuleName] = useState("");
  const [targetType, setTargetType] = useState<"all_posts" | "specific_post">("all_posts");
  const [selectedPost, setSelectedPost] = useState<InstagramMediaItem | null>(null);
  const [keywordsText, setKeywordsText] = useState("");
  const [replyCommentText, setReplyCommentText] = useState("");
  const [dmMessageText, setDmMessageText] = useState("");

  // ─── DADOS DOS FLUXOS EM NÓS ──────────────────────────────────────────────
  const { data: flowsData } = useFollowupFlows({ initialData });
  const updateFlow = useUpdateFollowupFlow();
  const duplicateFlow = useDuplicateFollowupFlow();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AutomacaoTemplate>(TEMPLATES_AUTOMACAO[0]!);
  const [flowName, setFlowName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Carrega automações do Instagram
  const carregarAutomacoesInstagram = useCallback(async () => {
    setLoadingInsta(true);
    try {
      const res = await fetch("/api/v1/automacoes/instagram");
      const json = await res.json();
      if (json.data) {
        setInstaAutomations(json.data.automations || []);
        setInstaConnection(json.data.connection || null);
      }
    } catch {
      // continua
    } finally {
      setLoadingInsta(false);
    }
  }, []);

  useEffect(() => {
    carregarAutomacoesInstagram();
  }, [carregarAutomacoesInstagram]);

  // Carrega posts/reels reais da conta conectada via Graph API
  const carregarMidiasInstagram = async () => {
    setLoadingMedia(true);
    try {
      const res = await fetch("/api/v1/channels/instagram/media");
      const json = await res.json();
      if (json.data?.items) {
        setInstaMedia(json.data.items);
        if (json.data.items.length === 0) {
          toast.info(t("Nenhuma publicação encontrada no perfil conectado."));
        } else {
          toast.success(t(`${json.data.items.length} publicações carregadas do Instagram!`));
        }
      } else if (json.data?.connected === false) {
        toast.warning(t("Conecte sua conta do Instagram na aba Conexões para puxar as publicações."));
      } else if (json.data?.error) {
        toast.error(t(`Erro ao carregar mídias: ${json.data.error}`));
      }
    } catch (err) {
      toast.error(t("Erro ao buscar publicações do Instagram."));
    } finally {
      setLoadingMedia(false);
    }
  };

  const abrirModalNovaRegraInsta = () => {
    setEditingRule(null);
    setRuleName("Comentário no Post → DM com Link");
    setTargetType("all_posts");
    setSelectedPost(null);
    setKeywordsText("QUERO, LINK, PRECO, EU QUERO");
    setReplyCommentText("Te enviei os detalhes no seu Direct! Dá uma olhada lá 🚀");
    setDmMessageText("Olá @primeiro_nome! Aqui está o link que você pediu: https://example.com/oferta Aproveite!");
    setModalInstaOpen(true);
    // Se ainda não puxou as mídias, puxa automaticamente
    if (instaMedia.length === 0) {
      carregarMidiasInstagram();
    }
  };

  const abrirModalEdicaoInsta = (rule: InstagramAutomationRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setTargetType(rule.target_type);
    setSelectedPost(
      rule.post_id
        ? {
            id: rule.post_id,
            caption: rule.post_caption || "",
            media_url: rule.post_thumbnail || "",
            thumbnail_url: rule.post_thumbnail || "",
            permalink: "",
            media_type: "IMAGE",
            timestamp: "",
          }
        : null,
    );
    setKeywordsText(rule.keywords.join(", "));
    setReplyCommentText(rule.reply_comment_text);
    setDmMessageText(rule.dm_message_text);
    setModalInstaOpen(true);
  };

  const salvarRegraInstagram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      toast.error(t("Informe um nome para a automação."));
      return;
    }
    if (!replyCommentText.trim() || !dmMessageText.trim()) {
      toast.error(t("Preencha a resposta do comentário e a mensagem no Direct."));
      return;
    }

    setSavingInsta(true);
    try {
      const kws = keywordsText
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const payload: Partial<InstagramAutomationRule> = {
        id: editingRule?.id,
        name: ruleName.trim(),
        target_type: targetType,
        post_id: targetType === "specific_post" ? selectedPost?.id ?? null : null,
        post_thumbnail: targetType === "specific_post" ? selectedPost?.thumbnail_url || selectedPost?.media_url || null : null,
        post_caption: targetType === "specific_post" ? selectedPost?.caption || null : null,
        keywords: kws,
        reply_comment_text: replyCommentText.trim(),
        dm_message_text: dmMessageText.trim(),
        is_active: editingRule?.is_active ?? true,
      };

      const res = await fetch("/api/v1/automacoes/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Falha ao salvar");
      const json = await res.json();
      setInstaAutomations(json.data.automations || []);
      toast.success(t(editingRule ? "Automação atualizada com sucesso!" : "Automação do Instagram criada com sucesso!"));
      setModalInstaOpen(false);
    } catch {
      toast.error(t("Erro ao salvar automação do Instagram."));
    } finally {
      setSavingInsta(false);
    }
  };

  const alternarAtivoInsta = async (rule: InstagramAutomationRule) => {
    try {
      const res = await fetch("/api/v1/automacoes/instagram", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
      });
      const json = await res.json();
      setInstaAutomations(json.data.automations || []);
      toast.success(rule.is_active ? t("Automação pausada.") : t("Automação ativada!"));
    } catch {
      toast.error(t("Erro ao alterar status."));
    }
  };

  const excluirRegraInsta = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/automacoes/instagram?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      setInstaAutomations(json.data.automations || []);
      toast.success(t("Automação excluída."));
    } catch {
      toast.error(t("Erro ao excluir."));
    }
  };

  // ─── HANDLERS DE NÓS (FOLLOWUP FLOWS) ────────────────────────────────────
  const flows = (flowsData ?? []).filter((f) =>
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
    toast.success(nextStatus === "active" ? t("Automação ativada.") : t("Automação desativada."));
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
      {/* Seletor Superior de Modo */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "instagram" | "nodes")} className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="instagram" className="gap-2 font-medium">
              <InstagramLogo size={18} weight="bold" className="text-rose-500" />
              {t("Instagram: Comentários & DMs")}
              {instaAutomations.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs font-semibold">
                  {instaAutomations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="nodes" className="gap-2 font-medium">
              <TreeStructure size={18} weight="bold" className="text-primary" />
              {t("Fluxos em Nós (Delays & Timers)")}
              {flows.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs font-semibold">
                  {flows.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === "instagram" ? (
            <Button
              type="button"
              onClick={abrirModalNovaRegraInsta}
              className="bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 hover:opacity-90 text-white font-medium gap-2 shadow-sm"
            >
              <Plus size={18} weight="bold" />
              {t("Nova Automação de Comentário / Reels")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => openCreateDialog()}
              disabled={!canWrite}
              className="gap-2 font-medium shadow-sm"
            >
              <Plus size={18} weight="bold" />
              {t("Criar Fluxo em Nós")}
            </Button>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* ABA 1: AUTOMAÇÕES DE INSTAGRAM (ESTILO MANYCHAT)                         */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="instagram" className="mt-6 space-y-6">
          {/* Status da Conta Conectada */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-card/60 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white">
                <InstagramLogo size={24} weight="bold" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">
                    {instaConnection?.instagram_username
                      ? `@${String(instaConnection.instagram_username)}`
                      : t("Conta do Instagram")}
                  </h4>
                  {instaConnection ? (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-xs">
                      <CheckCircle size={12} className="mr-1 inline text-emerald-600" />
                      {t("Ativa para automações")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-xs">
                      {t("Aguardando conexão")}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {instaConnection
                    ? t("Comentários em Reels e Posts disparam respostas automáticas na hora!")
                    : t("Para ativar, conecte sua conta na aba Conexões › Instagram Direct.")}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={carregarMidiasInstagram}
              disabled={loadingMedia}
              className="gap-1.5 text-xs"
            >
              {loadingMedia ? (
                <CircleNotch size={14} className="animate-spin text-primary" />
              ) : (
                <ArrowsClockwise size={14} />
              )}
              {t("Sincronizar Posts & Reels")}
            </Button>
          </div>

          {/* Lista de Automações Criadas */}
          {loadingInsta ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <CircleNotch size={20} className="animate-spin" />
              <span className="text-sm">{t("Carregando automações…")}</span>
            </div>
          ) : instaAutomations.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-950/40 mb-4">
                <InstagramLogo size={36} weight="bold" />
              </div>
              <h3 className="text-lg font-semibold">{t("Nenhuma automação de comentário criada")}</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
                {t(
                  "Crie sua primeira regra estilo ManyChat: quando alguém comentar uma palavra-chave (ex: 'QUERO') em um Post ou Reels, o bot responde no comentário e envia uma DM privada instantânea!",
                )}
              </p>
              <Button
                type="button"
                onClick={abrirModalNovaRegraInsta}
                className="bg-gradient-to-r from-purple-600 to-rose-500 text-white font-medium gap-2 shadow-sm"
              >
                <Plus size={18} weight="bold" />
                {t("Criar Primeira Automação")}
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {instaAutomations.map((rule) => (
                <Card key={rule.id} className="p-5 border flex flex-col justify-between gap-4 hover:shadow-md transition-shadow">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/50">
                          <ChatCircle size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground leading-tight">{rule.name}</h4>
                          <span className="text-xs text-muted-foreground">
                            {rule.target_type === "all_posts"
                              ? t("Todos os Posts & Reels")
                              : t("Post/Reel Específico")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => alternarAtivoInsta(rule)}
                          title={rule.is_active ? t("Pausar automação") : t("Ativar automação")}
                        />
                      </div>
                    </div>

                    {/* Mídia Vinculada */}
                    {rule.post_id && (
                      <div className="flex items-center gap-2.5 rounded-lg border bg-muted/30 p-2 text-xs">
                        {rule.post_thumbnail ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={rule.post_thumbnail}
                            alt="Post"
                            className="h-10 w-10 rounded-md object-cover border"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                            <ImageIcon size={18} className="text-muted-foreground" />
                          </div>
                        )}
                        <span className="line-clamp-2 text-muted-foreground flex-1 font-mono text-[11px]">
                          {rule.post_caption || `Post ID: ${rule.post_id}`}
                        </span>
                      </div>
                    )}

                    {/* Palavras-chave */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">{t("Palavras-chave ativadoras:")}</span>
                      <div className="flex flex-wrap gap-1">
                        {rule.keywords.length === 0 ? (
                          <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                            {t("Qualquer comentário")}
                          </Badge>
                        ) : (
                          rule.keywords.map((kw, i) => (
                            <Badge key={i} variant="secondary" className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              #{kw}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Preview da Resposta Pública e Privada */}
                    <div className="space-y-1.5 pt-1 text-xs border-t">
                      <div className="flex items-start gap-1.5 text-muted-foreground">
                        <span className="font-semibold text-foreground shrink-0">{t("Comentário:")}</span>
                        <span className="truncate italic">&quot;{rule.reply_comment_text}&quot;</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-muted-foreground">
                        <span className="font-semibold text-foreground shrink-0">{t("Direct (DM):")}</span>
                        <span className="line-clamp-2 text-foreground/90">&quot;{rule.dm_message_text}&quot;</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirModalEdicaoInsta(rule)}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <PencilSimple size={14} />
                      {t("Editar")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => excluirRegraInsta(rule.id)}
                      className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash size={14} />
                      {t("Excluir")}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* ABA 2: FLUXOS EM NÓS (DELAYS, TIMERS & CANVAS VISUAL)                    */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="nodes" className="mt-6 space-y-6">
          {/* Modelos Rápidos */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES_AUTOMACAO.map((tpl) => {
              const Icon = tpl.icon;
              return (
                <Card
                  key={tpl.id}
                  className="group relative flex flex-col justify-between overflow-hidden border p-5 transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
                  onClick={() => openCreateDialog(tpl)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon size={20} weight="bold" />
                      </div>
                      <Badge variant="secondary" className="text-xs font-medium">
                        {t(tpl.badge)}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="text-base font-semibold tracking-tight text-foreground">{t(tpl.title)}</h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t(tpl.description)}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs font-medium text-primary">
                    <span>{t("Usar este modelo")}</span>
                    <Plus size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Busca e Lista de Fluxos */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <div className="relative flex-1 max-w-sm">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("Buscar fluxos…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">{t("Nome do Fluxo")}</th>
                    <th className="px-5 py-3.5 font-semibold">{t("Status")}</th>
                    <th className="px-5 py-3.5 font-semibold">{t("Última Edição")}</th>
                    <th className="px-5 py-3.5 font-semibold text-right">{t("Ações")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {flows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-sm text-muted-foreground">
                        {t("Nenhum fluxo encontrado. Crie um novo acima.")}
                      </td>
                    </tr>
                  ) : (
                    flows.map((flow) => (
                      <tr key={flow.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-4">
                          <Link
                            href={`/app/ai/followups/${flow.id}`}
                            className="font-medium text-foreground hover:underline flex items-center gap-2"
                          >
                            <TreeStructure size={16} className="text-primary shrink-0" />
                            {flow.name}
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={flow.status === "active"}
                              onCheckedChange={() => handleToggleStatus(flow)}
                              disabled={!canWrite}
                            />
                            <span className="text-xs text-muted-foreground capitalize">
                              {flow.status === "active" ? t("Ativo") : t("Pausado")}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">{formatData(flow.updated_at)}</td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              asChild
                            >
                              <Link href={`/app/ai/followups/${flow.id}`}>
                                <PencilSimple size={14} />
                                {t("Abrir Nós")}
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(flow.id)}
                              disabled={!canWrite}
                            >
                              <Trash size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE AUTOMAÇÃO DE INSTAGRAM                      */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <Dialog open={modalInstaOpen} onOpenChange={setModalInstaOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={salvarRegraInstagram}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <InstagramLogo size={22} weight="bold" className="text-rose-500" />
                {t(editingRule ? "Editar Automação do Instagram" : "Nova Automação de Comentário / Reels")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "Configure respostas automáticas públicas e envio de links privados na DM de quem comentar nas suas publicações.",
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              {/* Nome da Automação */}
              <div className="space-y-1.5">
                <Label htmlFor="rule-name">{t("Nome da Automação")}</Label>
                <Input
                  id="rule-name"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder={t("Ex: Link no Reels de Lançamento")}
                  required
                />
              </div>

              {/* Seletor de Post / Reels */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("Onde esta regra vai funcionar?")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={carregarMidiasInstagram}
                    disabled={loadingMedia}
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {loadingMedia ? (
                      <CircleNotch size={12} className="animate-spin" />
                    ) : (
                      <ArrowsClockwise size={12} />
                    )}
                    {t("Puxar Posts do Perfil")}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType("all_posts");
                      setSelectedPost(null);
                    }}
                    className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${
                      targetType === "all_posts"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-sm font-semibold text-foreground">{t("Qualquer Publicação")}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("Dispara em comentários de qualquer post ou reels do seu perfil")}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType("specific_post")}
                    className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${
                      targetType === "specific_post"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-sm font-semibold text-foreground">{t("Post ou Reel Específico")}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("Escolha exatamente em qual vídeo/foto essa resposta vai rodar")}
                    </span>
                  </button>
                </div>

                {/* Grid de Posts Puxados da Conta */}
                {targetType === "specific_post" && (
                  <div className="mt-3 space-y-2 rounded-xl border p-3 bg-muted/20">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("Selecione o Post ou Reel:")}
                    </span>

                    {loadingMedia ? (
                      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                        <CircleNotch size={16} className="animate-spin" />
                        {t("Buscando publicações no seu Instagram…")}
                      </div>
                    ) : instaMedia.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground space-y-2">
                        <p>{t("Nenhuma publicação carregada.")}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={carregarMidiasInstagram}
                          className="h-7 text-xs"
                        >
                          {t("Clique para puxar publicações da Meta")}
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
                        {instaMedia.map((m) => {
                          const isSelected = selectedPost?.id === m.id;
                          const thumb = m.thumbnail_url || m.media_url;
                          return (
                            <div
                              key={m.id}
                              onClick={() => setSelectedPost(m)}
                              className={`relative group rounded-lg overflow-hidden border cursor-pointer transition-all aspect-square bg-muted ${
                                isSelected ? "ring-2 ring-primary border-transparent" : "hover:opacity-80"
                              }`}
                            >
                              {thumb ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={thumb} alt="Mídia" className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex w-full h-full items-center justify-center text-xs text-muted-foreground">
                                  {m.media_type}
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                                  <div className="bg-primary text-primary-foreground rounded-full p-1">
                                    <Check size={14} weight="bold" />
                                  </div>
                                </div>
                              )}
                              <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[10px] text-white truncate">
                                {m.caption || "Sem legenda"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Palavras-chave */}
              <div className="space-y-1.5">
                <Label htmlFor="keywords">{t("Palavras-chave do Comentário")}</Label>
                <Input
                  id="keywords"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder={t("Ex: QUERO, LINK, PRECO, EU QUERO")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("Separe por vírgulas. Deixe vazio para responder a qualquer comentário.")}
                </p>
              </div>

              {/* Resposta Pública no Comentário */}
              <div className="space-y-1.5">
                <Label htmlFor="reply-public">{t("Resposta Pública no Comentário")}</Label>
                <Input
                  id="reply-public"
                  value={replyCommentText}
                  onChange={(e) => setReplyCommentText(e.target.value)}
                  placeholder={t("Ex: Te mandei os detalhes no Direct! Dá uma olhada lá 🚀")}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t("O que será respondido embaixo do comentário da pessoa no post.")}
                </p>
              </div>

              {/* Mensagem Privada no Direct (DM) */}
              <div className="space-y-1.5">
                <Label htmlFor="dm-text">{t("Mensagem Privada no Direct (DM)")}</Label>
                <textarea
                  id="dm-text"
                  rows={3}
                  value={dmMessageText}
                  onChange={(e) => setDmMessageText(e.target.value)}
                  placeholder={t("Ex: Olá @primeiro_nome! Aqui está o link que você pediu: https://example.com/oferta")}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t("Use @primeiro_nome para personalizar o nome do seguidor.")}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalInstaOpen(false)}>
                {t("Cancelar")}
              </Button>
              <Button
                type="submit"
                disabled={savingInsta}
                className="bg-gradient-to-r from-purple-600 to-rose-500 text-white font-medium gap-2"
              >
                {savingInsta ? <CircleNotch size={16} className="animate-spin" /> : <Check size={16} />}
                {t("Salvar e Ativar Automação")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Criação de Nós (Followup Flow) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>{t("Criar Automação em Nós")}</DialogTitle>
              <DialogDescription>
                {t("Defina o nome do fluxo para começar a editar os nós no canvas.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="flow-name">{t("Nome do Fluxo")}</Label>
                <Input
                  id="flow-name"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder={t("Nome do fluxo...")}
                  autoFocus
                  required
                />
              </div>

              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground block mb-1">
                  {t("Modelo selecionado:")} {selectedTemplate.title}
                </span>
                {selectedTemplate.description}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("Cancelar")}
              </Button>
              <Button type="submit" disabled={isCreating || !flowName.trim()}>
                {isCreating ? t("Criando…") : t("Continuar no Canvas")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão de Nós */}
      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Excluir esta automação?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Esta ação não pode ser desfeita. O fluxo de nós será removido permanentemente.")}
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
