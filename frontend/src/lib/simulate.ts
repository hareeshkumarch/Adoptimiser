import type { Curve, Simulator } from "../types";

export interface Projection {
  shift: number;
  baseRoas: number;
  projectedRoas: number;
  revenueDelta: number;
}

export function projectShift(curves: Record<string, Curve>, sim: Simulator, share: number): Projection {
  const fromCurve = curves[sim.from];
  const toCurve = curves[sim.to];
  if (!fromCurve || !toCurve) {
    return { shift: 0, baseRoas: 0, projectedRoas: 0, revenueDelta: 0 };
  }
  const shift = fromCurve.spend * share;
  let spend = 0;
  let revenue = 0;
  let baseSpend = 0;
  let baseRevenue = 0;
  Object.entries(curves).forEach(([platform, c]) => {
    const delta = platform === sim.from ? -shift : platform === sim.to ? shift : 0;
    const next = Math.max(c.spend + delta, 0);
    baseSpend += c.spend;
    baseRevenue += c.revenue;
    spend += next;
    revenue += c.spend > 0 ? c.revenue * Math.pow(next / c.spend, c.elasticity) : 0;
  });
  return {
    shift,
    baseRoas: baseSpend > 0 ? baseRevenue / baseSpend : 0,
    projectedRoas: spend > 0 ? revenue / spend : 0,
    revenueDelta: revenue - baseRevenue,
  };
}
