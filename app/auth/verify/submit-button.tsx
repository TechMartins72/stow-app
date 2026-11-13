"use client";

import { useFormStatus } from "react-dom";
import { Busy } from "@/app/_components/spinner";

/**
 * Disabled while the sign-in is in flight. A second press would try to spend
 * the same one-time link again and land on "expired", even though the first
 * press had already signed the user in.
 */
export function SignInButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="mt-6 w-full rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? <Busy>Signing in…</Busy> : "Sign in to Stow"}
    </button>
  );
}
