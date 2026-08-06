"use client";

import { useActionState, useId, useState } from "react";
import { LuCircleAlert, LuEye, LuEyeOff, LuLoaderCircle } from "react-icons/lu";

import type { SignInFormState } from "@/lib/auth/credentials";

import { signInWithEmail } from "./actions";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, isPending] = useActionState<
    SignInFormState | null,
    FormData
  >(signInWithEmail, null);

  const [showPassword, setShowPassword] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const emailErrorId = `${emailId}-error`;
  const passwordErrorId = `${passwordId}-error`;

  const emailError = state?.fieldErrors?.email;
  const passwordError = state?.fieldErrors?.password;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={redirectTo} />

      {/* Always rendered so screen readers announce errors on submit. */}
      <div aria-live="polite" aria-atomic="true">
        {state?.formError ? (
          <p
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200"
          >
            <LuCircleAlert
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-red-400"
            />
            {state.formError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={emailId}
          className="text-sm font-medium text-gold-100/90"
        >
          Work email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          required
          spellCheck={false}
          defaultValue={state?.email ?? ""}
          aria-invalid={emailError ? "true" : undefined}
          aria-describedby={emailError ? emailErrorId : undefined}
          placeholder="you@reydex.com"
          className="reydex-field w-full rounded-lg px-3.5 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
        />
        {emailError ? (
          <p id={emailErrorId} className="text-sm text-red-300">
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={passwordId}
          className="text-sm font-medium text-gold-100/90"
        >
          Password
        </label>
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={passwordError ? "true" : undefined}
            aria-describedby={passwordError ? passwordErrorId : undefined}
            placeholder="••••••••"
            className="reydex-field w-full rounded-lg px-3.5 py-2.5 pr-12 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-gold-100/45 transition-colors hover:text-gold-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
          >
            {showPassword ? (
              <LuEyeOff aria-hidden className="size-4.5" />
            ) : (
              <LuEye aria-hidden className="size-4.5" />
            )}
          </button>
        </div>
        {passwordError ? (
          <p id={passwordErrorId} className="text-sm text-red-300">
            {passwordError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="reydex-submit mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold tracking-wide"
      >
        {isPending ? (
          <>
            <LuLoaderCircle
              aria-hidden
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>

      <p className="text-center text-xs leading-relaxed text-gold-100/40">
        Accounts are issued by your administrator. Locked out or need access?{" "}
        <br className="hidden sm:inline" />
        Contact the Reydex office team.
      </p>
    </form>
  );
}
