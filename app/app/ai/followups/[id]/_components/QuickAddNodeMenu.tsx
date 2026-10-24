"use client";

import { useEffect, useRef } from "react";
import {
  ChatCircle,
  Lightning,
  GitBranch,
  Clock,
  Brain,
  Users,
  Flag,
  X,
} from "@phosphor-icons/react/dist/ssr";
import type { NodeType } from "@/lib/followup/graph-schema";
import { useT } from "@/hooks/i18n/useT";

export interface QuickAddOption {
  id: string;
  type: NodeType;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  iconColor: string;
  iconBg: string;
  presetConfig?: Record<string, unknown>;
}

interface Props {
  position: { x: number; y: number };
  onSelect: (type: NodeType, presetConfig?: Record<string, unknown>) => void;
  onClose: () => void;
  title?: string;
}

export function QuickAddNodeMenu({ position, onSelect, onClose, title }: Props) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Limita a posição para não vazar da janela
  const screenX = typeof window !== "undefined" ? Math.min(position.x, window.innerWidth - 300) : position.x;
  const screenY = typeof window !== "undefined" ? Math.min(position.y, window.innerHeight - 440) : position.y;

  const options: { section: string; items: QuickAddOption[] }[] = [
    {
      section: t("Mensagens"),
      items: [
        {
          id: "send_message",
          type: "action",
          title: t("Enviar Mensagem"),
          subtitle: t("WhatsApp, texto, mídia ou botões"),
          icon: ChatCircle,
          iconColor: "text-emerald-500",
          iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
          presetConfig: {
            mode: "text",
            body: t("Olá! Como posso te ajudar hoje?"),
          },
        },
      ],
    },
    {
      section: t("Lógica e Roteamento"),
      items: [
        {
          id: "condition",
          type: "condition",
          title: t("Condição"),
          subtitle: t("Bifurcação SE / ENTÃO por regras"),
          icon: GitBranch,
          iconColor: "text-amber-500",
          iconBg: "bg-amber-50 dark:bg-amber-950/40",
          presetConfig: {
            combinator: "and",
            branching: "combined",
            checks: [{ field: "lead_stage", op: "eq", value: "" }],
          },
        },
        {
          id: "wait",
          type: "wait",
          title: t("Esperar"),
          subtitle: t("Delay em minutos, horas ou dias"),
          icon: Clock,
          iconColor: "text-blue-500",
          iconBg: "bg-blue-50 dark:bg-blue-950/40",
          presetConfig: { mode: "fixed", duration_ms: 900_000 },
        },
        {
          id: "ai_classify",
          type: "ai_classify",
          title: t("Classificar (IA)"),
          subtitle: t("Interpreta intenção com IA"),
          icon: Brain,
          iconColor: "text-purple-500",
          iconBg: "bg-purple-50 dark:bg-purple-950/40",
          presetConfig: {
            classes: ["Interessado", "Sem interesse"],
            grace_timeout_ms: 900_000,
            target: "last_reply",
          },
        },
      ],
    },
    {
      section: t("Ações e Handoff"),
      items: [
        {
          id: "action_notes",
          type: "action",
          title: t("Ações do CRM"),
          subtitle: t("Etiquetas, notas e etapas"),
          icon: Lightning,
          iconColor: "text-amber-600",
          iconBg: "bg-amber-100/70 dark:bg-amber-950/50",
          presetConfig: {
            mode: "ai_message",
            prompt_hint: t("Registrar nota e atualizar status"),
          },
        },
        {
          id: "handoff_human",
          type: "end",
          title: t("Transferir para Humano"),
          subtitle: t("Chama um atendente na fila"),
          icon: Users,
          iconColor: "text-sky-500",
          iconBg: "bg-sky-50 dark:bg-sky-950/40",
          presetConfig: { outcome: "handed_off" },
        },
        {
          id: "end_flow",
          type: "end",
          title: t("Fim do Fluxo"),
          subtitle: t("Encerra a automação"),
          icon: Flag,
          iconColor: "text-rose-500",
          iconBg: "bg-rose-50 dark:bg-rose-950/40",
          presetConfig: { outcome: "exhausted" },
        },
      ],
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{ left: `${screenX}px`, top: `${screenY}px` }}
      className="fixed z-50 w-72 rounded-2xl border border-border bg-surface/95 p-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95"
    >
      <div className="flex items-center justify-between border-b border-border/60 px-2 pb-2 mb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {title ?? t("Criar próximo passo")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-text-muted hover:bg-muted hover:text-text transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto space-y-3 py-1 pr-0.5">
        {options.map((sec) => (
          <div key={sec.section} className="space-y-1">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-text-muted/70">
              {sec.section}
            </p>
            {sec.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.type, item.presetConfig)}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all hover:bg-muted/70 active:scale-[0.98]"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${item.iconBg} ${item.iconColor}`}
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-text group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="truncate text-[11px] text-text-muted">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
