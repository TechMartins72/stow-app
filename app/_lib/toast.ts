// A toast: a short, non-blocking confirmation of something the user just did.

export type ToastTone = "success" | "info" | "error";

export interface ToastMessage {
  tone: ToastTone;
  title: string;
  body?: string;
  /** Optional follow-up link, e.g. "View lock". Internal paths only. */
  href?: string;
  linkLabel?: string;
}

/** Cookie a server action sets before redirecting; the Toaster shows it once and deletes it. */
export const FLASH_COOKIE = "pv_flash";

/** Parses a flash cookie value; anything malformed, or a link off-site, is dropped. */
export function parseFlash(raw: string | undefined): ToastMessage | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<ToastMessage>;
    if (!v || typeof v.title !== "string" || !["success", "info", "error"].includes(v.tone as string)) return null;
    const href = typeof v.href === "string" && v.href.startsWith("/") && !v.href.startsWith("//") ? v.href : undefined;
    return {
      tone: v.tone as ToastTone,
      title: v.title.slice(0, 120),
      body: typeof v.body === "string" ? v.body.slice(0, 240) : undefined,
      href,
      linkLabel: href && typeof v.linkLabel === "string" ? v.linkLabel.slice(0, 40) : undefined,
    };
  } catch {
    return null;
  }
}
