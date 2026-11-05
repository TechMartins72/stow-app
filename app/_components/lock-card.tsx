import { countdown, formatDate, formatQty, formatUsd, lockProgress } from "@/app/_lib/format";
import type { HomeLock } from "@/app/_server/home";

function ProgressRing({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="size-14 -rotate-90" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="var(--accent-locked)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
      />
    </svg>
  );
}

/** One lock. Scheduled locks show how much has been released and what's next. */
export function LockCard({ lock, now, highlight = false }: { lock: HomeLock; now: Date; highlight?: boolean }) {
  const scheduled = lock.parts > 1;
  const nextAt = lock.next?.releaseAt ?? lock.unlockAt;
  const left = countdown(nextAt, now);
  // Scheduled: share of the money released. One date: share of the time passed.
  const progress = scheduled ? lock.releasedShare : lockProgress(lock.createdAt, lock.unlockAt, now);

  return (
    <article
      className={`flex min-w-[260px] snap-start flex-col rounded-[20px] border bg-surface-raised p-5 ${
        highlight ? "border-locked ring-2 ring-locked/40" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold">{lock.goalName}</h3>
          <p className="num mt-0.5 text-sm text-text-muted">
            {scheduled
              ? `${lock.partsReleased} of ${lock.parts} released`
              : `${formatQty(lock.amount)} ${lock.symbol}`}
          </p>
        </div>
        <div className="relative shrink-0" aria-label={scheduled ? `${Math.round(progress * 100)}% released` : `${Math.round(progress * 100)}% of the time passed`}>
          <ProgressRing value={progress} />
          <span className="num absolute inset-0 grid place-items-center text-[11px] font-bold" aria-hidden>
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>

      <p className="num display mt-4 text-2xl">{formatUsd(lock.lockedUsd)}</p>
      <p className="num text-xs font-semibold text-text-muted">
        {scheduled ? `still locked of ${formatQty(lock.amount)} ${lock.symbol}` : "locked"}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span className="rounded-full bg-locked/10 px-2.5 py-1 text-xs font-bold text-locked dark:bg-locked/30 dark:text-frame-text">
          {scheduled && lock.next ? `${formatQty(lock.next.amount)} ${lock.symbol} in ${left.label}` : `${left.label} left`}
        </span>
        <span className="text-text-muted">
          {scheduled ? "Next" : "Opens"} {formatDate(nextAt)}
        </span>
      </div>
    </article>
  );
}
