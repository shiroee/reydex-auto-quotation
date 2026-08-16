import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { todayInQuoteZone } from "@/lib/quotations/dates";
import { isServiceReportId } from "@/lib/service-reports/form";
import { getServiceReport } from "@/lib/service-reports/service";

import { ServiceReportForm } from "../../service-report-form";

export const dynamic = "force-dynamic";

/** `null` for both a malformed id and a missing row, so the page 404s either way. */
async function load(id: string) {
  return isServiceReportId(id) ? getServiceReport(db, id) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/service-reports/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  const report = await load(id);

  return { title: report ? `Edit ${report.reportNo}` : "Edit service report" };
}

export default async function EditServiceReportPage({
  params,
}: PageProps<"/service-reports/[id]/edit">) {
  await requireSession();

  const { id } = await params;
  const report = await load(id);

  if (!report) notFound();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
              Edit {report.reportNo}
            </h1>
            {/*
             * The one thing that is not obvious from the form: the reference is
             * fixed when the report is raised, so re-dating a visit into another
             * year does not renumber it. It is the identifier on a sheet that
             * may already be in a client's fire-safety file.
             */}
            <p className="mt-2 text-sm leading-relaxed text-gold-100/45">
              {report.reportNo} stays with this report even if you change the
              date of service.{" "}
              <Link
                href={`/service-reports/${report.id}/print`}
                className="text-gold-300 underline underline-offset-2"
              >
                Open the printable report
              </Link>{" "}
              to check how an edit reads.
            </p>
          </div>

          <ServiceReportForm report={report} today={todayInQuoteZone()} />
        </div>
      </div>
    </main>
  );
}
