import type { Metadata } from "next";
import Link from "next/link";
import { LuCopy, LuFileText, LuPencil, LuPlus } from "react-icons/lu";

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
import { formatPeso } from "@/lib/quotations/money";
import { normalizeSearch, SEARCH_PARAM } from "@/lib/quotations/search";
import { listQuotations, type QuotationListRow } from "@/lib/quotations/service";

import { deleteQuotationAction } from "./actions";
import { QuotationsSearch } from "./quotations-search";

export const metadata: Metadata = { title: "Quotations" };

export const dynamic = "force-dynamic";

const TEMPLATE_LABEL: Record<string, string> = {
  supply: "Supply",
  service_proposal: "Service proposal",
};

/** One row's controls, drawn once in the table cell and once in the phone card. */
function Controls({
  row,
  align,
}: {
  row: QuotationListRow;
  align?: RowActionsAlign;
}) {
  return (
    <RowActions align={align}>
      <RowAction
        href={`/quotations/${row.id}/print`}
        icon={LuFileText}
        tone="primary"
      >
        Open
      </RowAction>
      <RowAction href={`/quotations/${row.id}/edit`} icon={LuPencil}>
        Edit
      </RowAction>
      {/*
       * Copying and re-dating both live on one page rather than as inline row
       * controls: they are easy to confuse — one makes a new document, the other
       * rewrites a sent one — and the page has room to say which is which.
       */}
      <RowAction href={`/quotations/${row.id}/reissue`} icon={LuCopy}>
        Copy / date
      </RowAction>
      {/*
       * Nothing references a quotation and its lines cascade, so there is
       * nothing to block — but the reference comes from a global sequence, so the
       * number is retired rather than freed.
       */}
      <DeleteRowButton
        action={deleteQuotationAction}
        id={row.id}
        name={row.quoteNo}
        warning={`${row.quoteNo} will not be reused.`}
        align={align}
      />
    </RowActions>
  );
}

export default async function QuotationsPage(props: PageProps<"/quotations">) {
  await requireSession();

  const term = normalizeSearch((await props.searchParams)[SEARCH_PARAM]);
  const rows = await listQuotations(db, { search: term });

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader>
        <Link
          href="/quotations/new"
          className="reydex-submit inline-flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold sm:h-9"
        >
          <LuPlus aria-hidden className="size-4" />
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New quotation</span>
        </Link>
      </AppHeader>

      <div className="flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-5xl">
          <QuotationsSearch term={term} />

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
                    No quotations match “{term}”.
                  </p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Searches cover the reference number, customer name and
                    subject.{" "}
                    <Link href="/quotations" className="text-gold-300 underline">
                      Show all quotations
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gold-100/70">No quotations yet.</p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Create one with{" "}
                    <Link
                      href="/quotations/new"
                      className="text-gold-300 underline"
                    >
                      New quotation
                    </Link>
                    , or run{" "}
                    <code className="text-gold-300">
                      npm run db:seed-samples
                    </code>{" "}
                    to load the three samples.
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
                    eyebrow={row.quoteNo}
                    title={row.customerName}
                    subtitle={row.subject}
                    facts={[
                      {
                        label: "Type",
                        value: TEMPLATE_LABEL[row.template] ?? row.template,
                      },
                      { label: "Date", value: row.quoteDate },
                      {
                        label: "Total",
                        value: formatPeso(row.totalAmount),
                        strong: true,
                      },
                    ]}
                    actions={<Controls row={row} />}
                  />
                ))}
              </RecordList>

              {/*
               * `overflow-x-auto` rather than `hidden`: seven columns still run
               * out of room somewhere above `md`, and scrolling the table is
               * better than clipping the column the row controls sit in.
               */}
              <div className="reydex-card hidden overflow-x-auto rounded-2xl md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gold-500/15 text-xs uppercase tracking-wider text-gold-100/45">
                    <tr>
                      <th className="px-4 py-3 font-medium">Ref. No.</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Subject</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gold-500/8 last:border-0"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gold-200">
                          {row.quoteNo}
                        </td>
                        <td className="px-4 py-3 text-gold-100/85">
                          {row.customerName}
                        </td>
                        {/*
                         * Subjects run to a full sentence, so the cell is clamped
                         * and the whole line kept in `title` — otherwise one long
                         * subject stretches the table past the card. The phone
                         * card prints it in full instead.
                         */}
                        <td className="px-4 py-3 text-gold-100/70">
                          <span
                            className="block max-w-[16rem] truncate"
                            title={row.subject}
                          >
                            {row.subject}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gold-100/55">
                          {TEMPLATE_LABEL[row.template] ?? row.template}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gold-100/55">
                          {row.quoteDate}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-gold-100/85">
                          {formatPeso(row.totalAmount)}
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
