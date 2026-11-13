"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useToast } from "./toaster";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** The device's connection, as the browser reports it. The server render assumes online. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/**
 * A banner while the device is offline, and a "Back online" toast plus a fresh
 * render (live balances) when the connection returns.
 */
export function ConnectionBanner() {
  const online = useOnline();
  const router = useRouter();
  const toast = useToast();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      toast({ tone: "success", title: "Back online", body: "Your balances are up to date again." });
      router.refresh();
    }
  }, [online, router, toast]);

  if (online) return null;
  return (
    <div role="status" aria-live="polite" className="sticky top-0 z-30 border-b border-warning/40 bg-warning-bg px-4 py-2.5 text-center text-sm font-semibold text-warning">
      You&apos;re offline. What you see may be out of date, and nothing can be sent or traded until you&apos;re back online.
    </div>
  );
}
