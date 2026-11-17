import { connection } from "next/server";
import { firstSentences, summaryAge, type Sentiment } from "@/app/_lib/market-summary";
import { getAssetSummary } from "@/app/_server/market-summary";

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: "Mostly positive news",
  negative: "Mostly negative news",
  mixed: "Mixed news",
  neutral: "Neutral news",
};

/**
 * True Markets' daily AI summary for this asset. Renders nothing when there is
 * no summary or the server can't be reached, so the page never depends on it.
 */
export async function WhyMoving({ ticker, name }: { ticker: string; name: string }) {
  await connection();
  const summary = await getAssetSummary(ticker);
  if (!summary) return null;
  const age = summaryAge(summary.asOf, new Date());

  return (
    <section aria-labelledby="why-title" className="rounded-[20px] border border-border bg-surface-raised p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="why-title" className="font-bold">
          Why {name} is moving
        </h2>
        {age ? <span className="text-sm text-text-muted">{age}</span> : null}
        {summary.sentiment ? (
          <span className="ml-auto rounded-full bg-hero/10 px-2.5 py-1 text-xs font-semibold text-text">{SENTIMENT_LABEL[summary.sentiment]}</span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{firstSentences(summary.text, 4, 600)}</p>
      <p className="mt-3 text-xs text-text-muted">AI summary of recent news by True Markets, updated daily. Not financial advice.</p>
    </section>
  );
}
