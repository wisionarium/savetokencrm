"use client";

import { Handle, Position } from "@xyflow/react";

import type { FlowBranch } from "@/lib/followup/graph-schema";
import { rotuloDoRamo } from "@/lib/followup/rotulo-do-ramo";
import type { NomesDeValor } from "@/lib/followup/vocabulario";
import { Warning } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/i18n/useT";
import { useEtapasDoFluxo } from "../EtapasDoFluxo";
import type { NodeVisual } from "./nodeVisuals";

function regraSemEtapa(branch: FlowBranch, nomes: NomesDeValor): boolean {
  const check = branch.check;
  if (check === null || check.field !== "lead_stage") return false;
  const valor = String(check.value).trim();
  return valor !== "" && nomes.etapa?.(valor) === null;
}

interface Props {
  id: string;
  visual: NodeVisual;
  label: string;
  subtitle: string;
  selected?: boolean;
  errors?: string[];
  showTarget?: boolean;
  showSource?: boolean;
  branches?: FlowBranch[];
  children?: React.ReactNode;
  headerBadge?: string;
  isWhatsApp?: boolean;
}

/**
 * NodeCard moderno inspirado no Manychat & Nextages AI:
 * Card arredondado (rounded-2xl), cabeçalho limpo com ícone e chip temático,
 * área de conteúdo interna (preview de mensagem ou notas) e conector
 * "Continuar ◯" na saída única ou ramos rotulados.
 */
