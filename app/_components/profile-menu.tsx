"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOutAction } from "@/app/signin/actions";
import { SignOutIcon, TrashIcon, UserIcon } from "./icons";

/**
 * The profile button at the top right and its drop-down: who's signed in, Sign out,
 * and Delete account. A disclosure (button + panel), closed by Escape, a click
 * outside, or choosing an item.
 */
export function ProfileMenu({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold";

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Your account"
        className={`grid size-10 place-items-center rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hero ${
          open
            ? "border-hero bg-hero text-white"
            : "border-white/25 bg-frame-raised text-frame-text hover:border-white/50 lg:border-border lg:bg-surface-raised lg:text-text lg:hover:border-text-muted/40"
        }`}
      >
        <UserIcon className="size-5" />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[20px] border border-border bg-surface-raised p-2 text-text shadow-[0_24px_60px_-20px_rgba(6,15,33,0.45)]"
      >
        <div className="flex items-center gap-3 px-3 pt-2 pb-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full bg-hero/15 text-primary dark:text-hero"
            aria-hidden
          >
            <UserIcon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-text-muted">
              Signed in as
            </span>
            <span className="block truncate text-sm font-bold" title={label}>
              {label}
            </span>
          </span>
        </div>
        <div className="border-t border-border pt-2">
          <form action={signOutAction}>
            <button type="submit" className={`${item} hover:bg-surface`}>
              <SignOutIcon className="size-5 text-text-muted" /> Sign out
            </button>
          </form>
          <Link
            href="/account/delete"
            onClick={() => setOpen(false)}
            className={`${item} text-critical hover:bg-critical-bg`}
          >
            <TrashIcon className="size-5" /> Delete account
          </Link>
        </div>
      </div>
    </div>
  );
}
