"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { recordActivity, toActor } from "@/lib/activity/service";
import { requireSession } from "@/lib/auth/session";
import {
  FIELD,
  isCertificateId,
  parseCertificateForm,
  type CertificateFormState,
} from "@/lib/certificates/form";
import {
  createCertificate,
  deleteCertificate,
  updateCertificate,
} from "@/lib/certificates/service";

/**
 * Server Actions for certificates of completion.
 *
 * The label written to the activity log is the reference plus the client —
 * "RDX-COC-2026-0001 · SHOPPER SAVERS" — because a bare reference tells a reader
 * nothing about which certificate was deleted, and the row is gone by then.
 */
function activityLabel(certNo: string, clientName: string): string {
  return `${certNo} · ${clientName}`;
}

export async function createCertificateAction(
  _prevState: CertificateFormState | null,
  formData: FormData,
): Promise<CertificateFormState> {
  // Verified here as well as in the page: a Server Action is its own entry point.
  const session = await requireSession();

  const parsed = parseCertificateForm(formData);

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  try {
    const { id, certNo } = await createCertificate(
      db,
      parsed.input,
      session.user.id,
    );

    await recordActivity(db, {
      action: "create",
      entity: "certificate",
      entityId: id,
      label: activityLabel(certNo, parsed.input.clientName),
      actor: toActor(session),
    });
  } catch (cause) {
    console.error("[certificates] create failed", cause);
    return {
      formError: "Could not issue the certificate. Please try again.",
      values: parsed.values,
    };
  }

  // Outside the try: `redirect` signals by throwing.
  revalidatePath("/certificates");
  redirect("/certificates");
}

export async function updateCertificateAction(
  _prevState: CertificateFormState | null,
  formData: FormData,
): Promise<CertificateFormState> {
  const session = await requireSession();

  const id = formData.get(FIELD.id);

  if (!isCertificateId(id)) {
    return { formError: "That certificate is no longer valid. Reload the page." };
  }

  const parsed = parseCertificateForm(formData);

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  try {
    const updated = await updateCertificate(db, id, parsed.input);

    if (!updated) {
      return {
        formError: "That certificate has been deleted.",
        values: parsed.values,
      };
    }

    await recordActivity(db, {
      action: "update",
      entity: "certificate",
      entityId: id,
      label: activityLabel(updated.certNo, parsed.input.clientName),
      actor: toActor(session),
    });
  } catch (cause) {
    console.error("[certificates] update failed", cause);
    return {
      formError: "Could not save the changes. Please try again.",
      values: parsed.values,
    };
  }

  revalidatePath("/certificates");
  // The printable sheet is a separate dynamic route and caches on its own.
  revalidatePath("/certificates/[id]/print", "page");
  redirect("/certificates");
}

export type DeleteCertificateState = { error?: string };

/**
 * Deletes one certificate. Kept separate from the form actions: it is invoked
 * from a one-button form in the list, and reports only a message.
 */
export async function deleteCertificateAction(
  _prevState: DeleteCertificateState | null,
  formData: FormData,
): Promise<DeleteCertificateState> {
  const session = await requireSession();

  const id = formData.get(FIELD.id);

  if (!isCertificateId(id)) {
    return { error: "That certificate is no longer valid. Reload the page." };
  }

  try {
    const result = await deleteCertificate(db, id);

    if (!result.ok) {
      // Already gone: refresh so the stale row disappears.
      revalidatePath("/certificates");
      return {};
    }

    await recordActivity(db, {
      action: "delete",
      entity: "certificate",
      entityId: id,
      // The reference comes back from the delete: after this there is nothing
      // left to read it from.
      label: result.certNo,
      actor: toActor(session),
    });
  } catch (cause) {
    console.error("[certificates] delete failed", cause);
    return { error: "Could not delete the certificate. Please try again." };
  }

  revalidatePath("/certificates");
  return {};
}
