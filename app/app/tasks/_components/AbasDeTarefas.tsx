"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/hooks/i18n/useT";
import { CalendarBlank, ListChecks } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Navegação interna da Tarefas: a lista e a agenda da equipe são a MESMA
 * história — "o que ficou combinado, com prazo" — contada em duas vistas. A
 * Agenda deixou de ser item de menu próprio (simplificação) e mora aqui, a um
 * clique de distância.
 */
const ABAS = [
  { href: "/app/tasks", rotulo: "Tarefas", Icone: ListChecks },
  { href: "/app/tasks/agenda", rotulo: "Agenda", Icone: CalendarBlank },
] as const;

export function AbasDeTarefas() {
  const t = useT();
  const pathname = usePathname();
  return (
    <div
      role="tablist"
      aria-label={t("Tarefas e agenda")}
      className="inline-flex items-center gap-0.5 rounded-md border bg-muted p-0.5"
    >
      {ABAS.map(({ href, rotulo, Icone }) => {
        const ativa = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={ativa}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              ativa
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icone size={14} aria-hidden />
            {t(rotulo)}
          </Link>
        );
      })}
    </div>
  );
}
