"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";

/**
 * Apaga uma mensagem com falha de envio. O backend só permite linha `failed`
 * (autor ou manager+) — a UI já esconde o botão de quem não pode, mas o
 * servidor é a barreira real.
 */
export function useDeleteMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => apiClient.delete(`/api/v1/messages/${messageId}`),
    onError: showApiError,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
