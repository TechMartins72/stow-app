// A phone frame and brand shapes for the landing page's motion graphics. The
// screens inside are drawn with the app's own tokens and type, so they match the
// real app in light and dark mode.

export function Phone({ children, className = "", label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative mx-auto w-[280px] shrink-0 rounded-[44px] bg-frame p-2.5 shadow-[0_40px_80px_-30px_rgba(6,15,33,0.55)] ring-1 ring-white/10 sm:w-[300px] ${className}`}
    >
      <div className="relative h-[560px] overflow-hidden rounded-[36px] bg-surface text-text sm:h-[600px]" aria-hidden>
        <div className="absolute top-2 left-1/2 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-frame" />
        {children}
      </div>
    </div>
  );
}

/** The top of every app screen: time, then the Stow bar. */
export function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-6 pt-3 text-[11px] font-bold ${dark ? "text-frame-text" : "text-text"}`}>
      <span className="num">9:41</span>
      <span className="flex items-center gap-1" aria-hidden>
        <span className="h-2 w-3 rounded-[2px] bg-current opacity-80" />
        <span className="h-2 w-4 rounded-[3px] border border-current" />
      </span>
    </div>
  );
}

/** A progress ring like the app's lock cards. */
export function Ring({ value, className, stroke = "var(--accent-locked)", ringClass }: { value: number; className?: string; stroke?: string; ringClass?: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className={`-rotate-90 ${className ?? "size-14"}`} aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle
        className={ringClass}
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
      />
    </svg>
  );
}

export const RING_CIRCUMFERENCE = 2 * Math.PI * 22;
