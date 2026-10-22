"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";

export interface AgentRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  model: string;
  system_prompt: string;
  is_active: boolean;
  is_default: boolean;
  config: Record<string, unknown>;
  guardrails: unknown;
  active_kb_version_id: string | null;
  kind?: "rag_bot" | "mcp_agent" | null;
  priority?: number | null;
  published_version_id?: string | null;
  paused_at?: string | null;
  operation_mode?: "automatic" | "assisted";
  operation_revision?: number;
  /** Provedor e modelo da versão PUBLICADA — o que de fato responde. */
  versao_publicada?: { provider: string; model: string } | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface ListResponse {
  data: AgentRow[];
}

export const agentsListQueryKey = ["ai", "agents", "list"] as const;

export function useAgentsList(opts?: { initialData?: AgentRow[] }) {
  return useQuery({
    queryKey: agentsListQueryKey,
    queryFn: async () => {
      try {
        const res = await apiClient.get<ListResponse>("/api/v1/ai/agents");
        return res.data;
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
    initialData: opts?.initialData,
  });
}
