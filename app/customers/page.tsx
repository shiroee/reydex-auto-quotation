import type { Metadata } from "next";
import Link from "next/link";
import { LuPencil, LuPlus } from "react-icons/lu";

import { AppHeader } from "@/components/app-header";
import { DeleteRowButton } from "@/components/delete-row-button";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { listCustomers } from "@/lib/customers/service";
import { normalizeSearch, SEARCH_PARAM } from "@/lib/quotations/search";

import { deleteCustomerAction } from "./actions";
import { CustomersSearch } from "./customers-search";

export const metadata: Metadata = { title: "Customers" };

export const dynamic = "force-dynamic";

export default async function CustomersPage(props: PageProps<"/customers">) {
  await requireSession();

  const term = normalizeSearch((await props.searchParams)[SEARCH_PARAM]);
  const rows = await listCustomers(db, { search: term });

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader>
        <Link
          href="/customers/new"
          className="reydex-submit inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold"
        >
          <LuPlus aria-hidden className="size-4" />
          New customer
        </Link>
      </AppHeader>

      <div className="flex-1 px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <CustomersSearch term={term} />

          {/*
           * `role="status"` on the result line and on the empty card, so a
           * search submitted from the keyboard is announced without focus
           * having to move into the results.
           */}
          {term && rows.length > 0 ? (
            <p className="mb-3 text-xs text-gold-100/45" role="status">
              {rows.length} {rows.length === 1 ? "match" : "matches"} for “
              {term}”
            </p>
          ) : null}

          {rows.length === 0 ? (
            <div
              className="reydex-card rounded-2xl p-8 text-center"
              role={term ? "status" : undefined}
            >
              {term ? (
                <>
                  <p className="text-gold-100/70">
                    No customers match “{term}”.
                  </p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Searches cover the name, city / province and contact person.{" "}
                    <Link href="/customers" className="text-gold-300 underline">
                      Show all customers
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gold-100/70">No customers yet.</p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Add one with{" "}
                    <Link
                      href="/customers/new"
                      className="text-gold-300 underline"
                    >
                      New customer
                    </Link>
                    , or run{" "}
                    <code className="text-gold-300">npm run db:seed</code> to
                    load the samples.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="reydex-card overflow-hidden rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gold-500/15 text-xs uppercase tracking-wider text-gold-100/45">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">City / province</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 text-right font-medium">Quotes</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gold-500/8 last:border-0"
                    >
                      <td className="px-4 py-3 text-gold-100/85">
                        <Link
                          href={`/customers/${row.id}/edit`}
                          className="underline-offset-2 hover:text-gold-100 hover:underline"
                        >
                          {row.name}
                        </Link>
                        {row.addressLine ? (
                          <span className="mt-0.5 block max-w-72 truncate text-xs text-gold-100/35">
                            {row.addressLine}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gold-100/55">
                        {row.cityProvince ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gold-100/55">
                        {row.contactPerson ?? "—"}
                        {row.contactEmail || row.contactPhone ? (
                          <span className="mt-0.5 block text-xs text-gold-100/35">
                            {[row.contactPhone, row.contactEmail]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </td>
                      {/*
                       * The quotation count is also what decides whether the row
                       * can be deleted, so it earns a column of its own.
                       */}
                      <td className="px-4 py-3 text-right tabular-nums text-gold-100/55">
                        {row.quotationCount > 0 ? (
                          <Link
                            href={`/quotations?${SEARCH_PARAM}=${encodeURIComponent(row.name)}`}
                            className="text-gold-300 underline-offset-2 hover:underline"
                          >
                            {row.quotationCount}
                          </Link>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start justify-end gap-4">
                          <Link
                            href={`/customers/${row.id}/edit`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-300 underline-offset-2 hover:underline"
                          >
                            <LuPencil aria-hidden className="size-3.5" />
                            Edit
                          </Link>
                          {/*
                           * Quotations print this customer's details, so one
                           * that is referenced cannot be deleted. Saying so up
                           * front beats arming a button that always fails — the
                           * action re-checks regardless, since the count in this
                           * render can go stale.
                           */}
                          <DeleteRowButton
                            action={deleteCustomerAction}
                            id={row.id}
                            name={row.name}
                            blockedReason={
                              row.quotationCount > 0
                                ? `In use by ${row.quotationCount} ${
                                    row.quotationCount === 1
                                      ? "quotation"
                                      : "quotations"
                                  }`
                                : undefined
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
