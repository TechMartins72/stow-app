// Chart ranges for the asset page, mapped to the market-data candles API
// (`window` = how far back, `resolution` = one candle per ...).

export type ChartRange = "1D" | "1W" | "1M" | "1Y";

export const CHART_RANGES: { value: ChartRange; label: string; window: string; resolution: string; noun: string }[] = [
  { value: "1D", label: "1D", window: "1d", resolution: "15m", noun: "today" },
  { value: "1W", label: "1W", window: "7d", resolution: "2h", noun: "this week" },
  { value: "1M", label: "1M", window: "1M", resolution: "1d", noun: "this month" },
  { value: "1Y", label: "1Y", window: "12M", resolution: "7d", noun: "this year" },
];

export const isChartRange = (v: string): v is ChartRange => CHART_RANGES.some((r) => r.value === v);
