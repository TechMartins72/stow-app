"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { FLASH_COOKIE, parseFlash, type ToastMessage } from "@/app/_lib/toast";

type Toast = ToastMessage & { id: number };

const ToastContext = createContext<(message: ToastMessage) => void>(() => {});

/** Show a toast from a client component: `const toast = useToast(); toast({ tone: "success", title: "Copied" })`. */
export const useToast = () => useContext(ToastContext);

const DURATION_MS = 5000;

function takeFlashCookie(): ToastMessage | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${FLASH_COOKIE}=`));
  if (!match) return null;
  document.cookie = `${FLASH_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  return parseFlash(match.slice(FLASH_COOKIE.length + 1));
}

/**
 * Server actions leave a flash cookie before redirecting; show it once we've
 * arrived. Reading the URL is runtime-only, so this sits in its own Suspense
 * boundary and doesn't hold up the page's prerendered shell.
 */
function FlashReader({ show }: { show: (m: ToastMessage) => void }) {
  const pathname = usePathname();
  useEffect(() => {
    const message = takeFlashCookie();
    if (message) show(message);
  }, [pathname, show]);
  return null;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message: ToastMessage) => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-2), { ...message, id }]); // at most 3 on screen
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Suspense fallback={null}>
        <FlashReader show={show} />
      </Suspense>
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-40 z-50 flex flex-col items-center gap-2 px-4 lg:right-6 lg:bottom-24 lg:left-auto lg:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-frame p-4 text-frame-text shadow-[0_18px_40px_-16px_rgba(6,15,33,0.6)] motion-safe:animate-[toast-in_180ms_ease-out]"
          >
            <span
              className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${
                t.tone === "success" ? "bg-positive" : t.tone === "error" ? "bg-critical" : "bg-hero"
              }`}
              aria-hidden
            >
              {t.tone === "success" ? "✓" : t.tone === "error" ? "!" : "i"}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-bold">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-frame-muted">{t.body}</p> : null}
              {t.href ? (
                <Link href={t.href} onClick={() => dismiss(t.id)} className="mt-1.5 inline-block font-semibold text-hero hover:underline">
                  {t.linkLabel ?? "View"}
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-m-1 rounded-lg p-1 text-frame-muted hover:bg-frame-raised hover:text-frame-text"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
