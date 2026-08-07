"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  FIELD,
  MIN_PASSWORD_LENGTH,
  ROLE_HINT,
  ROLE_LABEL,
  ROLES,
  type UserFormState,
  type UserFormValues,
} from "@/lib/users/form";
import type { UserRecord } from "@/lib/users/service";

import { createUserAction, updateUserAction } from "./actions";

/**
 * Add / edit form for a staff account.
 *
 * One component for both, as with the customer form: the fields are the same and
 * only the action, the hidden id and the password's meaning differ — required
 * when adding, "leave blank to keep" when editing.
 */
export function UserForm({
  user,
  isSelf = false,
}: {
  user?: UserRecord;
  /** Softens the wording when an administrator is editing their own account. */
  isSelf?: boolean;
}) {
  const isEdit = user !== undefined;

  const [state, formAction, isPending] = useActionState<
    UserFormState | null,
    FormData
  >(isEdit ? updateUserAction : createUserAction, null);

  /**
   * A rejected submit wins over the stored account: React resets an uncontrolled
   * form once the action settles, so without the echoed values the fields would
   * snap back to what was loaded and quietly discard the edit.
   *
   * The password is never echoed — see `UserFormValues` — so it is always asked
   * for again.
   */
  function initial(field: keyof UserFormValues): string {
    return state?.values?.[field] ?? user?.[field] ?? "";
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {isEdit ? <input type="hidden" name={FIELD.id} value={user.id} /> : null}

      {/* Always rendered so screen readers announce errors on submit. */}
      <div aria-live="polite" aria-atomic="true">
        {state?.formError ? (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200"
          >
            {state.formError}
          </p>
        ) : null}
      </div>

      <section className="reydex-card rounded-2xl p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
          Account
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" error={state?.errors?.name} required>
            <input
              name={FIELD.name}
              defaultValue={initial("name")}
              autoFocus={!isEdit}
              aria-invalid={state?.errors?.name ? "true" : undefined}
              placeholder="Juan Dela Cruz"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field
            label="Email"
            error={state?.errors?.email}
            hint="What they sign in with"
            required
          >
            <input
              name={FIELD.email}
              type="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              defaultValue={initial("email")}
              aria-invalid={state?.errors?.email ? "true" : undefined}
              placeholder="juan@reydex.com"
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
            />
          </Field>

          <Field
            label="Role"
            error={state?.errors?.role}
            hint={
              isSelf
                ? "Changing your own role signs you out of these pages"
                : undefined
            }
          >
            <select
              name={FIELD.role}
              defaultValue={initial("role") || "user"}
              aria-invalid={state?.errors?.role ? "true" : undefined}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]} — {ROLE_HINT[role]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={isEdit ? "New password" : "First password"}
            error={state?.errors?.password}
            hint={
              isEdit
                ? "Leave blank to keep the current one"
                : `At least ${MIN_PASSWORD_LENGTH} characters`
            }
            required={!isEdit}
          >
            <input
              name={FIELD.password}
              type="password"
              /*
               * `new-password` on both paths: this form never asks for the
               * signed-in administrator's own credentials, so a password manager
               * must not offer to fill it with them.
               */
              autoComplete="new-password"
              aria-invalid={state?.errors?.password ? "true" : undefined}
              className="reydex-field w-full rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
            />
          </Field>
        </div>

        {/*
         * Said once, at the point of setting it: nothing in the app mails a
         * password out, so whoever adds the account has to pass it on.
         */}
        <p className="mt-5 text-xs leading-relaxed text-gold-100/40">
          {isEdit
            ? "Setting a new password replaces the current one immediately. Tell them what it is — the app sends no email."
            : "Give them this password yourself; the app sends no email. They can sign in with it straight away."}
        </p>
      </section>

      {/* Stacked on a phone, submit full-width — see the customer form. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <Link
          href="/users"
          className="order-2 text-center text-sm text-gold-100/50 underline-offset-2 hover:text-gold-100 hover:underline sm:order-1"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="reydex-submit order-1 inline-flex h-11 w-full items-center justify-center rounded-lg px-6 text-sm font-semibold tracking-wide sm:order-2 sm:w-auto"
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add user"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gold-100/90">
        {label}
        {required ? <span className="ml-1 text-gold-500/70">*</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="text-xs text-red-300">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-gold-100/30">{hint}</span>
      ) : null}
    </label>
  );
}
