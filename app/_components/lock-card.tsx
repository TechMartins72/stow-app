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

export function LockCard({ lock, now }: { lock: HomeLock; now: Date }) {
  const left = countdown(lock.unlockAt, now);
  const progress = lockProgress(lock.createdAt, lock.unlockAt, now);

  return (
    <article className="flex min-w-[260px] snap-start flex-col rounded-[20px] border border-border bg-surface-raised p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold">{lock.goalName}</h3>
          <p className="num mt-0.5 text-sm text-text-muted">
            {formatQty(lock.amount)} {lock.symbol}
          </p>
        </div>
        <div className="relative shrink-0">
          <ProgressRing value={progress} />
          <span className="num absolute inset-0 grid place-items-center text-[11px] font-bold">
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>

      <p className="num display mt-4 text-2xl">{formatUsd(lock.valueUsd)}</p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        {left.matured ? (
          <span className="rounded-full bg-positive/15 px-2.5 py-1 text-xs font-bold text-positive">Ready to release</span>
        ) : (
          <span className="rounded-full bg-locked/10 px-2.5 py-1 text-xs font-bold text-locked dark:bg-locked/30 dark:text-frame-text">
            {left.label} left
          </span>
        )}
        <span className="text-text-muted">Opens {formatDate(lock.unlockAt)}</span>
      </div>
    </article>
  );
}
