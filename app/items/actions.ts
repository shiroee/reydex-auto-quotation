"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import {
  FIELD,
  isItemId,
  parseItemForm,
  type ItemFormState,
} from "@/lib/items/form";
import { createItem, deleteItem, updateItem } from "@/lib/items/service";

/** Postgres unique violation — here, the SKU is already taken. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

/** Both write paths revalidate the builder, whose item picker lists these. */
function revalidateAffected() {
  revalidatePath("/items");
  revalidatePath("/quotations/new");
}

export async function createItemAction(
  _prevState: ItemFormState | null,
  formData: FormData,
): Promise<ItemFormState> {
  // Verified here as well as in the page: a Server Action is its own entry point.
  await requireSession();

  const parsed = parseItemForm(formData);

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  try {
    await createItem(db, parsed.input);
  } catch (cause) {
    console.error("[items] create failed", cause);

    if (isUniqueViolation(cause)) {
      return {
        errors: { sku: "That SKU is already used by another item." },
        values: parsed.values,
      };
    }

    return {
      formError: "Could not save the item. Please try again.",
      values: parsed.values,
    };
  }

  // Outside the try: `redirect` signals by throwing.
  revalidateAffected();
  redirect("/items");
}

export async function updateItemAction(
  _prevState: ItemFormState | null,
  formData: FormData,
): Promise<ItemFormState> {
  await requireSession();

  const id = formData.get(FIELD.id);

  if (!isItemId(id)) {
    return { formError: "That item is no longer valid. Reload the page." };
  }

  const parsed = parseItemForm(formData);

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  try {
    const found = await updateItem(db, id, parsed.input);

    if (!found) {
      return {
        formError: "That item has been deleted.",
        values: parsed.values,
      };
    }
  } catch (cause) {
    console.error("[items] update failed", cause);

    if (isUniqueViolation(cause)) {
      return {
        errors: { sku: "That SKU is already used by another item." },
        values: parsed.values,
      };
    }

    return {
      formError: "Could not save the changes. Please try again.",
      values: parsed.values,
    };
  }

  revalidateAffected();
  redirect("/items");
}

export type DeleteItemState = { error?: string };

export async function deleteItemAction(
  _prevState: DeleteItemState | null,
  formData: FormData,
): Promise<DeleteItemState> {
  await requireSession();

  const id = formData.get(FIELD.id);

  if (!isItemId(id)) {
    return { error: "That item is no longer valid. Reload the page." };
  }

  try {
    await deleteItem(db, id);
  } catch (cause) {
    console.error("[items] delete failed", cause);
    return { error: "Could not delete the item. Please try again." };
  }

  // Quotation lines keep their snapshot, so nothing else needs saying.
  revalidateAffected();
  return {};
}
