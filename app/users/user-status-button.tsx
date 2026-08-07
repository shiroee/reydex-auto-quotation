"use client";

import { useActionState } from "react";
import { LuUserCheck, LuUserX } from "react-icons/lu";

import { ROW_ACTION_CLASS, type RowActionsAlign } from "@/components/row-actions";

import { setUserDisabledAction, type UserRowState } from "./actions";

/**
 * Disable / enable control for one row of the users listing.
 *
 * Unlike `DeleteRowButton` this does not arm before firing: blocking sign-in is
 * reversible by the button that replaces it, and the confirmation step exists to
 * protect against irreversible loss. It is still a real form, so it works
 * without JavaScript.
 */
export function UserStatusButton({
  id,
  name,
  disabled,
  blockedReason,
  align = "start",
}: {
  id: string;
  /** Named in the accessible label, so each row's button is distinguishable. */
  name: string;
  /** The account's current state; the button offers the opposite. */
  disabled: boolean;
  /** Set to refuse up front, with the reason shown on hover. */
  blockedReason?: string;
  align?: RowActionsAlign;
}) {
  const [state, formAction, isPending] = useActionState<
    UserRowState | null,
    FormData
  >(setUserDisabledAction, null);

  const Icon = disabled ? LuUserCheck : LuUserX;
  const label = disabled ? "Enable" : "Disable";

  return (
    <form
      action={formAction}
      className={`inline-flex flex-col gap-1 ${
        align === "end" ? "items-end" : "items-start"
      }`}
    >
      <input type="hidden" name="id" value={id} />
      {/* The intent travels with the submission, so the action cannot act on a
          state that changed in another tab since this row was drawn. */}
      <input type="hidden" name="disable" value={disabled ? "false" : "true"} />

      {blockedReason ? (
        // A real disabled button, so it is announced as an unavailable action
        // rather than read out as plain text.
        <button
          type="button"
          disabled
          title={blockedReason}
          className={`${ROW_ACTION_CLASS} cursor-not-allowed text-gold-100/25`}
        >
          <Icon aria-hidden className="size-3.5" />
          {label}
        </button>
      ) : (
        <button
          type="submit"
          disabled={isPending}
          aria-label={`${label} ${name}`}
          className={`${ROW_ACTION_CLASS} ${
            disabled
              ? "text-gold-100/60 transition-colors hover:text-gold-100"
              : "text-gold-100/45 transition-colors hover:text-amber-200"
          } disabled:opacity-60`}
        >
          <Icon aria-hidden className="size-3.5" />
          {isPending ? (disabled ? "Enabling…" : "Disabling…") : label}
        </button>
      )}

      <div aria-live="polite" aria-atomic="true">
        {state?.error ? (
          <span
            role="alert"
            className={`block max-w-52 text-xs leading-snug text-red-300 ${
              align === "end" ? "text-right" : "text-left"
            }`}
          >
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
