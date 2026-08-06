"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { parseQuoteDate } from "@/lib/quotations/dates";
import { isQuotationId, REISSUE_FIELD as FIELD } from "@/lib/quotations/form";
import {
  deleteQuotation,
  duplicateQuotation,
  setQuotationDate,
} from "@/lib/quotations/service";

export type ReissueState = { error?: string };

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
