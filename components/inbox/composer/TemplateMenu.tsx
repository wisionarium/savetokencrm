"use client";
import { useT } from "@/hooks/i18n/useT";
import type { MessageTemplate } from "@/hooks/inbox/useMessageTemplates";
import { X, Zap } from "lucide-react";

/** Estado do slash-menu a partir do texto do composer. Puro (testável). */
export function resolveSlash(text: string): { open: boolean; query: string } {
  if (!text.startsWith("/")) return { open: false, query: "" };
  const rest = text.slice(1);
  if (/\s/.test(rest)) return { open: false, query: "" };
  return { open: true, query: rest };
}

interface Props {
  open: boolean;
  query: string;
  templates: MessageTemplate[];
  onPick: (t: MessageTemplate) => void;
  onPickFlow?: () => void;
  onClose: () => void;
}

export function TemplateMenu({ open, query, templates, onPick, onPickFlow, onClose }: Props) {
  const t = useT();
  if (!open) return null;
  const q = query.toLowerCase();
  const filtered = templates.filter(
    (tpl) => tpl.title.toLowerCase().includes(q) || (tpl.shortcut ?? "").toLowerCase().includes(q),
  );

  const showFlowOption = !q || "fluxos de disparo".includes(q) || "disparo".includes(q) || "fluxo".includes(q);

  return (
    <>
      {/*
        O CLIQUE FORA FECHA. Antes este menu era uma caixa sem saída: o "/"
        plantado no campo abria a lista e nem o backdrop nem o Esc a
        dispensavam — só escolher um item. Um painel que não fecha é um beco,
        e no telefone ele ainda cobre metade do fio.
      */}
      <div
        className="fixed inset-0 z-20"
        aria-hidden
        onPointerDown={onClose}
        onClick={onClose}
      />
      <div
        className="absolute bottom-14 left-3 z-30 max-h-64 w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
        role="dialog"
        aria-label={t("Menu de atalhos e templates")}
      >
        <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-1 flex items-center justify-between gap-2 border-b border-border bg-popover px-3 py-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("Atalhos")}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Fechar")}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {showFlowOption && onPickFlow && (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md bg-accent/30 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onPickFlow();
            }}
          >
            <Zap size={16} className="text-primary shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{t("Fluxos de Disparo")}</span>
              <span className="text-xs text-muted-foreground">{t("Enviar imagem + especificações ao cliente")}</span>
            </div>
          </button>
        )}

        {filtered.length === 0 && !showFlowOption ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{t("Nenhum resultado encontrado.")}</div>
        ) : (
          filtered.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-muted"
              onClick={() => onPick(tpl)}
            >
              <span className="text-sm font-medium">{tpl.title}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{tpl.body}</span>
            </button>
          ))
        )}
      </div>
    </>
  );
}
