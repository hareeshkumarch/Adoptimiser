import { useQuery } from "@tanstack/react-query";
import { api, type ScopeParams } from "../lib/api";
import { useFilters } from "../state/filters";
import type { Currency } from "../types";

export function useScopeParams(includeDrilldown = false): ScopeParams {
  const f = useFilters();
  if (includeDrilldown) {
    return {
      platform: f.platform,
      account_id: f.accountId,
      campaign: f.campaign,
      adset_id: f.adsetId,
      window: f.window,
      compare: f.compare,
    };
  }
  return { platform: f.platform, account_id: f.accountId, window: f.window, compare: f.compare };
}

export const useAccounts = () => useQuery({ queryKey: ["accounts"], queryFn: api.accounts, staleTime: Infinity });

export function usePulse() {
  const params = useScopeParams(false);
  return useQuery({ queryKey: ["pulse", params], queryFn: () => api.pulse(params), placeholderData: (prev) => prev });
}

export function useBreakdown() {
  const params = useScopeParams(true);
  const { level } = useFilters();
  return useQuery({ queryKey: ["breakdown", params, level], queryFn: () => api.breakdown({ ...params, level }), placeholderData: (prev) => prev });
}

export const useConnectors = () => useQuery({ queryKey: ["connectors"], queryFn: api.connectors });

export const useGraphTopology = () => useQuery({ queryKey: ["graph-topology"], queryFn: api.graphTopology, staleTime: Infinity });

export const useRunHistory = (runId?: string) => useQuery({ queryKey: ["run-history", runId], queryFn: api.listRuns });

export function useCurrency(): { currency: Currency; rate: number } {
  const { currency } = useFilters();
  const { data } = useAccounts();
  return { currency, rate: data?.fx_to_usd[currency] ?? 1 };
}
