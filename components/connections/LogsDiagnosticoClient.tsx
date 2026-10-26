"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowsClockwise,
  CheckCircle,
  Warning,
  WarningOctagon,
  Info,
  CircleNotch,
  Copy,
  Check,
  Trash,
  InstagramLogo,
  ArrowSquareOut,
  Play,
} from "@/lib/ui/icons";
import { useT } from "@/hooks/i18n/useT";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  category: "webhook" | "oauth" | "automation" | "diagnostic";
  title: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

interface DiagnosticsData {
  connected: boolean;
  hasPageId: boolean;
  hasPageToken: boolean;
  hasInstagramBusinessId: boolean;
  username: string | null;
  pageName: string | null;
  connectedAt: string | null;
  activeAutomationsCount: number;
  webhookUrl: string;
  verifyToken: string;
  appId: string;
  callbackUrl: string;
}

export function LogsDiagnosticoClient() {
  const t = useT();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/v1/channels/instagram/logs");
      const json = await res.json();
      if (json.ok && json.data) {
        setLogs(json.data.logs || []);
        setDiagnostics(json.data.diagnostics || null);
      }
    } catch {
      // fallback silencioso
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => fetchLogs(true), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestPing = async () => {
    setTestingPing(true);
    try {
      const res = await fetch("/api/v1/channels/instagram/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_ping" }),
      });
      if (res.ok) {
        await fetchLogs(true);
      }
    } finally {
      setTestingPing(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm(t("Tem certeza que deseja limpar o histórico de logs da organização?"))) return;
    setClearing(true);
    try {
      const res = await fetch("/api/v1/channels/instagram/logs", { method: "DELETE" });
      if (res.ok) {
        setLogs([]);
      }
    } finally {
      setClearing(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === "all") return true;
    return log.level === filterLevel || log.category === filterLevel;
  });

  const originUrl = typeof window !== "undefined" ? window.location.origin : "";
  const dynamicWebhookUrl = diagnostics?.webhookUrl || `${originUrl}/api/v1/webhooks/instagram`;
  const dynamicCallbackUrl = diagnostics?.callbackUrl || `${originUrl}/api/v1/channels/instagram/callback`;
  const verifyToken = diagnostics?.verifyToken || "tecla_crm_insta_webhook_2026";
  const appId = diagnostics?.appId || "1454524740075812";

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <InstagramLogo className="h-5 w-5 text-pink-500" />
            {t("Logs de Integração & Diagnóstico do Instagram / Meta")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("Monitore requisições de webhook da Meta, disparos de automações e resolução de permissões.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs()}
            disabled={refreshing}
            className="gap-1.5"
          >
            <ArrowsClockwise className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {t("Atualizar")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTestPing}
            disabled={testingPing}
            className="gap-1.5"
          >
            {testingPing ? (
              <CircleNotch className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 text-emerald-500" />
            )}
            {t("Testar Diagnóstico")}
          </Button>

          {logs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearLogs}
              disabled={clearing}
              className="text-muted-foreground hover:text-destructive gap-1.5"
            >
              <Trash className="h-4 w-4" />
              {t("Limpar")}
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status da Conexão */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t("Status da Conexão")}</span>
            {diagnostics?.connected ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                {t("Conectado")}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                {t("Pendente")}
              </Badge>
            )}
          </div>
          <div className="text-base font-semibold truncate">
            {diagnostics?.username ? `@${diagnostics.username}` : t("Nenhuma conta vinculada")}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {diagnostics?.pageName ? `Página: ${diagnostics.pageName}` : t("Conecte via Facebook OAuth")}
          </p>
        </div>

        {/* Webhook Endpoint */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t("Webhook da Meta")}</span>
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              {t("Pronto (200 OK)")}
            </Badge>
          </div>
          <div className="text-base font-semibold truncate font-mono text-xs pt-1">
            /api/v1/webhooks/instagram
          </div>
          <p className="text-xs text-muted-foreground">
            {t("Escutando DMs e comentários")}
          </p>
        </div>

        {/* Automações Ativas */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t("Automações Ativas")}</span>
            <Badge variant="secondary">
              {diagnostics?.activeAutomationsCount ?? 0} {t("regras")}
            </Badge>
          </div>
          <div className="text-2xl font-bold">
            {diagnostics?.activeAutomationsCount ?? 0}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("Regras ativas respondendo comentários")}
          </p>
        </div>

        {/* Total de Logs */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t("Eventos Registrados")}</span>
            <Badge variant="outline">{logs.length}</Badge>
          </div>
          <div className="text-2xl font-bold">{logs.length}</div>
          <p className="text-xs text-muted-foreground">
            {t("Últimos eventos capturados")}
          </p>
        </div>
      </div>

      {/* Guia de Resolução: Erro Invalid Scopes e Configuração da Meta */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Warning className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              {t("Como resolver o erro \"Invalid Scopes\" ou configurar a Meta")}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(
                "A Meta exige que o seu App no Meta for Developers tenha as permissões ativadas antes de permitir a autorização. Siga os 3 passos abaixo para liberar a conexão:"
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Passo 1 */}
          <div className="bg-background/80 rounded-lg p-3.5 border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">1. Abrir o App na Meta</span>
              <a
                href={`https://developers.facebook.com/apps/${appId}/`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {t("Abrir Painel")}
                <ArrowSquareOut className="h-3 w-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("Acesse o painel do seu app ")}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">
                {appId}
              </code>
              {t(" e clique no menu lateral em ")}
              <strong>{t("Casos de Uso")}</strong>
              {t(" ou ")}
              <strong>{t("Permissões e Recursos")}</strong>.
            </p>
          </div>

          {/* Passo 2 */}
          <div className="bg-background/80 rounded-lg p-3.5 border border-border/60 space-y-2">
            <div className="text-xs font-semibold text-primary">2. Adicionar as Permissões</div>
            <p className="text-xs text-muted-foreground">
              {t("Pesquise e clique em ")}
              <strong>{t("Adicionar")}</strong>
              {t(" para as seguintes permissões:")}
            </p>
            <div className="flex flex-wrap gap-1 font-mono text-[10px]">
              <span className="bg-muted px-1.5 py-0.5 rounded text-foreground">instagram_business_basic</span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-foreground">instagram_manage_messages</span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-foreground">instagram_manage_comments</span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-foreground">pages_show_list</span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-foreground">pages_read_engagement</span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-foreground">pages_manage_metadata</span>
            </div>
          </div>

          {/* Passo 3 */}
          <div className="bg-background/80 rounded-lg p-3.5 border border-border/60 space-y-2">
            <div className="text-xs font-semibold text-primary">3. Configurar Webhook na Meta</div>
            <p className="text-xs text-muted-foreground">
              {t("Em ")}
              <strong>{t("Webhooks → Instagram")}</strong>
              {t(", cadastre a URL e o Token:")}
            </p>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between bg-muted/60 px-2 py-1 rounded">
                <span className="truncate max-w-[190px]">{dynamicWebhookUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(dynamicWebhookUrl, "webhook")}
                  className="text-muted-foreground hover:text-foreground ml-1"
                >
                  {copiedKey === "webhook" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className="flex items-center justify-between bg-muted/60 px-2 py-1 rounded">
                <span className="truncate max-w-[190px]">{verifyToken}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(verifyToken, "token")}
                  className="text-muted-foreground hover:text-foreground ml-1"
                >
                  {copiedKey === "token" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seletor de Filtro de Logs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={filterLevel === "all" ? "default" : "outline"}
            onClick={() => setFilterLevel("all")}
            className="h-8 text-xs"
          >
            {t("Todos")} ({logs.length})
          </Button>
          <Button
            size="sm"
            variant={filterLevel === "error" ? "destructive" : "outline"}
            onClick={() => setFilterLevel("error")}
            className="h-8 text-xs gap-1"
          >
            <WarningOctagon className="h-3.5 w-3.5" />
            {t("Erros")} ({logs.filter((l) => l.level === "error").length})
          </Button>
          <Button
            size="sm"
            variant={filterLevel === "success" ? "default" : "outline"}
            onClick={() => setFilterLevel("success")}
            className="h-8 text-xs gap-1"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {t("Sucessos")} ({logs.filter((l) => l.level === "success").length})
          </Button>
          <Button
            size="sm"
            variant={filterLevel === "webhook" ? "secondary" : "outline"}
            onClick={() => setFilterLevel("webhook")}
            className="h-8 text-xs"
          >
            {t("Webhooks")} ({logs.filter((l) => l.category === "webhook").length})
          </Button>
          <Button
            size="sm"
            variant={filterLevel === "automation" ? "secondary" : "outline"}
            onClick={() => setFilterLevel("automation")}
            className="h-8 text-xs"
          >
            {t("Automações")} ({logs.filter((l) => l.category === "automation").length})
          </Button>
        </div>

        <span className="text-xs text-muted-foreground">
          {t("Atualização automática a cada 8s")}
        </span>
      </div>

      {/* Tabela / Lista de Logs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
            <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("Carregando logs...")}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Info className="h-8 w-8 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("Nenhum log registrado para este filtro.")}</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {t(
                  "Assim que a Meta validar o Webhook ou um seguidor comentar no seu Instagram, as requisições aparecerão em tempo real aqui."
                )}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleTestPing} disabled={testingPing}>
              {t("Simular Evento de Teste")}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const date = new Date(log.timestamp);
              const formattedTime = date.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
              const formattedDate = date.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              });

              return (
                <div
                  key={log.id}
                  className="p-4 hover:bg-muted/40 transition-colors space-y-2 cursor-pointer"
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Ícone de Nível */}
                      <div className="mt-0.5">
                        {log.level === "success" && (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        )}
                        {log.level === "error" && (
                          <WarningOctagon className="h-4 w-4 text-red-500" />
                        )}
                        {log.level === "warn" && (
                          <Warning className="h-4 w-4 text-amber-500" />
                        )}
                        {log.level === "info" && (
                          <Info className="h-4 w-4 text-blue-500" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{log.title}</span>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                            {log.category}
                          </Badge>
                          <Badge
                            variant={
                              log.level === "error"
                                ? "destructive"
                                : log.level === "success"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-[10px] uppercase font-mono px-1.5 py-0"
                          >
                            {log.level}
                          </Badge>
                        </div>

                        {log.details && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {log.details}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono text-muted-foreground">
                        {formattedTime}
                      </span>
                      <p className="text-[10px] text-muted-foreground/70 font-mono">
                        {formattedDate}
                      </p>
                    </div>
                  </div>

                  {/* Detalhes Expandidos / Metadados */}
                  {isExpanded && log.metadata && (
                    <div
                      className="mt-3 bg-muted/70 p-3 rounded-lg border border-border/80 text-xs font-mono overflow-x-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <pre className="text-[11px] leading-snug">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
