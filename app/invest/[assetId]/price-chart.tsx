"use client";

import { useRef, useState, useTransition } from "react";
import { summarisePoints } from "@/app/_lib/catalog-policy";
import { areaPath, linePath, scalePrices } from "@/app/_lib/chart-math";
import { CHART_RANGES, type ChartRange } from "@/app/_lib/chart-ranges";
import { formatUsd } from "@/app/_lib/format";
import type { ChartData } from "@/app/_server/market";
import { ChangePill } from "@/app/_components/price-bits";
import { chartAction } from "../actions";
import { Busy } from "@/app/_components/spinner";

const W = 640;
const H = 220;

export function PriceChart({ assetId, initial }: { assetId: string; initial: ChartData | null }) {
  const [range, setRange] = useState<ChartRange>(initial?.range ?? "1D");
  const [cache, setCache] = useState<Partial<Record<ChartRange, ChartData | null>>>(initial ? { [initial.range]: initial } : {});
  const [hover, setHover] = useState<number | null>(null);
  const [loading, start] = useTransition();
  const svgRef = useRef<SVGSVGElement>(null);

  const data = cache[range];
  const candles = data?.candles ?? [];
  const closes = candles.map((c) => c.close);
  const pts = scalePrices(closes, W, H);
  const summary = summarisePoints(closes.map((price) => ({ price })));
  const spec = CHART_RANGES.find((r) => r.value === range)!;
  const stroke = summary?.direction === "down" ? "var(--negative)" : "var(--positive)";

  function pick(r: ChartRange) {
    setRange(r);
    setHover(null);
    if (r in cache) return;
    start(async () => {
      const next = await chartAction({ assetId, range: r });
      setCache((c) => ({ ...c, [r]: next }));
    });
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || pts.length === 0) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round((x / W) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  }

  const shown = hover !== null ? candles[hover] : candles.at(-1);
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", range === "1D" || range === "1W"
      ? { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "UTC" }
      : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <section aria-label="Price chart" className="rounded-[24px] border border-border bg-surface-raised p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div aria-live="polite">
          <p className="num display text-2xl">{shown ? formatUsd(shown.close) : "—"}</p>
          <p className="text-xs text-text-muted">
            {hover !== null && shown ? `${when(shown.t)} UTC` : summary ? (
              <>
                <ChangePill pct={summary.changePct} direction={summary.direction} label={spec.noun} /> <span aria-hidden>{spec.noun}</span>
              </>
            ) : (
              " "
            )}
          </p>
        </div>
        <div role="tablist" aria-label="Chart range" className="flex gap-1 rounded-xl bg-surface p-1">
          {CHART_RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="tab"
              aria-selected={range === r.value}
              onClick={() => pick(r.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${range === r.value ? "bg-surface-raised text-text shadow-sm" : "text-text-muted hover:text-text"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        {pts.length >= 2 ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className={`h-auto w-full touch-none ${loading ? "opacity-50" : ""}`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label={
              summary
                ? `${spec.label} price chart: ${summary.direction === "up" ? "up" : summary.direction === "down" ? "down" : "unchanged"} ${Math.abs(summary.changePct).toFixed(2)}% ${spec.noun}, now ${formatUsd(summary.price)}.`
                : "Price chart"
            }
          >
            <defs>
              <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath(pts, H)} fill="url(#chart-fill)" />
            <path d={linePath(pts)} fill="none" stroke={stroke} strokeWidth={2.25} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {hover !== null && pts[hover] ? (
              <>
                <line x1={pts[hover].x} x2={pts[hover].x} y1={0} y2={H} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <circle cx={pts[hover].x} cy={pts[hover].y} r={4} fill={stroke} vectorEffect="non-scaling-stroke" />
              </>
            ) : null}
          </svg>
        ) : (
          <div className="grid h-[200px] place-items-center rounded-2xl bg-surface text-sm text-text-muted">
            {loading ? <Busy>Loading the chart…</Busy> : "No price history for this range yet."}
          </div>
        )}
      </div>
    </section>
  );
}
