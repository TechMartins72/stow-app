import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { GatewayErrorCard } from "@/app/_components/home-sections";
import { loadActivity } from "@/app/_server/activity";
import { ActivityList } from "./activity-list";
import { LoadingBlock } from "@/app/_components/spinner";

export const metadata: Metadata = { title: "Activity · Stow" };

export default function ActivityPage() {
  return (
    <AppShell active="/activity">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-text-muted">Everything that happened, and everything the app refused</p>
          <h1 className="display text-[calc(28px*var(--fs))] leading-tight sm:text-[32px]">Activity</h1>
        </header>
        <Suspense fallback={<LoadingBlock label="Loading activity" className="h-[480px] rounded-[20px]" />}>
          <ActivityContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function ActivityContent() {
  await connection();
  const result = await loadActivity();
  if (!result.ok) return <GatewayErrorCard reason={result.reason} mode={result.mode} requestId={result.requestId} />;
  return <ActivityList items={result.items} nowIso={new Date().toISOString()} />;
}
