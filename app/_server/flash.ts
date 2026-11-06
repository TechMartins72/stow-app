import "server-only";

import { cookies } from "next/headers";
import { FLASH_COOKIE, type ToastMessage } from "@/app/_lib/toast";

/**
 * Queues a toast for the next page. Use in Server Functions right before a
 * redirect; the Toaster reads it after navigation and deletes it.
 * Readable by page JavaScript, so never put secrets or personal data in it.
 */
export async function flash(message: ToastMessage): Promise<void> {
  (await cookies()).set(FLASH_COOKIE, encodeURIComponent(JSON.stringify(message)), {
    path: "/",
    maxAge: 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });
}