export function NodeCard({
  id,
  visual,
  label,
  subtitle,
  selected,
  errors,
  showTarget = true,
  showSource = true,
  branches,
  children,
  headerBadge,
  isWhatsApp,
}: Props) {
  const t = useT();
  const { nomes } = useEtapasDoFluxo();
  const Icon = visual.icon;
  const hasError = (errors?.length ?? 0) > 0;
  const branchRows = branches !== undefined && branches.length > 1 ? branches : null;

  return (
    <div
      className={cn(
        "group relative w-64 rounded-2xl border bg-surface shadow-sm transition-all duration-200 hover:shadow-md",
        selected
          ? "border-primary ring-2 ring-primary/40 ring-offset-2 ring-offset-bg shadow-md"
          : "border-border/80 hover:border-border",
        hasError && "border-error ring-2 ring-error/40 ring-offset-2 ring-offset-bg",
      )}
      data-testid={`node-card-${id}`}
      title={hasError ? errors!.join("; ") : undefined}
    >
      {/* Target Handle (Entrada do nó) */}
      {showTarget && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !rounded-full !border-2 !border-primary/80 !bg-surface hover:!bg-primary transition-transform hover:!scale-125"
        />
      )}

      {/* Cabeçalho do Card */}
      <div
        className={cn(
          "flex items-center justify-between rounded-t-2xl px-3.5 py-2.5 border-b border-border/40",
          visual.type === "action" && !isWhatsApp && "bg-amber-50/60 dark:bg-amber-950/20",
          visual.type === "condition" && "bg-amber-50/40 dark:bg-amber-950/20",
          visual.type === "wait" && "bg-blue-50/40 dark:bg-blue-950/20",
          visual.type === "trigger" && "bg-emerald-50/40 dark:bg-emerald-950/20",
          visual.type === "ai_classify" && "bg-purple-50/40 dark:bg-purple-950/20",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isWhatsApp ? (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path
                d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.04 20.15C10.56 20.15 9.11 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.32 4.53 17.87 6.08C19.42 7.63 20.28 9.7 20.27 11.92C20.28 16.46 16.58 20.15 12.04 20.15ZM16.56 14.39C16.31 14.27 15.1 13.67 14.87 13.59C14.65 13.51 14.49 13.47 14.32 13.71C14.16 13.96 13.69 14.51 13.55 14.67C13.41 14.83 13.27 14.85 13.02 14.73C12.78 14.61 11.99 14.35 11.06 13.52C10.33 12.87 9.84 12.07 9.7 11.82C9.56 11.58 9.68 11.44 9.81 11.32C9.92 11.21 10.05 11.03 10.18 10.89C10.3 10.74 10.34 10.64 10.42 10.48C10.5 10.32 10.46 10.17 10.4 10.05C10.34 9.93 9.85 8.73 9.65 8.24C9.45 7.76 9.25 7.83 9.1 7.82C8.96 7.81 8.79 7.81 8.63 7.81C8.47 7.81 8.2 7.87 7.98 8.11C7.75 8.35 7.12 8.94 7.12 10.15C7.12 11.36 8 12.53 8.12 12.69C8.25 12.85 9.84 15.3 12.28 16.35C12.86 16.6 13.31 16.75 13.66 16.86C14.24 17.05 14.77 17.02 15.19 16.96C15.66 16.89 16.63 16.37 16.84 15.79C17.04 15.2 17.04 14.7 16.98 14.59C16.92 14.49 16.8 14.43 16.56 14.39Z"
                fill="#25D366"
              />
            </svg>
          ) : (
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg shadow-2xs",
                visual.chipClassName,
              )}
            >
              <Icon size={14} aria-hidden />
            </span>
          )}
          <p className="truncate text-xs font-semibold text-text" title={label}>
            {label}
          </p>
        </div>

        {headerBadge && (
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
            {headerBadge}
          </span>
        )}
      </div>

      {/* Conteúdo do Card */}
      <div className="p-3">
        {children ? (
          children
        ) : (
          <p className="line-clamp-2 break-words text-xs text-text-muted" title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Mensagem de Erro Inline */}
      {hasError && (
        <p
          className="border-t border-error/30 px-3 py-1.5 text-xs leading-snug text-error-fg"
          data-testid={`node-error-${id}`}
        >
          {errors![0]}
        </p>
      )}

      {/* Ramos Múltiplos (ex: Condição, AI Classify) */}
      {branchRows !== null && (
        <ul className="border-t border-border/60" data-testid={`node-branches-${id}`}>
          {branchRows.map((branch) => {
            const rotulo = t(rotuloDoRamo(branch, nomes));
            const semEtapa = regraSemEtapa(branch, nomes);
            return (
              <li
                key={branch.id}
                className={cn(
                  "relative flex items-center justify-between border-t border-border/40 px-3 py-1.5 first:border-t-0 hover:bg-muted/30 transition-colors",
                  branch.kind === "fallback" && "italic text-text-muted",
                  semEtapa && "text-warning-fg",
                )}
                data-testid={`node-branch-${id}-${branch.id}`}
                data-regra-sem-etapa={semEtapa || undefined}
                title={
                  semEtapa
                    ? `${rotulo} — ${t("Esta regra não aponta para uma etapa ativa do funil.")}`
                    : rotulo
                }
              >
                <div className="flex items-center gap-1.5 min-w-0 pr-4">
                  {semEtapa ? (
                    <Warning size={12} aria-hidden className="shrink-0" />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        branch.kind === "fallback" ? "bg-text-muted/50" : "bg-primary",
                      )}
                    />
                  )}
                  <span className="truncate text-xs leading-tight">{rotulo}</span>
                </div>
                <Handle
                  type="source"
                  id={branch.id}
                  position={Position.Right}
                  className="!relative !right-0 !transform-none !h-3 !w-3 !rounded-full !border-2 !border-primary/80 !bg-surface hover:!bg-primary transition-transform hover:!scale-125"
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* Saída Única estilo Manychat: 'Continuar ◯' */}
      {showSource && branchRows === null && (
        <div className="flex items-center justify-end border-t border-border/40 px-3 py-1.5 text-[11px] font-medium text-text-muted">
          <span className="mr-2 text-text-muted/80">{t("Continuar")}</span>
          <Handle
            type="source"
            position={Position.Right}
            className="!relative !right-0 !transform-none !h-3.5 !w-3.5 !rounded-full !border-2 !border-primary/80 !bg-surface hover:!bg-primary transition-transform hover:!scale-125 cursor-crosshair"
          />
        </div>
      )}
    </div>
  );
}
