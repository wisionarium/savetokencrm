"use client";

import Link from "next/link";
import { useT } from "@/hooks/i18n/useT";
import { useContactStats } from "@/hooks/contacts/useContactStats";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Trash, Warning, CheckCircle } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export function LimiteContatosCard({ className }: { className?: string }) {
  const t = useT();
  const { data: stats, isLoading } = useContactStats();

  const total = stats?.total ?? 0;
  const limit = stats?.limit ?? 100_000;
  const percentage = Math.min(stats?.percentage ?? 0, 100);
  const exceeded = stats?.exceeded ?? false;
  const overage = stats?.overage ?? 0;
  const overageCost = ((stats?.overage_cost_cents ?? 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <Card
      className={cn(
        "p-5 transition-colors",
        exceeded
          ? "border-destructive/60 bg-destructive/5 dark:bg-destructive/10"
          : "border-border bg-card",
        className,
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                exceeded
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/10 text-primary",
              )}
            >
              <Users size={18} aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("Limite Mensal de Contatos")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("100.000 contatos inclusos por mês")}
              </p>
            </div>
          </div>

          {exceeded ? (
            <Badge variant="destructive" className="flex items-center gap-1 font-semibold">
              <Warning size={13} aria-hidden />
              {t("Limite Excedido")} (+{overage.toLocaleString("pt-BR")})
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              <CheckCircle size={13} className="text-emerald-500" aria-hidden />
              {t("Dentro da Franquia")}
            </Badge>
          )}
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={exceeded ? "text-destructive font-semibold" : "text-foreground"}>
              {isLoading
                ? t("Carregando...")
                : `${total.toLocaleString("pt-BR")} / ${limit.toLocaleString("pt-BR")} ${t("contatos")}`}
            </span>
            <span
              className={cn(
                "font-mono text-xs",
                exceeded ? "text-destructive font-bold" : "text-muted-foreground",
              )}
            >
              {isLoading ? "..." : `${stats?.percentage ?? 0}%`}
            </span>
          </div>

          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                exceeded ? "bg-destructive" : "bg-emerald-500",
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Informação sobre taxa e liberação de espaço */}
        <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1.5 border border-border/60">
          {exceeded ? (
            <p className="text-destructive font-medium leading-relaxed">
              ⚠️{" "}
              {t("Você ultrapassou o limite de 100k contatos. Contatos adicionais são cobrados à taxa de R$ 0,05 por contato")}{" "}
              ({overageCost} {t("adicionais")}).{" "}
              <strong>
                {t("Apague contatos inativos para liberar espaço imediatamente e zerar cobranças extras.")}
              </strong>
            </p>
          ) : (
            <p className="text-muted-foreground leading-relaxed">
              {t(
                "O plano contempla até 100.000 contatos mensais. Caso ultrapasse, é cobrado um valor de R$ 0,05 por contato excedente. Você pode apagar contatos antigos a qualquer momento para liberar espaço.",
              )}
            </p>
          )}
        </div>

        {/* Botão de Ação para Gerenciar e Apagar Contatos */}
        <div className="flex items-center justify-end pt-1">
          <Button asChild variant={exceeded ? "destructive" : "outline"} size="sm" className="gap-1.5 text-xs">
            <Link href="/app/contacts">
              <Trash size={14} aria-hidden />
              {t("Gerenciar e Apagar Contatos")}
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

