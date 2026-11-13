import { linePath, scalePrices } from "@/app/_lib/chart-math";

type Direction = "up" | "down" | "flat";

const tone = (d: Direction) => (d === "up" ? "text-positive" : d === "down" ? "text-negative" : "text-text-muted");

/** "+2.31%" / "−0.40%" with an arrow, so the change never relies on colour alone. */
export function ChangePill({ pct, direction, label = "24h" }: { pct: number; direction: Direction; label?: string }) {
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "•";
  const sign = direction === "up" ? "+" : direction === "down" ? "−" : "";
  return (
    // `relative` keeps the sr-only label positioned inside the pill; without it, inside a
    // horizontal scroller the label escapes to the page and widens it on phones.
    <span className={`num relative inline-flex items-center gap-1 text-xs font-bold ${tone(direction)}`}>
      <span aria-hidden>{arrow}</span>
      {sign}
      {Math.abs(pct).toFixed(2)}%<span className="sr-only"> over {label}</span>
    </span>
  );
}

/** A tiny line of the last day's prices. Decorative; the change pill carries the meaning. */
export function Sparkline({ prices, direction, width = 72, height = 28 }: { prices: string[]; direction: Direction; width?: number; height?: number }) {
  const pts = scalePrices(prices, width, height, 0.1);
  if (pts.length < 2) return <span style={{ width, height }} aria-hidden />;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={tone(direction)} aria-hidden>
      <path d={linePath(pts)} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
