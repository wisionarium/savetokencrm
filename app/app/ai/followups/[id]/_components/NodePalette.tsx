"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NodeType } from "@/lib/followup/graph-schema";
import { useT } from "@/hooks/i18n/useT";
import { IMAGE_NODE_VISUAL, NODE_VISUALS, NODE_VISUAL_LIST, type NodeVisual } from "./nodes/nodeVisuals";

interface Props {
  onAdd: (type: NodeType, presetConfig?: Record<string, unknown>) => void;
  /** "mobile" = mesmo conteúdo dentro do Sheet que `FlowCanvas` abre abaixo de
   * `lg` — a barra fixa de 224px não cabia perto do canvas num celular. */
  variant?: "desktop" | "mobile";
  isDispatchFlow?: boolean;
}

/** Sidebar palette — click to add. Native HTML5 drag-and-drop wired in FlowCanvas (increment 3). */
export function NodePalette({ onAdd, variant = "desktop", isDispatchFlow = false }: Props) {
  const t = useT();
  const isMobile = variant === "mobile";

  const listToRender: NodeVisual[] = isDispatchFlow
    ? [
        {
          ...NODE_VISUALS.action,
          paletteLabel: "Texto com especificações",
          defaultConfig: () => ({ mode: "text", body: "Texto da especificação..." }),
        },
        IMAGE_NODE_VISUAL,
        NODE_VISUALS.wait,
        NODE_VISUALS.end,
      ]
    : NODE_VISUAL_LIST;

  return (
    <aside
      className={cn(
        "flex flex-col gap-1.5 overflow-y-auto p-3",
        isMobile
          ? "h-full w-full"
          : "hidden w-56 shrink-0 border-r border-border bg-surface lg:flex",
      )}
      data-testid="node-palette"
    >
      <h2 className="px-1 pb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
        {t("Adicionar nó")}
      </h2>
      {listToRender.map((visual, index) => {
        const Icon = visual.icon;
        const key = `${visual.type}-${index}`;
        return (
          <Button
            key={key}
            type="button"
            variant="secondary"
            size="sm"
            className="justify-start gap-2 text-xs font-normal"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-followup-node-type", visual.type);
              if (visual.defaultConfig) {
                e.dataTransfer.setData(
                  "application/x-followup-node-config",
                  JSON.stringify(visual.defaultConfig()),
                );
              }
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => onAdd(visual.type, visual.defaultConfig())}
            data-testid={`palette-add-${visual.type}`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${visual.chipClassName}`}
            >
              <Icon size={14} aria-hidden />
            </span>
            <span className="truncate">{t(visual.paletteLabel)}</span>
          </Button>
        );
      })}
    </aside>
  );
}
