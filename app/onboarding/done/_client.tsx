"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { Button } from "@/components/ui/button";
import { finishOnboarding } from "@/app/actions/onboarding/finishOnboarding";
import type { ItemDoResumo } from "@/lib/onboarding/passos";

export function DoneClient({
  orgName,
  itens,
}: {
  orgName: string;
  itens: ItemDoResumo[];
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-lg space-y-8 rounded-2xl border bg-card p-8 text-center shadow-lg transition-all animate-in fade-in-50 zoom-in-95">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
        <svg
          className="h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t("Parabéns!")}
        </h2>
        <p className="text-base text-muted-foreground">
          {t("Sua empresa")} <strong className="text-foreground">{orgName}</strong>{" "}
          {t("está configurada com sucesso no Tecla CRM.")}
        </p>
      </div>

      <div className="rounded-xl border bg-muted/40 p-5 text-left text-sm">
        <p className="mb-3 font-semibold text-foreground">
          {t("Etapas concluídas:")}
        </p>
        <ul className="space-y-2.5">
          {itens.map((it) => (
            <li key={it.segmento} className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  it.feito
                    ? "bg-emerald-600 text-white"
                    : "bg-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {it.feito ? "✓" : "–"}
              </span>
              <span className={it.feito ? "font-medium text-foreground" : "text-muted-foreground"}>
                {t(it.rotulo)}
                {it.pulado ? ` (${t("configurar depois")})` : it.feito ? " (" + t("concluído") + ")" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 pt-2">
        <Button
          type="button"
          size="lg"
          className="w-full text-base font-semibold shadow-md"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await finishOnboarding();
              if (res && !res.ok) toast.error(`${t("Falha ao concluir:")} ${res.error}`);
            })
          }
        >
          {pending ? t("Acessando o painel...") : t("Começar agora")} →
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("Você será direcionado diretamente ao painel de atendimento.")}
        </p>
      </div>
    </div>
  );
}
