import { useQuery } from "@tanstack/react-query";
import { insightsApi } from "../lib/insights";
import { useFilters } from "../state/filters";

export function useOpportunities() {
  const { platform, accountId } = useFilters();
  return useQuery({ queryKey: ["opportunities", platform, accountId], queryFn: () => insightsApi.opportunities(platform, accountId), placeholderData: (p) => p });
}

export function useReach() {
  const { platform, accountId } = useFilters();
  return useQuery({ queryKey: ["reach", platform, accountId], queryFn: () => insightsApi.reach(platform, accountId), placeholderData: (p) => p });
}

export const useWorkspace = () => useQuery({ queryKey: ["workspace"], queryFn: insightsApi.workspace, staleTime: Infinity });
