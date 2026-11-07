// Turns price strings into chart coordinates. Prices stay decimal bigints;
// only the final 0..1 position (a ratio, not an amount) becomes a number.

import { dec } from "@/engine/decimal";

export interface ChartPoint {
  x: number;
  y: number;
}

/** Points scaled into a width x height box (y grows downward), with a little headroom. */
export function scalePrices(prices: string[], width: number, height: number, pad = 0.08): ChartPoint[] {
  const values = prices.filter((p) => /^\d+(\.\d+)?$/.test(p)).map(dec);
  if (values.length === 0) return [];
  const lo = values.reduce((a, b) => (b < a ? b : a));
  const hi = values.reduce((a, b) => (b > a ? b : a));
  const span = hi - lo;
  const usable = height * (1 - 2 * pad);
  return values.map((v, i) => {
    // 0 at the lowest price, 1 at the highest, as a ratio in 1/10000ths.
    const ratio = span > 0n ? Number(((v - lo) * 10_000n) / span) / 10_000 : 0.5;
    return {
      x: values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
      y: height * pad + (1 - ratio) * usable,
    };
  });
}

/** An SVG path through the points ("M x y L x y ..."). */
export function linePath(points: ChartPoint[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

/** The same line closed down to the bottom edge, for a soft filled area under it. */
export function areaPath(points: ChartPoint[], height: number): string {
  if (points.length === 0) return "";
  return `${linePath(points)} L${points.at(-1)!.x.toFixed(2)} ${height} L${points[0].x.toFixed(2)} ${height} Z`;
}
