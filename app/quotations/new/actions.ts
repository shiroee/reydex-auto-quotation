"use server";

import { redirect } from "next/navigation";

import { recordActivity, toActor } from "@/lib/activity/service";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import {
  parseQuotationForm,
  type QuotationFormState,
} from "@/lib/quotations/form";
import { createQuotation } from "@/lib/quotations/service";

export async function createQuotationAction(
  _prevState: QuotationFormState | null,
  formData: FormData,
): Promise<QuotationFormState> {
  // Verified here as well as in the page: a Server Action is its own entry point.
  const session = await requireSession();

  const parsed = parseQuotationForm(formData);

  if (!parsed.ok) {
    return { errors: parsed.errors };
  }

  let quotationId: string;

  try {
    const created = await createQuotation(db, {
      ...parsed.input,
      preparedByUserId: session.user.id,
    });
    quotationId = created.id;

    await recordActivity(db, {
      action: "create",
      entity: "quotation",
      entityId: created.id,
      label: created.quoteNo,
      actor: toActor(session),
    });
  } catch (cause) {
    // Most likely a line whose price was retired between load and submit, which
    // createQuotation reports with a readable message.
    console.error("[quotations] create failed", cause);
    return {
      formError:
        cause instanceof Error
          ? cause.message
          : "Could not save the quotation. Please try again.",
    };
  }

  // Outside the try: `redirect` signals by throwing.
  redirect(`/quotations/${quotationId}/print`);
}
