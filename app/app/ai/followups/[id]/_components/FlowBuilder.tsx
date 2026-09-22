"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { FollowupFlowDetailRow } from "@/hooks/followup/useFollowupFlow";
import { DispatchFlowEditor } from "./DispatchFlowEditor";

/**
 * @xyflow/react is a large dependency — this is the ONLY route that loads it.
 * `ssr:false` + dynamic import keeps it out of the main bundle entirely; see
 * the bundle delta note in the task report.
 */
const FlowCanvas = dynamic(() => import("./FlowCanvas").then((m) => m.FlowCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[600px] items-center justify-center p-6">
      <Skeleton className="h-full w-full" />
    </div>
  ),
});

interface Props {
  flowId: string;
  initialData: FollowupFlowDetailRow;
}

export function FlowBuilder({ flowId, initialData }: Props) {
  // Fluxos de disparo (inbox) ganham o editor simplificado em estilo nodes;
  // fluxos de IA continuam no canvas xyflow completo.
  if (initialData.inbox_enabled) {
    return (
      <div className="flex h-full min-h-[600px] flex-1 flex-col" data-testid="flow-builder-shell">
        <DispatchFlowEditor flowId={flowId} initialData={initialData} />
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-[600px] flex-1 flex-col" data-testid="flow-builder-shell">
      <FlowCanvas flowId={flowId} initialData={initialData} />
    </div>
  );
}
