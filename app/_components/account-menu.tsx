import { connection } from "next/server";
import { readSession } from "@/app/_server/session";
import { ProfileMenu } from "./profile-menu";

/** The profile button (top right) for whoever is signed in. Rendered inside a Suspense boundary. */
export async function AccountMenu() {
  await connection();
  const session = await readSession();
  if (!session) return null;
  const demo = session.email.endsWith("@demo.invalid");
  return <ProfileMenu label={demo ? "Practice account" : session.email} />;
}
