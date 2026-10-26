"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { copyToClipboard } from "@/lib/clipboard";
import { useT } from "@/hooks/i18n/useT";
import {
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  Copy,
  InstagramLogo,
  ShieldCheck,
  TreeStructure,
  Warning,
  ChatCircle,
} from "@/lib/ui/icons";
import Link from "next/link";

export function CanalInstagramClient() {
  const t = useT();
  const searchParams = useSearchParams();
  const [conectando, setConectando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const sucesso = searchParams.get("sucesso");
  const erro = searchParams.get("erro");

  useEffect(() => {
    if (sucesso === "conectado") {
      toast.success(t("Conta do Instagram conectada com sucesso!"));
    } else if (erro) {
      toast.error(t(`Não foi possível conectar: ${erro}`));
    }
  }, [sucesso, erro, t]);

  const iniciarOAuth = () => {
    setConectando(true);
    window.location.href = "/api/v1/channels/instagram/start";
  };

  const [webhookUrl, setWebhookUrl] = useState("/api/v1/webhooks/instagram");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/v1/webhooks/instagram`);
    }
  }, []);

  const copiarWebhook = async () => {
    await copyToClipboard(webhookUrl);
    setCopiado(true);
    toast.success(t("URL do webhook copiada!"));
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Banner Principal de Conexão */}
      <Card className="relative overflow-hidden border p-6 bg-gradient-to-br from-card to-muted/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-md">
              <InstagramLogo size={32} weight="bold" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {t("Instagram Direct & Comentários")}
                </h3>
                {sucesso === "conectado" ? (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <CheckCircle size={12} className="mr-1 inline text-emerald-600" />
                    {t("Conectado")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    {t("Pronto para conectar")}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                {t(
                  "Conecte sua conta do Instagram via Login da Meta para automatizar respostas a comentários em Posts/Reels e mensagens no Direct estilo ManyChat.",
                )}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/app/connections?aba=logs">
              <Button type="button" variant="outline" size="lg" className="gap-2">
                <ArrowsClockwise size={18} />
                {t("Logs & Diagnóstico")}
              </Button>
            </Link>
            <Button
              type="button"
              size="lg"
              onClick={iniciarOAuth}
              disabled={conectando}
              className="bg-[#1877F2] hover:bg-[#166fe5] text-white font-medium shadow-sm gap-2"
            >
              {conectando ? (
                <>
                  <CircleNotch size={18} className="animate-spin" />
                  {t("Abrindo Meta…")}
                </>
              ) : (
                <>
                  <InstagramLogo size={20} weight="bold" />
                  {t("Conectar com Facebook / Meta")}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Informações dos recursos ativos */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-5">
          <div className="flex items-start gap-3 rounded-lg border bg-card/60 p-3">
            <div className="rounded-md bg-purple-100 p-2 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <ChatCircle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-medium">{t("Respostas em DMs")}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("Respostas instantâneas personalizadas guiadas por IA ou automações.")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-card/60 p-3">
            <div className="rounded-md bg-rose-100 p-2 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <TreeStructure size={20} />
            </div>
            <div>
              <h4 className="text-sm font-medium">{t("Automação de Comentários")}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("Envie um direct privado automático com link para quem comentar no Reels.")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-card/60 p-3">
            <div className="rounded-md bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-medium">{t("API Oficial da Meta")}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("100% em conformidade com as diretrizes e termos de serviço do Instagram.")}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Configurações Técnicas de Callback & Webhook */}
      <Card className="border p-6 space-y-4">
        <div>
          <h4 className="text-base font-semibold text-foreground">
            {t("Dados de Callback & Webhook")}
          </h4>
          <p className="text-sm text-muted-foreground">
            {t(
              "Estes dados já estão validados no seu app da Meta Developers. Mantenha para fins de auditoria ou reconexão.",
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("URL de Callback (Webhook)")}
            </span>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs font-mono text-foreground select-all break-all">
                {webhookUrl}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={copiarWebhook}
                title={t("Copiar URL")}
              >
                {copiado ? <CheckCircle size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("Token de Verificação")}
            </span>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs font-mono text-foreground select-all">
                tecla_crm_insta_webhook_2026
              </code>
              <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-600">
                {t("Validado na Meta")}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {t("Para configurar os fluxos de mensagens automáticas após conectar, acesse a aba ")}
            <Link href="/app/automacoes" className="text-primary underline font-medium">
              {t("Automações")}
            </Link>
            .
          </p>
        </div>
      </Card>
    </div>
  );
}
