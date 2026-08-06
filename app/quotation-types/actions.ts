"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import {
  FIELD,
  isPresetId,
  parsePresetForm,
  type PresetFormState,
} from "@/lib/presets/form";
import {
  createPreset,
  deletePreset,
  updatePreset,
} from "@/lib/presets/service";

/** Postgres unique violation — here, the slug is already taken. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

/** Both write paths revalidate the builder, whose picker lists these. */
function revalidateAffected() {
  revalidatePath("/quotation-types");
  revalidatePath("/quotations/new");
}

export async function createPresetAction(
  _prevState: PresetFormState | null,
  formData: FormData,
): Promise<PresetFormState> {
  // Verified here as well as in the page: a Server Action is its own entry point.
  await requireSession();

  const parsed = parsePresetForm(formData);

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  try {
    await createPreset(db, parsed.input);
  } catch (cause) {
    console.error("[quotation-types] create failed", cause);

    if (isUniqueViolation(cause)) {
      return {
        errors: { slug: "That slug is already used by another quotation type." },
        values: parsed.values,
      };
    }

    return {
      formError: "Could not save the quotation type. Please try again.",
      values: parsed.values,
    };
  }

  // Outside the try: `redirect` signals by throwing.
  revalidateAffected();
  redirect("/quotation-types");
}

export async function updatePresetAction(
  _prevState: PresetFormState | null,
  formData: FormData,
): Promise<PresetFormState> {
  await requireSession();

  const id = formData.get(FIELD.id);

  if (!isPresetId(id)) {
    return {
      formError: "That quotation type is no longer valid. Reload the page.",
    };
  }

  const parsed = parsePresetForm(formData);

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  try {
    const found = await updatePreset(db, id, parsed.input);

    if (!found) {
      return {
        formError: "That quotation type has been deleted.",
        values: parsed.values,
      };
    }
  } catch (cause) {
    console.error("[quotation-types] update failed", cause);

    if (isUniqueViolation(cause)) {
      return {
        errors: { slug: "That slug is already used by another quotation type." },
        values: parsed.values,
      };
    }

    return {
      formError: "Could not save the changes. Please try again.",
      values: parsed.values,
    };
  }

  revalidateAffected();
  redirect("/quotation-types");
}

export type DeletePresetState = { error?: string };

export async function deletePresetAction(
  _prevState: DeletePresetState | null,
  formData: FormData,
): Promise<DeletePresetState> {
  await requireSession();

  const id = formData.get(FIELD.id);

  if (!isPresetId(id)) {
    return { error: "That quotation type is no longer valid. Reload the page." };
  }

  try {
    const result = await deletePreset(db, id);

    if (!result.ok) {
      if (result.reason === "last_one") {
        return {
          error:
            "This is the only quotation type left, and the builder needs one. Add another first.",
        };
      }

      // Already gone: refresh so the stale row disappears.
      revalidateAffected();
      return {};
    }
  } catch (cause) {
    console.error("[quotation-types] delete failed", cause);
    return { error: "Could not delete the quotation type. Please try again." };
  }

  revalidateAffected();
  return {};
}
