import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { isCustomerId } from "@/lib/customers/form";
import { getCustomer } from "@/lib/customers/service";
import { SEARCH_PARAM } from "@/lib/quotations/search";

import { CustomerForm } from "../../customer-form";

export const dynamic = "force-dynamic";

/** `null` for both a malformed id and a missing row, so the page 404s either way. */
async function loadCustomer(id: string) {
  return isCustomerId(id) ? getCustomer(db, id) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/customers/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  const customer = await loadCustomer(id);

  return { title: customer ? `Edit ${customer.name}` : "Customer" };
}

export default async function EditCustomerPage({
  params,
}: PageProps<"/customers/[id]/edit">) {
  await requireSession();

  const { id } = await params;
  const customer = await loadCustomer(id);

  if (!customer) notFound();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
            Edit customer
          </h1>

          {/*
           * Edits reach documents that have already been sent, so say how many
           * before anyone changes a name or address.
           */}
          {customer.quotationCount > 0 ? (
            <p className="text-xs text-gold-100/45">
              Used by{" "}
              <Link
                href={`/quotations?${SEARCH_PARAM}=${encodeURIComponent(customer.name)}`}
                className="text-gold-300 underline underline-offset-2"
              >
                {customer.quotationCount}{" "}
                {customer.quotationCount === 1 ? "quotation" : "quotations"}
              </Link>
              . Changes here show on those documents when they are next printed.
            </p>
          ) : null}

          <CustomerForm customer={customer} />
        </div>
      </div>
    </main>
  );
}
