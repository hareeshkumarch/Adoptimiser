import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AttributionWindow, Compare, Currency, Level, Platform } from "../types";

export interface Filters {
  platform: Platform | null;
  accountId: string | null;
  campaign: string | null;
  adsetId: string | null;
  adsetName: string | null;
  currency: Currency;
  window: AttributionWindow;
  compare: Compare;
  level: Level;
}

interface FiltersValue extends Filters {
  update: (patch: Partial<Filters>) => void;
  resetDrilldown: () => void;
}

const DEFAULTS: Filters = {
  platform: null,
  accountId: null,
  campaign: null,
  adsetId: null,
  adsetName: null,
  currency: "USD",
  window: "7d_click",
  compare: "previous_period",
  level: "campaign",
};
const FiltersContext = createContext<FiltersValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const value = useMemo(
    () => ({
      ...filters,
      update: (patch: Partial<Filters>) =>
        setFilters((f) => {
          const next = { ...f, ...patch };
          if (patch.level === "platform" && patch.campaign === undefined) {
            next.campaign = null;
            next.adsetId = null;
            next.adsetName = null;
          } else if (patch.level === "campaign" && patch.campaign === undefined) {
            next.campaign = null;
            next.adsetId = null;
            next.adsetName = null;
          } else if (patch.level === "adset" && patch.adsetId === undefined) {
            next.adsetId = null;
            next.adsetName = null;
          }
          return next;
        }),
      resetDrilldown: () =>
        setFilters((f) => ({
          ...f,
          campaign: null,
          adsetId: null,
          adsetName: null,
          level: "campaign",
        })),
    }),
    [filters],
  );
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within FiltersProvider");
  return ctx;
}
