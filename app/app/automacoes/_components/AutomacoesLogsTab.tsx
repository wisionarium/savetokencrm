"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useT } from "@/hooks/i18n/useT";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Clock,
  ArrowsClockwise,
  MagnifyingGlass,
  CheckCircle,
  Warning,
  CircleNotch,
  ChatCircle,
  Eye,
  TreeStructure,
  ArrowSquareOut,
} from "@/lib/ui/icons";

export interface FollowupLogItem {
  id: string;
  pointer_id: string;
  contact_id: string;
  conversation_id: string | null;
  status: "active" | "waiting_reply" | "dormente" | "completed" | "cancelled" | "failed";
  current_node_id: string;
  outcome: string | null;
  cancel_reason: string | null;
  attempts: number;
  last_error: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  pointer?: {
    id: string;
    name: string;
    trigger_config?: {
      kind?: string;
      params?: {
        keywords?: string[];
      };
    };
  } | null;
  contact?: {
    id: string;
    name: string | null;
    phone_number: string | null;
  } | null;
  events?: Array<{
    id: string;
    event_type: string;
    node_id: string;
    payload?: Record<string, unknown>;
    created_at: string;
  }>;
}

function traduzirMotivoBloqueio(motivo: string | null | undefined): string {
  if (!motivo) return "Cancelado";
  switch (motivo) {
    case "fora_da_lista_de_teste":
      return "Bloqueado (Canal em modo de teste: número não está na lista de teste)";
    case "conversa_silenciada":
      return "Bloqueado (Conversa silenciada ou pausada no Inbox)";
    case "conversa_de_humano":
      return "Bloqueado (Conversa em atendimento manual humano)";
    case "force_human":
      return "Bloqueado (Transferência humana forçada)";
    case "sem_autorizacao":
      return "Bloqueado (Sem autorização prévia)";
    case "autorizacao_expirada":
      return "Bloqueado (Autorização expirada)";
    default:
      return motivo;
  }
}

function traduzirEvento(tipo: string, payload?: Record<string, unknown>): string {
  switch (tipo) {
    case "enrolled_by_keyword": {
      const kw = payload?.matched_keyword ? ` ("${payload.matched_keyword}")` : "";
      return `Inscrito por palavra-chave${kw}`;
    }
    case "enrolled_by_first_message":
      return "Inscrito por primeira mensagem (boas-vindas)";
    case "node_advanced": {
      const proximo = payload?.next_node_id ? ` -> ${payload.next_node_id}` : "";
      return `Avançou de nó${proximo}`;
    }
    case "turn_enqueued":
      return "Disparo de mensagem preparado";
    case "action_sent":
      return "Mensagem enviada com sucesso";
    case "wait_started":
      return "Aguardando resposta do contato / timer";
    case "turn_skipped": {
      const r = payload?.reason ? `: ${traduzirMotivoBloqueio(String(payload.reason))}` : "";
      return `Passo não enviado${r}`;
    }
    default:
      return tipo;
  }
}

