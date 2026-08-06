"use client";

import { useActionState } from "react";
import { LuCircleAlert, LuCopy, LuCalendarDays } from "react-icons/lu";

import {
  duplicateQuotationAction,
  setQuotationDateAction,
  type ReissueState,
} from "@/app/quotations/actions";
import { REISSUE_FIELD as FIELD } from "@/lib/quotations/form";

/**
 * The two ways to re-date a quotation, as plain forms.
 *
 * Client components only so the pending state and the action's error can be
 * shown; both are real `<form>`s posting to a Server Action, so each works
 * without JavaScript.
 */

export function DuplicateForm({
  id,
  today,
}: {
  id: string;
  /** Today where the business is, not in UTC — see lib/quotations/dates.ts. */
  today: string;
}) {
  const [state, formAction, isPending] = useActionState<
    ReissueState | null,
    FormData
  >(duplicateQuotationAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name={FIELD.id} value={id} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gold-100/90">
          Date for the copy
        </span>
        <input
          type="date"
          name={FIELD.quoteDate}
          defaultValue={today}
          className="reydex-field w-full max-w-56 rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
        />
        <span className="text-xs text-gold-100/30">
          Defaults to today. The copy gets the next reference number.
        </span>
      </label>

      <ActionError error={state?.error} />

      <button
        type="submit"
        disabled={isPending}
        className="reydex-submit inline-flex h-10 w-fit items-center gap-1.5 rounded-lg px-4 text-sm font-semibold"
      >
        <LuCopy aria-hidden className="size-4" />
        {isPending ? "Copying…" : "Create the copy"}
      </button>
    </form>
  );
}

export function ReDateForm({
  id,
  quoteDate,
}: {
  id: string;
  quoteDate: string;
}) {
  const [state, formAction, isPending] = useActionState<
    ReissueState | null,
    FormData
  >(setQuotationDateAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name={FIELD.id} value={id} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gold-100/90">New date</span>
        <input
          type="date"
          name={FIELD.quoteDate}
          defaultValue={quoteDate}
          className="reydex-field w-full max-w-56 rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50"
        />
        <span className="text-xs text-gold-100/30">
          The reference number does not change.
        </span>
      </label>

      <ActionError error={state?.error} />

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-10 w-fit items-center gap-1.5 rounded-lg border border-gold-500/25 px-4 text-sm font-medium text-gold-100/85 transition-colors hover:border-gold-400/45 hover:text-gold-100 disabled:opacity-60"
      >
        <LuCalendarDays aria-hidden className="size-4" />
        {isPending ? "Saving…" : "Change the date"}
      </button>
    </form>
  );
}

/** Always rendered, so a screen reader announces the error on submit. */
function ActionError({ error }: { error?: string }) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200"
        >
          <LuCircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
