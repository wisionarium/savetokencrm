"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface ContactStats {
  total: number;
  limit: number;
  percentage: number;
  exceeded: boolean;
  overage: number;
  overage_rate_cents: number;
  overage_cost_cents: number;
}

export function useContactStats() {
  return useQuery({
    queryKey: ["contacts", "stats"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ContactStats }>("/api/v1/contacts/stats");
      return res.data;
    },
    staleTime: 30_000,
  });
}

