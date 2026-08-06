import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import {
  listCustomerOptions,
  listPriceVariants,
} from "@/lib/quotations/catalogue";
import { isQuotationId } from "@/lib/quotations/form";
import { getQuotationForPrint } from "@/lib/quotations/service";

import { QuotationEditForm } from "./quotation-edit-form";

export const dynamic = "force-dynamic";

/** `null` for both a malformed id and a missing row, so the page 404s either way. */
async function load(id: string) {
  return isQuotationId(id) ? getQuotationForPrint(db, id) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/quotations/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);

  return { title: data ? `Edit ${data.quotation.quoteNo}` : "Edit quotation" };
}

export default async function EditQuotationPage({
  params,
}: PageProps<"/quotations/[id]/edit">) {
  await requireSession();

  const { id } = await params;

  const [data, customers, variants] = await Promise.all([
    load(id),
    listCustomerOptions(db),
    listPriceVariants(db),
  ]);

  if (!data) notFound();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
              Edit {data.quotation.quoteNo}
            </h1>
            {/*
             * The one thing that is not obvious from the form: existing lines keep
             * the price they were quoted at, so fixing a subject cannot silently
             * reprice a document. Newly added lines take today's price.
             */}
            <p className="mt-2 text-sm leading-relaxed text-gold-100/45">
              Lines already on this quotation keep the price they were quoted at,
              even if the catalogue has moved since. An item you add now is priced
              from today&apos;s price list. To keep the original and issue a fresh
              document instead, use Copy on the quotations list.
            </p>
          </div>

          <QuotationEditForm
            quotation={data.quotation}
            items={data.items}
            exclusions={data.exclusions}
            customers={customers}
            variants={variants}
          />
        </div>
      </div>
    </main>
  );
}
