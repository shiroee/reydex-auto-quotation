import type { Metadata } from "next";
import Link from "next/link";
import { LuClipboardCheck, LuPencil, LuPlus } from "react-icons/lu";

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
import { normalizeSearch, SEARCH_PARAM } from "@/lib/quotations/search";
import {
  describeTally,
  formatLongDate,
  tallyChecklist,
} from "@/lib/service-reports/format";
import {
  PANEL_TYPE_LABEL,
  SERVICE_REPORT_KIND_LABEL,
} from "@/lib/service-reports/report";
import {
  listServiceReports,
  type ServiceReportListRow,
} from "@/lib/service-reports/service";

import { deleteServiceReportAction } from "./actions";
import { ServiceReportsSearch } from "./service-reports-search";

export const metadata: Metadata = { title: "Service reports" };

export const dynamic = "force-dynamic";

/** One row's controls, drawn once in the table cell and once in the phone card. */
function Controls({
  row,
  align,
}: {
  row: ServiceReportListRow;
  align?: RowActionsAlign;
}) {
  return (
    <RowActions align={align}>
      <RowAction
        href={`/service-reports/${row.id}/print`}
        icon={LuClipboardCheck}
        tone="primary"
      >
        Open
      </RowAction>
      <RowAction href={`/service-reports/${row.id}/edit`} icon={LuPencil}>
        Edit
      </RowAction>
      {/*
       * Nothing references a report, so there is nothing to block on — but the
       * reference comes from a global sequence, so the number is retired rather
       * than freed, and a report already left with a client cannot be recalled
       * by deleting the row.
       */}
      <DeleteRowButton
        action={deleteServiceReportAction}
        id={row.id}
        name={row.reportNo}
        warning={`${row.reportNo} will not be reused.`}
        align={align}
      />
    </RowActions>
  );
}

/**
 * How the checklist came out, as one cell.
 *
 * Items still to service are called out in red, and unmarked items in amber: the
 * dashboard is the only place either is visible without opening every sheet, and
 * a report handed over with holes in its checklist is worth catching before it
 * goes.
 */
function ChecklistCell({ row }: { row: ServiceReportListRow }) {
  /*
   * A photo report has no checklist, so this column reports what it does have.
   * Showing "13 unmarked" against a document that asks none of the thirteen
   * questions would read as an unfinished report rather than a different one.
   */
  if (row.kind === "photo_report") {
    return (
      <span
        className={row.photoCount === 0 ? "text-amber-300/80" : "text-gold-100/55"}
      >
        {row.photoCount === 0
          ? "No photos"
          : `${row.photoCount} photo${row.photoCount === 1 ? "" : "s"}`}
      </span>
    );
  }

  const tally = tallyChecklist(row.checklist);

  return (
    <span
      className={
        tally.service > 0
          ? "text-red-300"
          : tally.unmarked > 0
            ? "text-amber-300/80"
            : "text-gold-100/55"
      }
    >
      {describeTally(tally)}
    </span>
  );
}

export default async function ServiceReportsPage(
  props: PageProps<"/service-reports">,
) {
  await requireSession();

  const term = normalizeSearch((await props.searchParams)[SEARCH_PARAM]);
  const rows = await listServiceReports(db, { search: term });

  // One lookup for the rows on this page; `now` is fixed so every row is
  // measured against the same instant.
  const activity = await latestActivityFor(
    db,
    "service_report",
    rows.map((row) => row.id),
  );
  const now = new Date();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader>
        <Link
          href="/service-reports/new"
          className="reydex-submit inline-flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold sm:h-9"
        >
          <LuPlus aria-hidden className="size-4" />
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New report</span>
        </Link>
      </AppHeader>

      <div className="flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl">
          <ServiceReportsSearch term={term} />

          {/*
           * `role="status"` on the result line and on the empty card, so a
           * search submitted from the keyboard is announced without focus having
           * to move into the results.
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
                    No service reports match “{term}”.
                  </p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Searches cover the reference number, customer, address,
                    project and system.{" "}
                    <Link
                      href="/service-reports"
                      className="text-gold-300 underline"
                    >
                      Show all reports
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gold-100/70">No service reports yet.</p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Raise one with{" "}
                    <Link
                      href="/service-reports/new"
                      className="text-gold-300 underline"
                    >
                      New report
                    </Link>{" "}
                    after a preventive-maintenance visit — what was serviced, how
                    the panel scored against the thirteen-point checklist, and
                    what needs doing next.
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
                    eyebrow={row.reportNo}
                    title={row.customerName}
                    subtitle={row.projectTitle}
                    facts={[
                      { label: "Address", value: row.address },
                      {
                        label: "Report",
                        value: SERVICE_REPORT_KIND_LABEL[row.kind],
                      },
                      ...(row.kind === "checklist"
                        ? [
                            {
                              label: "Panel",
                              value: PANEL_TYPE_LABEL[row.panelType],
                            },
                          ]
                        : []),
                      {
                        label: row.kind === "photo_report" ? "Photos" : "Checklist",
                        value: <ChecklistCell row={row} />,
                      },
                      {
                        label: "Recommendations",
                        value: row.recommendations.length || "None",
                      },
                      {
                        label: "Serviced",
                        value: formatLongDate(row.serviceDate),
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
                       * The service date sits under the reference rather than in
                       * a column of its own — the pairing the other two listings
                       * make, for the same reason: they are read together.
                       */}
                      <th className="px-4 py-3 font-medium">
                        Ref. No. / serviced
                      </th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Project</th>
                      <th className="px-4 py-3 font-medium">Report</th>
                      {/* One column, two meanings — see `ChecklistCell`. */}
                      <th className="px-4 py-3 font-medium">Checklist / photos</th>
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
                          {row.reportNo}
                          <span className="mt-0.5 block font-sans text-gold-100/50">
                            {formatLongDate(row.serviceDate)}
                          </span>
                        </td>
                        {/*
                         * Clamped like the project beside it: one long customer
                         * name would otherwise stretch the table past the card.
                         * The phone card prints both in full instead.
                         */}
                        <td className="px-4 py-3 text-gold-100/85">
                          <span
                            className="block max-w-48 truncate"
                            title={row.customerName}
                          >
                            {row.customerName}
                          </span>
                          <span
                            className="block max-w-48 truncate text-xs text-gold-100/35"
                            title={row.address}
                          >
                            {row.address}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gold-100/70">
                          <span
                            className="block max-w-56 truncate"
                            title={row.projectTitle}
                          >
                            {row.projectTitle}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gold-100/55">
                          {SERVICE_REPORT_KIND_LABEL[row.kind]}
                          {row.kind === "checklist" ? (
                            <span className="mt-0.5 block text-xs text-gold-100/35">
                              {PANEL_TYPE_LABEL[row.panelType]}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ChecklistCell row={row} />
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
