import { connection } from "next/server";
import { readSession } from "@/app/_server/session";
import { signOutAction } from "@/app/signin/actions";

/** Signed-in email and a sign-out button. Rendered inside a Suspense boundary. */
export async function AccountMenu({ compact = false }: { compact?: boolean }) {
  await connection();
  const session = await readSession();
  if (!session) return null;
  const demo = session.email.endsWith("@demo.invalid");

  return (
    <form action={signOutAction} className={compact ? "" : "rounded-xl bg-frame-raised p-3"}>
      {compact ? null : (
        <p className="truncate text-xs text-frame-muted" title={session.email}>
          {demo ? "Practice account" : session.email}
        </p>
      )}
      <button
        type="submit"
        className={
          compact
            ? "rounded-xl border border-white/25 px-3 py-1.5 text-sm font-semibold text-frame-text hover:bg-frame-raised"
            : "mt-1 text-sm font-semibold text-frame-text hover:underline"
        }
      >
        Sign out
      </button>
    </form>
  );
}
