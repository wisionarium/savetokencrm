"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";

export type FollowupFlowStatus = "draft" | "active" | "disabled";

export interface FollowupFlowPointerRow {
  id: string;
  name: string;
  status: FollowupFlowStatus;
  active_version_id: string | null;
  handoff_policy: string;
  inbox_enabled: boolean;
  updated_at: string;
}

interface ListResponse {
  data: FollowupFlowPointerRow[];
}

interface SingleResponse {
  data: FollowupFlowPointerRow;
}

export const followupFlowsListQueryKey = ["followup", "flows", "list"] as const;

export function useFollowupFlows(opts?: { initialData?: FollowupFlowPointerRow[] }) {
  return useQuery({
    queryKey: followupFlowsListQueryKey,
    queryFn: async () => {
      try {
        const res = await apiClient.get<ListResponse>("/api/v1/ai/followup-flows");
        return res.data;
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
    initialData: opts?.initialData,
  });
}

export function useCreateFollowupFlow() {
  const t = useT();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["followup", "flows", "create"],
    mutationFn: async (name: string) => {
      const res = await apiClient.post<SingleResponse>("/api/v1/ai/followup-flows", { name });
      return res.data;
    },
    onSuccess: (created) => {
      qc.setQueryData<FollowupFlowPointerRow[]>(followupFlowsListQueryKey, (prev) =>
        prev ? [created, ...prev] : [created],
      );
      toast.success(t("Fluxo criado."));
    },
    onError: (err) => {
      showApiError(err);
    },
  });
}

export function useUpdateFollowupFlow() {
  const t = useT();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["followup", "flows", "update"],
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { name?: string; status?: FollowupFlowStatus; inbox_enabled?: boolean };
    }) => {
      const res = await apiClient.patch<SingleResponse>(`/api/v1/ai/followup-flows/${id}`, patch);
      return res.data;
    },
    onSuccess: (updated) => {
      qc.setQueryData<FollowupFlowPointerRow[]>(followupFlowsListQueryKey, (prev) =>
        prev ? prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)) : [updated],
      );
      qc.invalidateQueries({ queryKey: followupFlowsListQueryKey });
      toast.success(t("Fluxo atualizado."));
    },
    onError: (err) => {
      showApiError(err);
    },
  });
}