export function AutomacoesLogsTab() {
  const t = useT();
  const [logs, setLogs] = useState<FollowupLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "active" | "completed" | "cancelled">("todos");
  const [detalheLog, setDetalheLog] = useState<FollowupLogItem | null>(null);

  const carregarLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai/followups/logs?limit=50", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar logs");
      const json = await res.json();
      if (json.data) {
        setLogs(json.data);
      }
    } catch {
      // falha tratada
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarLogs();
  }, [carregarLogs]);

  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      // Filtro de status
      if (filtroStatus === "active" && log.status !== "active" && log.status !== "waiting_reply") {
        return false;
      }
      if (filtroStatus === "completed" && log.status !== "completed") {
        return false;
      }
      if (filtroStatus === "cancelled" && log.status !== "cancelled" && log.status !== "failed") {
        return false;
      }

      // Busca por texto
      if (!busca.trim()) return true;
      const termo = busca.toLowerCase();
      const nomeFluxo = log.pointer?.name?.toLowerCase() ?? "";
      const nomeContato = log.contact?.name?.toLowerCase() ?? "";
      const foneContato = log.contact?.phone_number?.toLowerCase() ?? "";
      const kw = (log.pointer?.trigger_config?.params?.keywords ?? []).join(" ").toLowerCase();
      const motivo = (log.cancel_reason ?? "").toLowerCase();

      return (
        nomeFluxo.includes(termo) ||
        nomeContato.includes(termo) ||
        foneContato.includes(termo) ||
        kw.includes(termo) ||
        motivo.includes(termo)
      );
    });
  }, [logs, busca, filtroStatus]);

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder={t("Buscar por contato, telefone, fluxo ou palavra-chave...")}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtros rápidos de status */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setFiltroStatus("todos")}
              className={`rounded px-2.5 py-1 transition-colors ${
                filtroStatus === "todos"
                  ? "bg-background shadow-xs text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("Todos")} ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus("active")}
              className={`rounded px-2.5 py-1 transition-colors ${
                filtroStatus === "active"
                  ? "bg-background shadow-xs text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("Em Andamento")}
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus("completed")}
              className={`rounded px-2.5 py-1 transition-colors ${
                filtroStatus === "completed"
                  ? "bg-background shadow-xs text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("Concluídos")}
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus("cancelled")}
              className={`rounded px-2.5 py-1 transition-colors ${
                filtroStatus === "cancelled"
                  ? "bg-background shadow-xs text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("Bloqueados / Falhas")}
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void carregarLogs()}
            disabled={loading}
            className="gap-1.5 h-9"
          >
            <ArrowsClockwise size={16} className={loading ? "animate-spin" : ""} />
            {t("Atualizar")}
          </Button>
        </div>
      </div>

      {/* Tabela de Execuções */}
      <Card className="overflow-hidden border shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">{t("Data / Hora")}</th>
                <th className="px-4 py-3">{t("Fluxo")}</th>
                <th className="px-4 py-3">{t("Gatilho")}</th>
                <th className="px-4 py-3">{t("Contato")}</th>
                <th className="px-4 py-3">{t("Status")}</th>
                <th className="px-4 py-3">{t("Último Passo")}</th>
                <th className="px-4 py-3 text-right">{t("Detalhes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CircleNotch size={24} className="animate-spin text-primary" />
                      <span>{t("Carregando logs de execução das automações...")}</span>
                    </div>
                  </td>
                </tr>
              ) : logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock size={28} className="text-muted-foreground/60" />
                      <span className="font-medium text-foreground">
                        {t("Nenhum log de execução encontrado")}
                      </span>
                      <span className="text-xs">
                        {t("Quando um lead enviar uma mensagem que ative um gatilho, a execução aparecerá aqui.")}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => {
                  const dataInicio = new Date(log.started_at);
                  const dataFormatada = format(dataInicio, "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
                  const nomeFluxo = log.pointer?.name ?? t("Fluxo sem nome");
                  const triggerKind = log.pointer?.trigger_config?.kind ?? "inbound";
                  const keywords = log.pointer?.trigger_config?.params?.keywords ?? [];
                  const nomeContato = log.contact?.name || log.contact?.phone_number || t("Contato");
                  const foneContato = log.contact?.phone_number;
                  const ultEvento = log.events?.[log.events.length - 1];

                  return (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {dataFormatada}
                      </td>

                      <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                        <div className="flex items-center gap-2">
                          <TreeStructure size={16} className="text-primary shrink-0" />
                          <span className="truncate">{nomeFluxo}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {triggerKind === "keyword" ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-xs bg-muted/60">
                              {t("Palavra-chave")}
                            </Badge>
                            {keywords.map((k) => (
                              <Badge key={k} variant="secondary" className="text-xs font-semibold">
                                {k}
                              </Badge>
                            ))}
                          </div>
                        ) : triggerKind === "first_message" ? (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200">
                            {t("1ª Mensagem")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {triggerKind}
                          </Badge>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground text-xs">{nomeContato}</span>
                          {foneContato && (
                            <span className="text-[11px] text-muted-foreground">{foneContato}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.status === "active" || log.status === "waiting_reply" ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {log.status === "waiting_reply" ? t("Aguardando Resposta") : t("Em Execução")}
                          </Badge>
                        ) : log.status === "completed" ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 gap-1">
                            <CheckCircle size={13} weight="bold" />
                            {t("Concluído")}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300 gap-1"
                            title={log.cancel_reason ?? log.last_error ?? undefined}
                          >
                            <Warning size={13} weight="bold" />
                            {log.cancel_reason === "fora_da_lista_de_teste"
                              ? t("Canal em Teste")
                              : log.cancel_reason === "conversa_silenciada"
                              ? t("Conversa Silenciada")
                              : log.cancel_reason === "conversa_de_humano"
                              ? t("Com Atendente")
                              : t("Cancelado")}
                          </Badge>
                        )}
                      </td>

                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="text-xs truncate text-muted-foreground">
                          {ultEvento ? (
                            <span>{traduzirEvento(ultEvento.event_type, ultEvento.payload)}</span>
                          ) : (
                            <span className="text-muted-foreground/60">{log.current_node_id}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {log.conversation_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title={t("Abrir conversa no Inbox")}
                            >
                              <Link href={`/app/inbox?conversationId=${log.conversation_id}`}>
                                <ChatCircle size={16} />
                              </Link>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetalheLog(log)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title={t("Ver timeline de execução")}
                          >
                            <Eye size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal / Dialog de Timeline Detalhada da Execução */}
      <Dialog open={detalheLog !== null} onOpenChange={(open) => !open && setDetalheLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TreeStructure size={20} className="text-primary" />
              <span>{t("Detalhes da Execução da Automação")}</span>
            </DialogTitle>
            <DialogDescription>
              {detalheLog?.pointer?.name ?? t("Fluxo")} —{" "}
              {detalheLog?.contact?.name || detalheLog?.contact?.phone_number || t("Contato")}
            </DialogDescription>
          </DialogHeader>

          {detalheLog && (
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
              {/* Resumo do Status */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground block">{t("Status")}:</span>
                  <span className="font-semibold text-foreground uppercase">{detalheLog.status}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">{t("Nó Atual")}:</span>
                  <span className="font-semibold text-foreground">{detalheLog.current_node_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">{t("Iniciado em")}:</span>
                  <span className="font-semibold text-foreground">
                    {format(new Date(detalheLog.started_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </span>
                </div>
                {detalheLog.cancel_reason && (
                  <div className="col-span-2 sm:col-span-3 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded border border-rose-200">
                    <span className="font-semibold block">{t("Motivo de parada/bloqueio")}:</span>
                    <span>{traduzirMotivoBloqueio(detalheLog.cancel_reason)}</span>
                  </div>
                )}
              </div>

              {/* Linha do Tempo de Eventos */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("Linha do Tempo de Passos")} ({(detalheLog.events ?? []).length})
                </h4>

                {(detalheLog.events ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3 text-center">
                    {t("Nenhum evento registrado nesta execução ainda.")}
                  </p>
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {detalheLog.events?.map((ev, idx) => {
                      const hora = format(new Date(ev.created_at), "HH:mm:ss", { locale: ptBR });
                      return (
                        <div key={ev.id || idx} className="relative group">
                          {/* Marcador na linha */}
                          <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-background bg-primary shadow-xs" />

                          <div className="rounded-lg border bg-card p-3 shadow-2xs space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground">
                                {traduzirEvento(ev.event_type, ev.payload)}
                              </span>
                              <span className="text-muted-foreground text-[11px]">{hora}</span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {ev.node_id}
                              </Badge>
                              <span>{ev.event_type}</span>
                            </div>

                            {ev.payload && Object.keys(ev.payload).length > 0 && (
                              <pre className="text-[11px] bg-muted/60 p-2 rounded overflow-x-auto text-foreground/80 font-mono mt-1">
                                {JSON.stringify(ev.payload, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {detalheLog.conversation_id && (
                <div className="pt-2 flex justify-end">
                  <Button variant="outline" size="sm" asChild className="gap-2">
                    <Link href={`/app/inbox?conversationId=${detalheLog.conversation_id}`}>
                      <ChatCircle size={16} />
                      {t("Abrir conversa no Inbox")}
                      <ArrowSquareOut size={14} />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
