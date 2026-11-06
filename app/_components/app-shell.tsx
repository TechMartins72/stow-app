import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "./account-menu";
import { GearIcon, HomeIcon, ListIcon, LockIcon, PieIcon, SparkIcon, VaultMark } from "./icons";

type NavItem = { label: string; href: string; icon: (p: { className?: string }) => React.ReactNode; ready: boolean };

// Screens that don't exist yet show as "Soon".
const NAV: NavItem[] = [
  { label: "Home", href: "/", icon: HomeIcon, ready: true },
  { label: "Invest", href: "/invest", icon: PieIcon, ready: true },
  { label: "Vault", href: "/vault", icon: LockIcon, ready: true },
  { label: "Advisor", href: "/advisor", icon: SparkIcon, ready: true },
  { label: "Activity", href: "/activity", icon: ListIcon, ready: true },
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
            Every payment needs our signature, and we never sign away locked funds before their date.
          </p>
          <Suspense fallback={<div className="h-[60px] rounded-xl bg-frame-raised" />}>
            <AccountMenu />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between bg-frame px-4 py-3 text-frame-text lg:hidden">
          <Brand />
          <Suspense fallback={null}>
            <AccountMenu compact />
          </Suspense>
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
    <Link href="/" className="flex items-center gap-2.5 rounded-xl px-2 focus-visible:outline-2 focus-visible:outline-hero">
      <VaultMark className="size-8" />
      <span className="display text-lg">Portfolio Vault</span>
    </Link>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const base = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold";
  if (!item.ready) {
    return (
      <span aria-disabled className={`${base} cursor-not-allowed text-frame-muted/70`}>
        <Icon className="size-5" />
        {item.label}
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-frame-muted">Soon</span>
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
  const base = "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold";
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
