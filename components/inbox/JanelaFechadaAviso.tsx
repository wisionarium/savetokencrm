"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";

import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { useSendMessage } from "@/hooks/inbox/useSendMessage";
import { useSyncTemplates } from "@/hooks/channels/useTemplates";
import { fonteDeTemplates, rotaDeTemplates } from "@/lib/channels/templates-fonte";
import { lerConteudo } from "@/lib/channels/template-conteudo";
import { ArrowBendUpLeft, ArrowsClockwise, PaperPlaneTilt, Warning, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * A janela fechou — e aqui está o caminho de volta.
 *
 * ─── Visibilidade e Controle do Operador ────────────────────────────────────
 *
 * O operador precisa:
 * 1. Ver os modelos existentes (inclusive os em análise na Meta).
 * 2. Poder VOLTAR AO CHAT NORMAL a qualquer momento sem ficar preso.
 * 3. Poder MINIMIZAR esta barra para ela não ocupar metade da tela.
 * 4. Sincronizar com a Meta direto daqui.
 */
interface Modelo {
  name: string;
  language: string;
  status: string;
  slots?: unknown[];
  components?: unknown[];
}

function textoDoModelo(modelo: Modelo): string {
  return lerConteudo(modelo.components ?? []).body?.trim() || modelo.name;
}

export function JanelaFechadaAviso({
  conversationId,
  provider,
  motivo,
  recolhido = false,
  onAlternarRecolhido,
  onVoltarChatNormal,
}: {
  conversationId: string;
  /** Decide de ONDE vêm as definições. A tela não interpreta este valor. */
  provider: string | null;
  motivo: string;
  recolhido?: boolean;
  onAlternarRecolhido?: (recolhido: boolean) => void;
  onVoltarChatNormal?: () => void;
}) {
  const t = useT();
  const send = useSendMessage();
  const sync = useSyncTemplates();
  const [escolhido, setEscolhido] = useState("");
  const [localRecolhido, setLocalRecolhido] = useState(false);

  const isRecolhido = recolhido || localRecolhido;

  function alternarRecolhido(novo: boolean) {
    setLocalRecolhido(novo);
    onAlternarRecolhido?.(novo);
  }

  function handleVoltarChat() {
    alternarRecolhido(true);
    onVoltarChatNormal?.();
  }

  const fonte = fonteDeTemplates(provider);
  const { data, isFetching } = useQuery({
    queryKey: ["templates-da-conversa", fonte],
    enabled: fonte !== null,
    queryFn: async () =>
      apiClient.get<{ data: { waba?: string | null; templates: Modelo[] } }>(
        rotaDeTemplates(fonte!),
      ),
    staleTime: 30_000,
  });

  const todos = useMemo(() => data?.data.templates ?? [], [data]);

  const aprovados = useMemo(
    () => todos.filter((tpl) => tpl.status?.toUpperCase() === "APPROVED"),
    [todos],
  );

  const pendentes = useMemo(
    () => todos.filter((tpl) => tpl.status?.toUpperCase() === "PENDING"),
    [todos],
  );

  const outros = useMemo(
    () =>
      todos.filter(
        (tpl) =>
          tpl.status?.toUpperCase() !== "APPROVED" && tpl.status?.toUpperCase() !== "PENDING",
      ),
    [todos],
  );

  const atual = aprovados.find((tpl) => `${tpl.name}|${tpl.language}` === escolhido) ?? null;
  const pedeParametros = (atual?.slots?.length ?? 0) > 0;
  const isHelloWorld = atual?.name === "hello_world";

  async function handleSync() {
    try {
      const res = await sync.mutateAsync();
      const { inserted, updated } = res.data;
      toast.success(
        `${t("Modelos sincronizados:")} ${inserted} ${t("novo(s),")} ${updated} ${t("atualizado(s).")}`,
      );
    } catch {
      toast.error(t("Não foi possível sincronizar os modelos com a Meta no momento."));
    }
  }

  function enviar() {
    if (!atual) return;

    if (isHelloWorld) {
      toast.error(
        t(
          "O modelo 'hello_world' só é permitido pela Meta em números de teste de desenvolvedor. Em números reais, utilize um modelo próprio aprovado na Meta.",
        ),
      );
      return;
    }

    send.mutate(
      {
        conversation_id: conversationId,
        type: "template",
        template_name: atual.name,
        template_language: atual.language,
        body: textoDoModelo(atual),
      },
      {
        onSuccess: (res) => {
          const msg = res?.data;
          if (msg?.status === "failed") {
            if (msg.error_message?.includes("131058") || atual?.name === "hello_world") {
              toast.error(
                t(
                  "A Meta recusou o envio: o modelo 'hello_world' só pode ser enviado em números de teste. Em números comerciais reais, a Meta exige um modelo próprio aprovado.",
                ),
              );
            } else {
              toast.error(
                msg.error_message
                  ? `${t("Erro de envio da Meta:")} ${msg.error_message}`
                  : t("Não consegui enviar o modelo."),
              );
            }
            return;
          }
          setEscolhido("");
          toast.success(t("Modelo enviado — a janela reabre quando o cliente responder."));
        },
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : t("Não consegui enviar o modelo.")),
      },
    );
  }

  if (isRecolhido) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-warning/40 bg-warning-bg/90 px-4 py-2 text-xs text-warning-fg transition-all">
        <div className="flex min-w-0 items-center gap-1.5">
          <Warning size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="truncate font-medium">{motivo}</span>
          <span className="hidden sm:inline opacity-80">
            — {t("só modelos aprovados garantem entrega fora de 24h")}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => alternarRecolhido(false)}
            className="h-7 gap-1.5 border-warning/60 bg-background/90 px-2.5 text-xs text-foreground hover:bg-background"
          >
            <PaperPlaneTilt size={12} />
            {t("Abrir modelos")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={sync.isPending || isFetching}
            className="h-7 w-7 p-0 text-warning-fg hover:bg-warning/20"
            title={t("Sincronizar modelos com a Meta")}
          >
            <ArrowsClockwise
              size={12}
              className={sync.isPending || isFetching ? "animate-spin" : ""}
            />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-warning/40 bg-warning-bg px-4 py-3 text-warning-fg transition-all">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Warning size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs font-semibold">{motivo}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleVoltarChat}
            className="h-7 gap-1.5 border-warning/60 bg-background/90 px-2.5 text-xs font-medium text-foreground hover:bg-background shadow-xs"
            title={t("Voltar para o campo de digitação do chat normal")}
          >
            <ArrowBendUpLeft size={13} />
            {t("Voltar ao chat normal")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={sync.isPending || isFetching}
            className="h-7 gap-1 px-2 text-xs text-warning-fg hover:bg-warning/20"
            title={t("Checar se a Meta já aprovou seus modelos pendentes")}
          >
            <ArrowsClockwise
              size={12}
              className={sync.isPending || isFetching ? "animate-spin" : ""}
            />
            {sync.isPending || isFetching ? t("Sincronizando…") : t("Sincronizar")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => alternarRecolhido(true)}
            className="h-7 w-7 p-0 text-warning-fg hover:bg-warning/20"
            title={t("Minimizar aviso (Esc)")}
            aria-label={t("Minimizar aviso")}
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {aprovados.length === 0 ? (
        <div className="flex flex-col gap-1.5 text-xs opacity-90">
          {pendentes.length > 0 ? (
            <p>
              ⏳ {t("Você tem modelo(s) em análise na Meta:")}{" "}
              <strong>{pendentes.map((p) => `${p.name} (${p.language})`).join(", ")}</strong>.{" "}
              {t(
                "Aguarde a aprovação da Meta (costuma levar alguns minutos a 24h) e clique em 'Sincronizar' para liberar o envio.",
              )}
            </p>
          ) : (
            <p>
              {t("Nenhum modelo aprovado ainda. Crie um em")}{" "}
              <Link href="/app/connections?aba=oficial&sub=templates" className="font-semibold underline">
                {t("Conexões → Templates da Meta")}
              </Link>{" "}
              {t("e envie quando a plataforma aprovar.")}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={escolhido}
              onChange={(e) => setEscolhido(e.target.value)}
              disabled={send.isPending || sync.isPending}
              aria-label={t("Modelo de mensagem")}
              className={cn(
                "h-9 min-w-[16rem] flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground",
                "focus:outline-hidden focus:ring-1 focus:ring-ring",
              )}
            >
              <option value="">{t("Escolha um modelo aprovado…")}</option>
              {aprovados.length > 0 && (
                <optgroup label={t("Modelos aprovados para envio")}>
                  {aprovados.map((tpl) => (
                    <option
                      key={`${tpl.name}|${tpl.language}`}
                      value={`${tpl.name}|${tpl.language}`}
                    >
                      {tpl.name} ({tpl.language})
                      {tpl.name === "hello_world" ? ` [${t("Teste da Meta - não envia em número real")}]` : ""}
                      {(tpl.slots?.length ?? 0) > 0 ? ` · ${tpl.slots!.length} ${t("parâmetro(s)")}` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {pendentes.length > 0 && (
                <optgroup label={t("Em análise pela Meta (aguardando aprovação)")}>
                  {pendentes.map((tpl) => (
                    <option
                      key={`${tpl.name}|${tpl.language}`}
                      value=""
                      disabled
                    >
                      ⏳ {tpl.name} ({tpl.language}) — {t("Em análise")}
                    </option>
                  ))}
                </optgroup>
              )}
              {outros.length > 0 && (
                <optgroup label={t("Outros status na Meta")}>
                  {outros.map((tpl) => (
                    <option
                      key={`${tpl.name}|${tpl.language}`}
                      value=""
                      disabled
                    >
                      ❌ {tpl.name} ({tpl.language}) — {tpl.status}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <Button
              type="button"
              size="sm"
              onClick={enviar}
              disabled={!atual || isHelloWorld || send.isPending}
            >
              {send.isPending ? t("Enviando…") : t("Enviar modelo")}
            </Button>
          </div>

          {isHelloWorld && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/15 p-2 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-1.5">
                <Warning size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold">
                    {t("O modelo 'hello_world' não pode ser enviado para este contato:")}
                  </p>
                  <p className="mt-0.5">
                    {t(
                      "A Meta só autoriza o envio do 'hello_world' a partir dos números de teste de desenvolvedor. Em números comerciais reais (+55 21 99612-3100), a Meta bloqueia o envio com erro #131058. Utilize um modelo próprio aprovado na Meta para abrir esta conversa.",
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {pendentes.length > 0 && (
            <p className="text-[11px] opacity-80">
              💡 {t("Você tem")} <strong>{pendentes.map((p) => p.name).join(", ")}</strong>{" "}
              {t(
                "em análise pela Meta. Quando a Meta aprovar, clique no botão 'Sincronizar' acima para habilitar o envio aqui.",
              )}
            </p>
          )}

          {atual && !isHelloWorld && (
            <div className="rounded-md border border-warning/30 bg-background/90 p-2.5 text-xs text-foreground">
              <span className="font-medium text-muted-foreground">{t("Texto que será enviado:")}</span>
              <p className="mt-1 whitespace-pre-wrap">{textoDoModelo(atual)}</p>
            </div>
          )}

          {pedeParametros && (
            <p className="text-[11px] opacity-80">
              {t("Este modelo pede")} {atual?.slots?.length}{" "}
              {t("valor(es) e ainda não dá para preenchê-los aqui — envie por")}{" "}
              <Link href="/app/connections?aba=oficial&sub=templates" className="font-semibold underline">
                {t("Conexões → Templates")}
              </Link>
              , {t("ou escolha um modelo sem parâmetros.")}
            </p>
          )}
        </div>
      )}

      <div className="mt-2.5 pt-1">
        <Link
          href="/app/connections?aba=oficial&sub=templates"
          className="text-[11px] text-warning-fg/80 underline hover:text-warning-fg"
        >
          {t("Ver todos os modelos da conta em Conexões → Templates da Meta ↗")}
        </Link>
      </div>
    </div>
  );
}
