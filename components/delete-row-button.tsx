"use client";

import { useActionState, useState } from "react";
import { LuTrash2 } from "react-icons/lu";

/** What every delete action reports back: nothing, or why it refused. */
export type DeleteRowState = { error?: string };

export type DeleteRowAction = (
  state: DeleteRowState | null,
  formData: FormData,
) => Promise<DeleteRowState>;

/**
 * Delete control for one row of a listing, shared by the three dashboards.
 *
 * Deleting is irreversible, so the first click only arms the button and the
 * second one submits. The trigger is nonetheless a real submit button whose
 * arming happens in `onClick` — with JavaScript off the handler never runs and
 * the form posts on the first click, which is the honest fallback: worse
 * confirmation, but not a dead button.
 */
export function DeleteRowButton({
  action,
  id,
  name,
  idFieldName = "id",
  blockedReason,
  warning,
}: {
  action: DeleteRowAction;
  id: string;
  /** Named in the accessible label, so each row's button is distinguishable. */
  name: string;
  idFieldName?: string;
  /** Set to refuse up front, with the reason shown on hover. */
  blockedReason?: string;
  /** Shown once armed — the consequence, when there is one worth stating. */
  warning?: string;
}) {
  const [state, formAction, isPending] = useActionState<
    DeleteRowState | null,
    FormData
  >(action, null);

  const [armed, setArmed] = useState(false);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name={idFieldName} value={id} />

      {blockedReason ? (
        // A real disabled button, so it is announced as an unavailable action
        // rather than read out as plain text.
        <button
          type="button"
          disabled
          title={blockedReason}
          className="inline-flex cursor-not-allowed items-center gap-1.5 text-xs font-medium text-gold-100/25"
        >
          <LuTrash2 aria-hidden className="size-3.5" />
          Delete
        </button>
      ) : armed ? (
        <span className="inline-flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-60"
          >
            <LuTrash2 aria-hidden className="size-3.5" />
            {isPending ? "Deleting…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="text-xs font-medium text-gold-100/45 transition-colors hover:text-gold-100"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="submit"
          onClick={(event) => {
            event.preventDefault();
            setArmed(true);
          }}
          aria-label={`Delete ${name}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-100/45 transition-colors hover:text-red-300"
        >
          <LuTrash2 aria-hidden className="size-3.5" />
          Delete
        </button>
      )}

      {armed && warning && !state?.error ? (
        <span className="block max-w-52 text-right text-xs leading-snug text-gold-100/45">
          {warning}
        </span>
      ) : null}

      <div aria-live="polite" aria-atomic="true">
        {state?.error ? (
          <span
            role="alert"
            className="block max-w-52 text-right text-xs leading-snug text-red-300"
          >
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
