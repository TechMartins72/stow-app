// A spinning ring for anything that's loading, so a slow moment never looks like a stall.
// Decorative: the text next to it ("Loading…", "Sending…") says what's happening.

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`shrink-0 animate-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A busy button's label: spinner then text, e.g. <Busy>Sending…</Busy>. Inherits the button's colour. */
export function Busy({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <Spinner />
      {children}
    </span>
  );
}

/** Spinner plus a short label, for the top of a page that's still loading. */
export function LoadingNote({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-text-muted">
      <Spinner className="size-5 text-primary" />
      {label}…
    </p>
  );
}

/** A placeholder block for one loading section, with the spinner and label in its middle. */
export function LoadingBlock({ label, className = "h-[480px] rounded-[20px]" }: { label: string; className?: string }) {
  return (
    <div aria-busy aria-label={label} className={`relative grid place-items-center overflow-hidden ${className}`}>
      <span className="absolute inset-0 animate-pulse bg-border/60" aria-hidden />
      <span className="relative flex items-center gap-2 text-sm font-semibold text-text-muted">
        <Spinner className="size-5 text-primary" />
        {label}…
      </span>
    </div>
  );
}
