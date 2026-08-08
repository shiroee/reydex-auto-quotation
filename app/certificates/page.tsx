import type { Metadata } from "next";
import Link from "next/link";
import { LuAward, LuPencil, LuPlus } from "react-icons/lu";

import { AppHeader } from "@/components/app-header";
import { DeleteRowButton } from "@/components/delete-row-button";
import { LastChange } from "@/components/last-change";
import { RecordCard, RecordList } from "@/components/record-list";
import {
  RowAction,
  RowActions,
  type RowActionsAlign,
} from "@/components/row-actions";
import { db } from "@/db";
import { latestActivityFor } from "@/lib/activity/service";
import { requireSession } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/certificates/format";
import {
  listCertificates,
  type CertificateListRow,
} from "@/lib/certificates/service";
import { normalizeSearch, SEARCH_PARAM } from "@/lib/quotations/search";

import { deleteCertificateAction } from "./actions";
import { CertificatesSearch } from "./certificates-search";

export const metadata: Metadata = { title: "Certificates" };

export const dynamic = "force-dynamic";

/** One row's controls, drawn once in the table cell and once in the phone card. */
function Controls({
  row,
  align,
}: {
  row: CertificateListRow;
  align?: RowActionsAlign;
}) {
  return (
    <RowActions align={align}>
      <RowAction
        href={`/certificates/${row.id}/print`}
        icon={LuAward}
        tone="primary"
      >
        Open
      </RowAction>
      <RowAction href={`/certificates/${row.id}/edit`} icon={LuPencil}>
        Edit
      </RowAction>
      {/*
       * Nothing references a certificate, so there is nothing to block on — but
       * the reference comes from a global sequence, so the number is retired
       * rather than freed, and a certificate already handed to a client cannot
       * be recalled by deleting the row.
       */}
      <DeleteRowButton
        action={deleteCertificateAction}
        id={row.id}
        name={row.certNo}
        warning={`${row.certNo} will not be reused.`}
        align={align}
      />
    </RowActions>
  );
}

export default async function CertificatesPage(
  props: PageProps<"/certificates">,
) {
  await requireSession();

  const term = normalizeSearch((await props.searchParams)[SEARCH_PARAM]);
  const rows = await listCertificates(db, { search: term });

  // One lookup for the rows on this page; `now` is fixed so every row is
  // measured against the same instant.
  const activity = await latestActivityFor(
    db,
    "certificate",
    rows.map((row) => row.id),
  );
  const now = new Date();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader>
        <Link
          href="/certificates/new"
          className="reydex-submit inline-flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold sm:h-9"
        >
          <LuPlus aria-hidden className="size-4" />
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New certificate</span>
        </Link>
      </AppHeader>

      <div className="flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl">
          <CertificatesSearch term={term} />

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
                    No certificates match “{term}”.
                  </p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Searches cover the reference number, client, project and
                    location.{" "}
                    <Link
                      href="/certificates"
                      className="text-gold-300 underline"
                    >
                      Show all certificates
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gold-100/70">
                    No certificates of completion yet.
                  </p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Issue one with{" "}
                    <Link
                      href="/certificates/new"
                      className="text-gold-300 underline"
                    >
                      New certificate
                    </Link>{" "}
                    once a job has been finished and signed off.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Cards on a phone and a small laptop; the table from `lg` up. */}
              <RecordList>
                {rows.map((row) => (
                  <RecordCard
                    key={row.id}
                    eyebrow={row.certNo}
                    title={row.clientName}
                    subtitle={row.projectTitle}
                    facts={[
                      { label: "Location", value: row.location },
                      {
                        label: "Completed",
                        value: formatLongDate(row.completionDate),
                      },
                      {
                        label: "Issued",
                        value: formatLongDate(row.issueDate),
                        strong: true,
                      },
                      {
                        label: "Change",
                        value: (
                          <LastChange
                            entry={activity.get(row.id) ?? null}
                            now={now}
                          />
                        ),
                      },
                    ]}
                    actions={<Controls row={row} />}
                  />
                ))}
              </RecordList>

              {/*
               * `overflow-x-auto` is the backstop, not the plan: the columns are
               * bounded to fit inside `max-w-7xl`, and this keeps a narrower
               * window scrolling the table rather than clipping the column the
               * row controls sit in.
               */}
              <div className="reydex-card hidden overflow-x-auto rounded-2xl lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gold-500/15 text-xs uppercase tracking-wider text-gold-100/45">
                    <tr>
                      {/*
                       * The issue date sits under the reference rather than in a
                       * column of its own — the pairing the quotations table
                       * makes, for the same reason: they are read together.
                       */}
                      <th className="px-4 py-3 font-medium">
                        Ref. No. / issued
                      </th>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium">Project</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium">Completed</th>
                      <th className="px-4 py-3 font-medium">Last change</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gold-500/8 last:border-0"
                      >
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gold-200">
                          {row.certNo}
                          <span className="mt-0.5 block text-gold-100/35">
                            {formatLongDate(row.issueDate)}
                          </span>
                        </td>
                        {/*
                         * Clamped like the project beside it: one long client
                         * name would otherwise stretch the table past the card.
                         * The phone card prints both in full instead.
                         */}
                        <td className="px-4 py-3 text-gold-100/85">
                          <span
                            className="block max-w-48 truncate"
                            title={row.clientName}
                          >
                            {row.clientName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gold-100/70">
                          <span
                            className="block max-w-48 truncate"
                            title={row.projectTitle}
                          >
                            {row.projectTitle}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gold-100/55">
                          <span
                            className="block max-w-40 truncate"
                            title={row.location}
                          >
                            {row.location}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gold-100/55">
                          {formatLongDate(row.completionDate)}
                        </td>
                        <td className="px-4 py-3 text-gold-100/55">
                          <LastChange
                            entry={activity.get(row.id) ?? null}
                            now={now}
                          />
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
