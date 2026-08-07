"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordActivity, toActor } from "@/lib/activity/service";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import {
  FIELD,
  isCustomerId,
  parseCustomerForm,
  type CustomerFormState,
} from "@/lib/customers/form";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "@/lib/customers/service";

/** Postgres foreign-key violation — the `ON DELETE RESTRICT` backstop firing. */
const FK_VIOLATION = "23503";

function isForeignKeyViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === FK_VIOLATION
  );
}

export async function createCustomerAction(
  _prevState: CustomerFormState | null,
  formData: FormData,
): Promise<CustomerFormState> {
  // Verified here as well as in the page: a Server Action is its own entry point.
  const session = await requireSession();

  const parsed = parseCustomerForm(formData);

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  try {
    const { id } = await createCustomer(db, parsed.input);

    await recordActivity(db, {
      action: "create",
      entity: "customer",
      entityId: id,
      label: parsed.input.name,
      actor: toActor(session),
    });
  } catch (cause) {
    console.error("[customers] create failed", cause);
    return {
      formError: "Could not save the customer. Please try again.",
      values: parsed.values,
    };
  }

  // Outside the try: `redirect` signals by throwing.
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomerAction(
  _prevState: CustomerFormState | null,
  formData: FormData,
): Promise<CustomerFormState> {
  const session = await requireSession();

  const id = formData.get(FIELD.id);

  if (!isCustomerId(id)) {
    return { formError: "That customer is no longer valid. Reload the page." };
  }

  const parsed = parseCustomerForm(formData);

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  try {
    const found = await updateCustomer(db, id, parsed.input);

    if (!found) {
      return {
        formError: "That customer has been deleted.",
        values: parsed.values,
      };
    }

    await recordActivity(db, {
      action: "update",
      entity: "customer",
      entityId: id,
      label: parsed.input.name,
      actor: toActor(session),
    });
  } catch (cause) {
    console.error("[customers] update failed", cause);
    return {
      formError: "Could not save the changes. Please try again.",
      values: parsed.values,
    };
  }

  /*
   * Quotations print the customer's name and address, so an edit changes more
   * than this page — revalidate the whole quotation subtree as well.
   */
  revalidatePath("/customers");
  revalidatePath("/quotations");
  revalidatePath("/quotations/[id]/print", "page");
  redirect("/customers");
}

export type DeleteCustomerState = { error?: string };

/**
 * Deletes one customer. Kept separate from the form actions: it is invoked from
 * a one-button form in the list, and reports only a message.
 */
export async function deleteCustomerAction(
  _prevState: DeleteCustomerState | null,
  formData: FormData,
): Promise<DeleteCustomerState> {
  const session = await requireSession();

  const id = formData.get(FIELD.id);

  if (!isCustomerId(id)) {
    return { error: "That customer is no longer valid. Reload the page." };
  }

  try {
    const result = await deleteCustomer(db, id);

    if (result.ok) {
      // The name comes back from the delete: after this there is nothing to read.
      await recordActivity(db, {
        action: "delete",
        entity: "customer",
        entityId: id,
        label: result.name,
        actor: toActor(session),
      });
    }

    if (!result.ok) {
      if (result.reason === "not_found") {
        // Already gone: refresh so the stale row disappears.
        revalidatePath("/customers");
        return {};
      }

      const { quotationCount } = result;
      return {
        error:
          `Still used by ${quotationCount} ` +
          `${quotationCount === 1 ? "quotation" : "quotations"}. ` +
          `Delete those first, or keep this customer.`,
      };
    }
  } catch (cause) {
    console.error("[customers] delete failed", cause);
    return {
      error: isForeignKeyViolation(cause)
        ? "A quotation was just created for this customer, so it can no longer be deleted."
        : "Could not delete the customer. Please try again.",
    };
  }

  revalidatePath("/customers");
  return {};
}
