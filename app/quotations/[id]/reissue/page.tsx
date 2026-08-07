import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LuCalendarDays, LuCopy } from "react-icons/lu";

import { AppHeader } from "@/components/app-header";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { todayInQuoteZone } from "@/lib/quotations/dates";
import { isQuotationId } from "@/lib/quotations/form";
import { formatPeso } from "@/lib/quotations/money";
import { getQuotationForPrint } from "@/lib/quotations/service";

import { DuplicateForm, ReDateForm } from "./reissue-forms";

export const dynamic = "force-dynamic";

/** `null` for both a malformed id and a missing row, so the page 404s either way. */
async function load(id: string) {
  return isQuotationId(id) ? getQuotationForPrint(db, id) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/quotations/[id]/reissue">): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);

  return {
    title: data ? `Re-issue ${data.quotation.quoteNo}` : "Re-issue quotation",
  };
}

export default async function ReissueQuotationPage({
  params,
}: PageProps<"/quotations/[id]/reissue">) {
  await requireSession();

  const { id } = await params;
  const data = await load(id);

  if (!data) notFound();

  const { quotation, customer, items } = data;

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
              Re-issue quotation
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gold-100/45">
              Two different things, so they are kept apart: copying leaves the
              original untouched and produces a new document, while changing the
              date rewrites the one the client may already have.
            </p>
          </div>

          {/* What is being re-issued, so the wrong row is obvious before acting. */}
          <div className="reydex-card rounded-2xl p-5">
            <p className="font-mono text-xs text-gold-200">
              {quotation.quoteNo}
            </p>
            <p className="mt-1.5 text-gold-100/85">{customer?.name}</p>
            <p className="mt-0.5 text-sm text-gold-100/55">
              {quotation.subject}
            </p>
            <p className="mt-2.5 text-xs text-gold-100/40">
              Dated {quotation.quoteDate} · {items.length}{" "}
              {items.length === 1 ? "line" : "lines"} ·{" "}
              {formatPeso(quotation.totalAmount)}
            </p>
          </div>

          <section className="reydex-card rounded-2xl p-5 sm:p-6">
            <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
              <LuCopy aria-hidden className="size-4" />
              Copy to a new quotation
            </h2>
            <p className="mb-5 text-xs leading-relaxed text-gold-100/40">
              Same customer, subject, wording, terms and lines — at the prices
              that were quoted, not today&apos;s catalogue prices. The copy opens
              ready to print.
            </p>

            <DuplicateForm id={quotation.id} today={todayInQuoteZone()} />
          </section>

          <section className="reydex-card rounded-2xl p-5 sm:p-6">
            <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
              <LuCalendarDays aria-hidden className="size-4" />
              Change this quotation&apos;s date
            </h2>
            <p className="mb-5 text-xs leading-relaxed text-gold-100/40">
              Corrects the date in place, keeping {quotation.quoteNo}. Use this
              for a quotation that has not gone out yet.
            </p>

            <ReDateForm id={quotation.id} quoteDate={quotation.quoteDate} />
          </section>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/quotations"
              className="text-sm text-gold-100/50 underline-offset-2 hover:text-gold-100 hover:underline"
            >
              Back to all quotations
            </Link>
            <Link
              href={`/quotations/${quotation.id}/print`}
              className="text-sm text-gold-300 underline-offset-2 hover:underline"
            >
              Open the document
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
