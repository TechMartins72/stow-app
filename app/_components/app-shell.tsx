import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "./account-menu";
import { BookIcon, GearIcon, HomeIcon, ListIcon, LockIcon, PieIcon, SparkIcon, StowMark } from "./icons";

type NavItem = { label: string; href: string; icon: (p: { className?: string }) => React.ReactNode; ready: boolean };

// Screens that don't exist yet show as "Soon".
const NAV: NavItem[] = [
  { label: "Home", href: "/", icon: HomeIcon, ready: true },
  { label: "Invest", href: "/invest", icon: PieIcon, ready: true },
  { label: "Vault", href: "/vault", icon: LockIcon, ready: true },
  { label: "Advisor", href: "/advisor", icon: SparkIcon, ready: true },
  { label: "Activity", href: "/activity", icon: ListIcon, ready: true },
  { label: "Learn", href: "/learn", icon: BookIcon, ready: true },
  { label: "Settings", href: "/settings", icon: GearIcon, ready: false },
];

export function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-frame px-4 py-6 text-frame-text lg:flex">
        <Brand />
        <nav aria-label="Main" className="mt-10 flex flex-col gap-1">
          {NAV.map((item) => (
            <SideLink key={item.href} item={item} active={item.href === active} />
          ))}
        </nav>
        <div className="mt-auto space-y-4">
          <p className="px-3 text-xs leading-relaxed text-frame-muted">
            Every payment needs our signature. We never sign away a savings goal or a budget before its date.
          </p>
          <Suspense fallback={<div className="h-[60px] rounded-xl bg-frame-raised" />}>
            <AccountMenu />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-2 bg-frame px-4 py-3 text-frame-text lg:hidden">
          <Brand />
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Very narrow phones (folding phones, ~280px): icon only, the label stays for screen readers. */}
            <Link
              href="/learn"
              aria-current={active === "/learn" ? "page" : undefined}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-frame-text hover:bg-frame-raised"
            >
              <BookIcon className="size-4" /> <span className="max-[359px]:sr-only">Learn</span>
            </Link>
            <Suspense fallback={null}>
              <AccountMenu compact />
            </Suspense>
          </div>
        </header>

        <main className="flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">{children}</main>

        {/* Mobile tab bar: the five main destinations */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-white/10 bg-frame pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {NAV.slice(0, 5).map((item) => (
            <TabLink key={item.href} item={item} active={item.href === active} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-xl px-2 max-[359px]:px-0 focus-visible:outline-2 focus-visible:outline-hero">
      <StowMark className="size-8" />
      <span className="wordmark text-[calc(17px*var(--fs))]">Stow</span>
    </Link>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const base = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[calc(15px*var(--fs))] font-semibold";
  if (!item.ready) {
    return (
      <span aria-disabled className={`${base} cursor-not-allowed text-frame-muted/70`}>
        <Icon className="size-5" />
        {item.label}
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[calc(11px*var(--fs))] font-semibold text-frame-muted">Soon</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${base} ${active ? "bg-hero text-white" : "text-frame-text hover:bg-frame-raised"}`}
    >
      <Icon className="size-5" />
      {item.label}
    </Link>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const base = "flex flex-col items-center gap-1 py-2.5 text-[calc(11px*var(--fs))] font-semibold";
  if (!item.ready) {
    return (
      <span aria-disabled className={`${base} text-frame-muted/60`}>
        <Icon className="size-5" />
        {item.label}
      </span>
    );
  }
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={`${base} ${active ? "text-hero" : "text-frame-text"}`}>
      <Icon className="size-5" />
      {item.label}
    </Link>
  );
}
