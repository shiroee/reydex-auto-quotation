"use client";

import { useActionState, useId, useState } from "react";

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
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-red-400"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-9-4a1 1 0 1 1 2 0v4a1 1 0 1 1-2 0V6Zm1 8.5a1.15 1.15 0 1 1 0-2.3 1.15 1.15 0 0 1 0 2.3Z"
                clipRule="evenodd"
              />
            </svg>
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
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
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
            <SpinnerIcon />
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

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      className="size-[18px]"
    >
      <path
        d="M1.5 10S4.6 4.5 10 4.5 18.5 10 18.5 10 15.4 15.5 10 15.5 1.5 10 1.5 10Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.75" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      className="size-[18px]"
    >
      <path
        d="M3.4 3.4l13.2 13.2M8.1 8.2A2.75 2.75 0 0 0 11.9 12M6.3 5.6A9.6 9.6 0 0 1 10 4.5c5.4 0 8.5 5.5 8.5 5.5a15.6 15.6 0 0 1-2.4 3.2M4 6.9A15.4 15.4 0 0 0 1.5 10S4.6 15.5 10 15.5c1.1 0 2.1-.2 3-.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-4 animate-spin motion-reduce:animate-none"
    >
      <circle
        cx="10"
        cy="10"
        r="7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        d="M17.5 10a7.5 7.5 0 0 0-7.5-7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
