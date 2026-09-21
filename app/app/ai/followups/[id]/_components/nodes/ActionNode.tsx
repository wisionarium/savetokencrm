"use client";

import type { NodeProps } from "@xyflow/react";

import type { RFNode } from "@/lib/followup/graph-mappers";
import { useT } from "@/hooks/i18n/useT";
import { NODE_VISUALS, IMAGE_NODE_VISUAL, describeNodeConfig } from "./nodeVisuals";
import { NodeCard } from "./NodeCard";

export function ActionNode({ id, data, selected }: NodeProps<RFNode>) {
  const t = useT();
  const config = data.config as Record<string, unknown>;
  const mediaUrl = typeof config?.media_url === "string" ? config.media_url : "";
  const isImage = Boolean(mediaUrl);

  return (
    <NodeCard
      id={id}
      visual={isImage ? IMAGE_NODE_VISUAL : NODE_VISUALS.action}
      label={data.label}
      subtitle={describeNodeConfig("action", data.config, t)}
      selected={selected}
      errors={data.errors}
    >
      {isImage && (
        <div className="mt-2.5 overflow-hidden rounded-md border border-border/60 bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt="Thumbnail"
            className="h-28 w-full object-cover transition-transform hover:scale-105"
          />
        </div>
      )}
    </NodeCard>
  );
}
