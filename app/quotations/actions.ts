"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { parseQuoteDate } from "@/lib/quotations/dates";
import {
  EDIT_FIELD,
  parseQuotationEditForm,
  type QuotationEditState,
} from "@/lib/quotations/edit-form";
import { isQuotationId, REISSUE_FIELD as FIELD } from "@/lib/quotations/form";
import {
  deleteQuotation,
  duplicateQuotation,
  setQuotationDate,
  updateQuotation,
} from "@/lib/quotations/service";

export type ReissueState = { error?: string };

/** Applies an edit, then opens the updated document. */
export async function updateQuotationAction(
  _prevState: QuotationEditState | null,
  formData: FormData,
): Promise<QuotationEditState> {
  // Verified here as well as in the page: a Server Action is its own entry point.
  await requireSession();

  const id = formData.get(EDIT_FIELD.id);

  if (!isQuotationId(id)) {
    return { formError: "That quotation is no longer valid. Reload the page." };
  }

  const parsed = parseQuotationEditForm(formData);

  if (!parsed.ok) return { errors: parsed.errors };

  try {
    const result = await updateQuotation(db, id, parsed.input);

    if (!result.ok) return { formError: "That quotation has been deleted." };
  } catch (cause) {
    /*
     * Most likely a line whose price was retired between loading the form and
     * submitting it, which `updateQuotation` reports with a readable message.
     * The edit is a single transaction, so nothing was half-applied.
     */
    console.error("[quotations] update failed", cause);

    return {
      formError:
        cause instanceof Error
          ? cause.message
          : "Could not save the changes. Please try again.",
    };
  }

  // Outside the try: `redirect` signals by throwing.
  revalidateAffected(id);
  redirect(`/quotations/${id}/print`);
}

/** The index, and the document itself where one is named. */
function revalidateAffected(id?: string) {
  revalidatePath("/quotations");
  if (id) revalidatePath(`/quotations/${id}/print`);
}

/**
 * Copies a quotation under a new reference and date, then opens the copy.
 *
 * A blank date is not an error — it means today, which is what re-issuing a
 * quote usually means.
 */
export async function duplicateQuotationAction(
  _prevState: ReissueState | null,
  formData: FormData,
): Promise<ReissueState> {
  // Verified here as well as in the page: a Server Action is its own entry point.
  const session = await requireSession();

  const id = formData.get(FIELD.id);

  if (!isQuotationId(id)) {
    return { error: "That quotation is no longer valid. Reload the page." };
  }

  const raw = formData.get(FIELD.quoteDate);
  const typed = typeof raw === "string" ? raw.trim() : "";

  // Left blank means today, which `duplicateQuotation` fills in.
  let quoteDate: string | undefined;

  if (typed !== "") {
    const parsed = parseQuoteDate(typed);
    if (!parsed.ok) return { error: parsed.error };
    quoteDate = parsed.date;
  }

  let copyId: string;

  try {
    const result = await duplicateQuotation(db, id, {
      quoteDate,
      preparedByUserId: session.user.id,
    });

    if (!result.ok) {
      return { error: "That quotation has been deleted." };
    }

    copyId = result.id;
  } catch (cause) {
    console.error("[quotations] duplicate failed", cause);
    return { error: "Could not copy the quotation. Please try again." };
  }

  // Outside the try: `redirect` signals by throwing.
  revalidateAffected();
  redirect(`/quotations/${copyId}/print`);
}

/** Re-dates a quotation in place, keeping its reference number. */
export async function setQuotationDateAction(
  _prevState: ReissueState | null,
  formData: FormData,
): Promise<ReissueState> {
  await requireSession();

  const id = formData.get(FIELD.id);

  if (!isQuotationId(id)) {
    return { error: "That quotation is no longer valid. Reload the page." };
  }

  const parsed = parseQuoteDate(formData.get(FIELD.quoteDate));

  if (!parsed.ok) return { error: parsed.error };

  try {
    const found = await setQuotationDate(db, id, parsed.date);

    if (!found) return { error: "That quotation has been deleted." };
  } catch (cause) {
    console.error("[quotations] re-date failed", cause);
    return { error: "Could not change the date. Please try again." };
  }

  revalidateAffected(id);
  redirect(`/quotations/${id}/print`);
}

export type DeleteQuotationState = { error?: string };

export async function deleteQuotationAction(
  _prevState: DeleteQuotationState | null,
  formData: FormData,
): Promise<DeleteQuotationState> {
  await requireSession();

  const id = formData.get(FIELD.id);

  if (!isQuotationId(id)) {
    return { error: "That quotation is no longer valid. Reload the page." };
  }

  try {
    // Items and exclusions cascade; nothing else references a quotation, and an
    // already-deleted row needs no message — just a refreshed list.
    await deleteQuotation(db, id);
  } catch (cause) {
    console.error("[quotations] delete failed", cause);
    return { error: "Could not delete the quotation. Please try again." };
  }

  revalidatePath("/quotations");
  return {};
}
