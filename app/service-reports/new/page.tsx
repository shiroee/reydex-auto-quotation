import type { Metadata } from "next";

import { AppHeader } from "@/components/app-header";
import { requireSession } from "@/lib/auth/session";
import { todayInQuoteZone } from "@/lib/quotations/dates";

import { ServiceReportForm } from "../service-report-form";

export const metadata: Metadata = { title: "New service report" };

export const dynamic = "force-dynamic";

export default async function NewServiceReportPage() {
  await requireSession();

  // Manila, not UTC: `toISOString()` is a day behind for the whole Philippine
  // morning, which would date a visit made before 8 a.m. as yesterday.
  const today = todayInQuoteZone();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
              New service report
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gold-100/45">
              The FDAS maintenance report left with a client after a preventive
              maintenance visit. The thirteen checklist questions are fixed —
              they are the form — and only the five particulars at the top are
              required, so a report can be started on site and finished
              afterwards. The reference number is allocated when you save.
            </p>
          </div>

          <ServiceReportForm today={today} />
        </div>
      </div>
    </main>
  );
}
