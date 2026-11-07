"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Lightning } from "@phosphor-icons/react/dist/ssr";

import type { RFNode } from "@/lib/followup/graph-mappers";
import type { ActionButton } from "@/lib/followup/graph-schema";
import { useT } from "@/hooks/i18n/useT";
import { NODE_VISUALS, IMAGE_NODE_VISUAL, describeNodeConfig } from "./nodeVisuals";
import { NodeCard } from "./NodeCard";

export function ActionNode({ id, data, selected }: NodeProps<RFNode>) {
  const t = useT();
  const config = (data.config ?? {}) as Record<string, unknown>;
  const mode = (config.mode as string) ?? "text";
  const mediaUrl = typeof config.media_url === "string" ? config.media_url : "";
  const isImage = Boolean(mediaUrl);

  const isMessageAction = mode === "text" || mode === "template" || mode === "ai_message";
  const rawBodyText = typeof config.body === "string" ? config.body : "";
  const promptHint = typeof config.prompt_hint === "string" ? config.prompt_hint : "";
  const buttons = Array.isArray(config.buttons) ? (config.buttons as ActionButton[]) : [];

  // Se já há botões reais configurados, limpa marcadores legados [1]... do preview
  const bodyText = buttons.length > 0
    ? rawBodyText.replace(/\n\s*\[(?:[0-9]+|Opção\s+[0-9]+|[a-zA-Z0-9_\s]+)\].*$/gim, "").trim()
    : rawBodyText;

  return (
    <NodeCard
      id={id}
      visual={isImage ? IMAGE_NODE_VISUAL : NODE_VISUALS.action}
      label={data.label || (isMessageAction ? t("Enviar Mensagem") : t("Ações"))}
      subtitle={describeNodeConfig("action", data.config, t)}
      selected={selected}
      errors={data.errors}
      isWhatsApp={isMessageAction}
    >
      {isImage && (
        <div className="mb-2 overflow-hidden rounded-xl border border-border/60 bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt="Thumbnail"
            className="h-28 w-full object-cover transition-transform hover:scale-105"
          />
        </div>
      )}

      {isMessageAction ? (
        <>
          <div className="rounded-xl bg-muted/60 dark:bg-muted/40 p-2.5 text-xs text-text/90 border border-border/40 shadow-2xs">
            <p className="line-clamp-3 break-words whitespace-pre-wrap font-normal">
              {bodyText || (mode === "ai_message" ? promptHint : t("Mensagem..."))}
            </p>
          </div>

          {buttons.length > 0 && (
            <div className="mt-2 space-y-1.5" data-testid={`action-buttons-${id}`}>
              {buttons.map((btn) => (
                <div
                  key={btn.id}
                  className="relative flex items-center justify-between rounded-xl border border-primary/30 bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs hover:border-primary/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0 pr-3">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="truncate">{btn.text}</span>
                  </div>

                  {btn.type === "url" && (
                    <span className="shrink-0 text-[10px] text-muted-foreground font-mono" title={btn.url}>
                      🔗 Link
                    </span>
                  )}
                  {btn.type === "phone" && (
                    <span className="shrink-0 text-[10px] text-muted-foreground font-mono" title={btn.phone}>
                      📞 Ligar
                    </span>
                  )}
                  {(btn.type === "flow" || !btn.type) && (
                    <Handle
                      type="source"
                      id={btn.id}
                      position={Position.Right}
                      className="!relative !right-0 !transform-none !h-3 !w-3 !rounded-full !border-2 !border-primary/80 !bg-surface hover:!bg-primary transition-transform hover:!scale-125 cursor-crosshair"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl bg-amber-500/10 dark:bg-amber-500/20 p-2.5 text-xs text-amber-900 dark:text-amber-200 border border-amber-500/20">
          <div className="flex items-center gap-1.5 font-medium mb-1">
            <Lightning size={13} className="text-amber-600 dark:text-amber-400" />
            <span>{t("Ação do CRM")}</span>
          </div>
          <p className="line-clamp-2 text-[11px] text-text-muted">
            {promptHint || t("Executar ação configurada")}
          </p>
        </div>
      )}
    </NodeCard>
  );
}
