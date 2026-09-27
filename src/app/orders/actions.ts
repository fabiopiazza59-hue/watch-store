"use server";

import { cookies, headers } from "next/headers";
import { clientKey, fixedWindowLimiter } from "@/app/api/_lib/limits";
import { isWorkshopToken, WORKSHOP_COOKIE, workshopCookieOptions } from "@/server/workshopAuth";

export interface SignInState {
  error: string | null;
}

/** Wrong keys one client may try in a quarter of an hour. */
const wrongKeys = fixedWindowLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

/**
 * Signs the workshop in on this browser: a correct key (WORKSHOP_TOKEN) is kept in an http-only
 * cookie, and setting it re-renders the page, which then passes the workshop gate.
 */
export async function signInToWorkshop(_previous: SignInState, form: FormData): Promise<SignInState> {
  const key = form.get("key");
  const attempt = wrongKeys.take(clientKey(new Request("http://workshop.invalid", { headers: await headers() })));
  if (!attempt.ok) {
    return { error: `Too many wrong keys. Try again in ${Math.ceil(attempt.retryAfterSeconds / 60)} minutes.` };
  }
  if (typeof key !== "string" || !isWorkshopToken(key)) return { error: "That isn't the workshop key." };
  attempt.refund();
  (await cookies()).set(WORKSHOP_COOKIE, key, workshopCookieOptions());
  return { error: null };
}

/** Forgets the workshop key on this browser. */
export async function signOutOfWorkshop(): Promise<void> {
  (await cookies()).delete(WORKSHOP_COOKIE);
}
