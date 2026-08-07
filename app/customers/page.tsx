import type { Metadata } from "next";
import Link from "next/link";
import { LuPencil, LuPlus } from "react-icons/lu";

import { AppHeader } from "@/components/app-header";
import { DeleteRowButton } from "@/components/delete-row-button";
import { RecordCard, RecordList } from "@/components/record-list";
import {
  RowAction,
  RowActions,
  type RowActionsAlign,
} from "@/components/row-actions";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { listCustomers, type CustomerListRow } from "@/lib/customers/service";
import { normalizeSearch, SEARCH_PARAM } from "@/lib/quotations/search";

import { deleteCustomerAction } from "./actions";
import { CustomersSearch } from "./customers-search";

export const metadata: Metadata = { title: "Customers" };

export const dynamic = "force-dynamic";

/** One row's controls, drawn once in the table cell and once in the phone card. */
function Controls({
  row,
  align,
}: {
  row: CustomerListRow;
  align?: RowActionsAlign;
}) {
  return (
    <RowActions align={align}>
      <RowAction
        href={`/customers/${row.id}/edit`}
        icon={LuPencil}
        tone="primary"
      >
        Edit
      </RowAction>
      {/*
       * Quotations print this customer's details, so one that is referenced
       * cannot be deleted. Saying so up front beats arming a button that always
       * fails — the action re-checks regardless, since the count in this render
       * can go stale.
       */}
      <DeleteRowButton
        action={deleteCustomerAction}
        id={row.id}
        name={row.name}
        blockedReason={
          row.quotationCount > 0
            ? `In use by ${row.quotationCount} ${
                row.quotationCount === 1 ? "quotation" : "quotations"
              }`
            : undefined
        }
        align={align}
      />
    </RowActions>
  );
}

/** The contact person with their phone and email beneath, or an em dash. */
function Contact({ row }: { row: CustomerListRow }) {
  return (
    <>
      {row.contactPerson ?? "—"}
      {row.contactEmail || row.contactPhone ? (
        <span className="mt-0.5 block text-xs text-gold-100/35">
          {[row.contactPhone, row.contactEmail].filter(Boolean).join(" · ")}
        </span>
      ) : null}
    </>
  );
}

/** The count, linking to the quotations it stands for once there is one. */
function QuoteCount({ row }: { row: CustomerListRow }) {
  if (row.quotationCount === 0) return <>0</>;

  return (
    <Link
      href={`/quotations?${SEARCH_PARAM}=${encodeURIComponent(row.name)}`}
      className="text-gold-300 underline-offset-2 hover:underline"
    >
      {row.quotationCount}
    </Link>
  );
}

export default async function CustomersPage(props: PageProps<"/customers">) {
  await requireSession();

  const term = normalizeSearch((await props.searchParams)[SEARCH_PARAM]);
  const rows = await listCustomers(db, { search: term });

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader>
        <Link
          href="/customers/new"
          className="reydex-submit inline-flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold sm:h-9"
        >
          <LuPlus aria-hidden className="size-4" />
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New customer</span>
        </Link>
      </AppHeader>

      <div className="flex-1 px-5 py-8 sm:px-8 sm:py-10">
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
            <>
              {/* Cards on a phone; the table from `md` up. */}
              <RecordList>
                {rows.map((row) => (
                  <RecordCard
                    key={row.id}
                    title={row.name}
                    href={`/customers/${row.id}/edit`}
                    subtitle={row.addressLine ?? undefined}
                    facts={[
                      {
                        label: "City",
                        value: row.cityProvince ?? "—",
                      },
                      { label: "Contact", value: <Contact row={row} /> },
                      { label: "Quotes", value: <QuoteCount row={row} /> },
                    ]}
                    actions={<Controls row={row} />}
                  />
                ))}
              </RecordList>

              <div className="reydex-card hidden overflow-x-auto rounded-2xl md:block">
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
                          <Contact row={row} />
                        </td>
                        {/*
                         * The quotation count is also what decides whether the row
                         * can be deleted, so it earns a column of its own.
                         */}
                        <td className="px-4 py-3 text-right tabular-nums text-gold-100/55">
                          <QuoteCount row={row} />
                        </td>
                        <td className="px-4 py-3">
                          <Controls row={row} align="end" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
