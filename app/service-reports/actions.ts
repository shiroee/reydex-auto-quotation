"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { recordActivity, toActor } from "@/lib/activity/service";
import { requireSession } from "@/lib/auth/session";
import {
  FIELD,
  isServiceReportId,
  parseServiceReportForm,
  type ServiceReportFormState,
} from "@/lib/service-reports/form";
import {
  createServiceReport,
  deleteServiceReport,
  updateServiceReport,
} from "@/lib/service-reports/service";

/**
 * Server Actions for FDAS service reports.
 *
 * The label written to the activity log is the reference plus the customer —
 * "RDX-SR-2026-0001 · SHOPPERS SAVER GROCERY" — because a bare reference tells a
 * reader nothing about which report was deleted, and the row is gone by then.
 */
function activityLabel(reportNo: string, customerName: string): string {
  return `${reportNo} · ${customerName}`;
}

export async function createServiceReportAction(
  _prevState: ServiceReportFormState | null,
  formData: FormData,
): Promise<ServiceReportFormState> {
  // Verified here as well as in the page: a Server Action is its own entry point.
  const session = await requireSession();

  const parsed = parseServiceReportForm(formData);

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  try {
    const { id, reportNo } = await createServiceReport(
      db,
      parsed.input,
      session.user.id,
    );

    await recordActivity(db, {
      action: "create",
      entity: "service_report",
      entityId: id,
      label: activityLabel(reportNo, parsed.input.customerName),
      actor: toActor(session),
    });
  } catch (cause) {
    console.error("[service-reports] create failed", cause);
    return {
      formError: "Could not save the service report. Please try again.",
      values: parsed.values,
    };
  }

  // Outside the try: `redirect` signals by throwing.
  revalidatePath("/service-reports");
  redirect("/service-reports");
}

export async function updateServiceReportAction(
  _prevState: ServiceReportFormState | null,
  formData: FormData,
): Promise<ServiceReportFormState> {
  const session = await requireSession();

  const id = formData.get(FIELD.id);

  if (!isServiceReportId(id)) {
    return { formError: "That report is no longer valid. Reload the page." };
  }

  const parsed = parseServiceReportForm(formData);

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  try {
    const updated = await updateServiceReport(db, id, parsed.input);

    if (!updated) {
      return {
        formError: "That report has been deleted.",
        values: parsed.values,
      };
    }

    await recordActivity(db, {
      action: "update",
      entity: "service_report",
      entityId: id,
      label: activityLabel(updated.reportNo, parsed.input.customerName),
      actor: toActor(session),
    });
  } catch (cause) {
    console.error("[service-reports] update failed", cause);
    return {
      formError: "Could not save the changes. Please try again.",
      values: parsed.values,
    };
  }

  revalidatePath("/service-reports");
  // The printable sheet is a separate dynamic route and caches on its own.
  revalidatePath("/service-reports/[id]/print", "page");
  redirect("/service-reports");
}

export type DeleteServiceReportState = { error?: string };

/**
 * Deletes one report. Kept separate from the form actions: it is invoked from a
 * one-button form in the list, and reports only a message.
 */
export async function deleteServiceReportAction(
  _prevState: DeleteServiceReportState | null,
  formData: FormData,
): Promise<DeleteServiceReportState> {
  const session = await requireSession();

  const id = formData.get(FIELD.id);

  if (!isServiceReportId(id)) {
    return { error: "That report is no longer valid. Reload the page." };
  }

  try {
    const result = await deleteServiceReport(db, id);

    if (!result.ok) {
      // Already gone: refresh so the stale row disappears.
      revalidatePath("/service-reports");
      return {};
    }

    await recordActivity(db, {
      action: "delete",
      entity: "service_report",
      entityId: id,
      // The reference comes back from the delete: after this there is nothing
      // left to read it from.
      label: result.reportNo,
      actor: toActor(session),
    });
  } catch (cause) {
    console.error("[service-reports] delete failed", cause);
    return { error: "Could not delete the report. Please try again." };
  }

  revalidatePath("/service-reports");
  return {};
}
