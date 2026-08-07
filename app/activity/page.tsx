import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { db } from "@/db";
import {
  ACTION_LABEL,
  actorLabel,
  ENTITY,
  ENTITY_LABEL,
  ENTITY_PARAM,
  ENTITY_PLURAL,
  entityHref,
  formatRelativeTime,
  formatTimestamp,
  isActivityEntityName,
  type ActivityAction,
} from "@/lib/activity/format";
import { listActivity, type ActivityRow } from "@/lib/activity/service";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Activity" };

export const dynamic = "force-dynamic";

/**
 * Colour carries the verb, since it is the column the eye lands on: a deletion
 * is the one entry worth spotting from across the table.
 */
const ACTION_CLASS: Record<ActivityAction, string> = {
  create: "bg-gold-500/12 text-gold-200",
  update: "bg-gold-100/8 text-gold-100/60",
  delete: "bg-red-500/12 text-red-200/80",
};

function ActionBadge({ action }: { action: ActivityAction }) {
  return (
    <span
      className={`inline-block rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${ACTION_CLASS[action]}`}
    >
      {ACTION_LABEL[action]}
    </span>
  );
}

/** The record's name, linked when there is still something to open. */
function RecordLabel({ row }: { row: ActivityRow }) {
  const href = entityHref(row.entity, row.entityId, row.action);

  return (
    <>
      {/* Bounded, with the full text on hover — as the dashboards' tables are. */}
      {href ? (
        <Link
          href={href}
          title={row.label}
          className="block max-w-72 truncate underline-offset-2 hover:text-gold-100 hover:underline"
        >
          {row.label}
        </Link>
      ) : (
        // Deleted: the name is all that is left of it.
        <span
          className="block max-w-72 truncate line-through decoration-red-300/40"
          title={row.label}
        >
          {row.label}
        </span>
      )}
      {row.detail ? (
        <span
          className="mt-0.5 block max-w-72 truncate text-xs text-gold-100/35"
          title={row.detail}
        >
          {row.detail}
        </span>
      ) : null}
    </>
  );
}

/** Tabs across the entities, as links so the filter is shareable and back works. */
function Filter({ current }: { current: string | null }) {
  const tab = (href: string, label: string, isCurrent: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={
        isCurrent
          ? "inline-flex h-9 items-center rounded-lg bg-gold-500/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold-200 sm:h-8"
          : "inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium uppercase tracking-[0.12em] text-gold-100/50 transition-colors hover:bg-gold-500/6 hover:text-gold-100 sm:h-8"
      }
    >
      {label}
    </Link>
  );

  return (
    <nav aria-label="Filter by record" className="mb-5 min-w-0">
      {/* Scrolls rather than wraps on a phone, like the main navigation rail. */}
      <div className="reydex-rail flex snap-x snap-mandatory items-center gap-1 overflow-x-auto">
        {tab("/activity", "All", current === null)}
        {ENTITY.map((entity) =>
          tab(
            `/activity?${ENTITY_PARAM}=${entity}`,
            ENTITY_PLURAL[entity],
            current === entity,
          ),
        )}
      </div>
    </nav>
  );
}

export default async function ActivityPage(props: PageProps<"/activity">) {
  await requireSession();

  const raw = (await props.searchParams)[ENTITY_PARAM];
  const first = Array.isArray(raw) ? raw[0] : raw;
  // Anything unrecognised lists everything, rather than 404ing on a stale link.
  const entity = isActivityEntityName(first) ? first : null;

  const rows = await listActivity(db, { entity: entity ?? undefined });
  const now = new Date();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl">
          <h1 className="mb-1 text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
            Activity
          </h1>
          <p className="mb-5 text-xs text-gold-100/45">
            Who added, edited or deleted each record. Deleted records appear only
            here — the dashboards list what still exists.
          </p>

          <Filter current={entity} />

          {rows.length === 0 ? (
            <div className="reydex-card rounded-2xl p-8 text-center" role="status">
              <p className="text-gold-100/70">
                {entity
                  ? `No changes recorded for ${ENTITY_PLURAL[entity].toLowerCase()} yet.`
                  : "No changes recorded yet."}
              </p>
              <p className="mt-2 text-sm text-gold-100/40">
                Every add, edit and delete from now on is listed here. Records
                that already existed carry no history.
              </p>
            </div>
          ) : (
            <>
              {/* Cards below `lg`; the table above it — as the dashboards do. */}
              <ul className="flex flex-col gap-3 lg:hidden">
                {rows.map((row) => (
                  <li key={row.id} className="reydex-card rounded-2xl p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <ActionBadge action={row.action} />
                      <span className="text-xs uppercase tracking-wider text-gold-100/40">
                        {ENTITY_LABEL[row.entity]}
                      </span>
                    </div>
                    <p className="mt-2 text-[0.95rem] font-semibold leading-snug text-gold-100/90">
                      <RecordLabel row={row} />
                    </p>
                    <p className="mt-2 text-sm text-gold-100/60">
                      {actorLabel(row)}
                      <span
                        className="mt-0.5 block text-xs text-gold-100/35"
                        title={formatTimestamp(row.occurredAt)}
                      >
                        {formatRelativeTime(row.occurredAt, now)}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>

              <div className="reydex-card hidden overflow-x-auto rounded-2xl lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gold-500/15 text-xs uppercase tracking-wider text-gold-100/45">
                    <tr>
                      <th className="px-4 py-3 font-medium">When</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Record</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gold-500/8 last:border-0"
                      >
                        <td
                          className="px-4 py-3 whitespace-nowrap text-gold-100/55"
                          title={formatTimestamp(row.occurredAt)}
                        >
                          {formatRelativeTime(row.occurredAt, now)}
                        </td>
                        <td className="px-4 py-3">
                          <ActionBadge action={row.action} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gold-100/55">
                          {ENTITY_LABEL[row.entity]}
                        </td>
                        <td className="px-4 py-3 text-gold-100/85">
                          <RecordLabel row={row} />
                        </td>
                        <td className="px-4 py-3 text-gold-100/55">
                          {actorLabel(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/*
               * The list is capped, so say so rather than letting the last row
               * read as the beginning of time.
               */}
              {rows.length >= 100 ? (
                <p className="mt-3 text-xs text-gold-100/35">
                  Showing the {rows.length} most recent changes.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
