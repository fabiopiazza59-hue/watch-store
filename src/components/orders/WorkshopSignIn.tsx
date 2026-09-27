"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { type SignInState, signInToWorkshop } from "@/app/orders/actions";
import { buttonClass, cardClass, eyebrowClass, inputClass } from "../ui/styles";

const NOT_SIGNED_IN: SignInState = { error: null };

/** Shown instead of a workshop page to anyone without the workshop key. */
export function WorkshopSignIn() {
  const [state, signIn, pending] = useActionState(signInToWorkshop, NOT_SIGNED_IN);
  const id = useId();

  return (
    <div className="mx-auto max-w-md px-4 pt-12 pb-16 sm:px-6 lg:pt-20">
      <div className={`${cardClass} p-6 sm:p-8`}>
        <p className={eyebrowClass}>Workshop</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">Sign in to the workshop</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Orders and build sheets are for the workshop only. Enter the workshop key to continue.
        </p>
        <form action={signIn} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor={id} className="text-sm font-medium text-ink">
              Workshop key
            </label>
            <input
              id={id}
              name="key"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? `${id}-error` : undefined}
              className={`${inputClass(Boolean(state.error))} mt-1.5`}
            />
            {state.error && (
              <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
                {state.error}
              </p>
            )}
          </div>
          <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
            {pending ? "Checking…" : "Sign in"}
          </button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm leading-relaxed text-ink-soft">
        Not the workshop?{" "}
        <Link href="/" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
          Design a watch
        </Link>
      </p>
    </div>
  );
}
