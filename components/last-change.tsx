import {
  ACTION_LABEL,
  actorLabel,
  formatRelativeTime,
  formatTimestamp,
  type ActivityAction,
} from "@/lib/activity/format";

/**
 * Who last touched a record, for the listing dashboards.
 *
 * The five dashboards all show the same thing in the same shape, so the wording
 * and the tooltip live here rather than being written out five times.
 *
 * Deliberately bounded and wrappable. This is the last column of an already wide
 * table, and it is supplementary — a name set in `whitespace-nowrap` here made
 * the column demand whatever the longest name needed, pushed the table past its
 * container, and spilled over the neighbouring cell. So the name and the summary
 * each truncate inside a fixed maximum, with the full text on hover.
 *
 * `null` covers records that predate the activity log — every row already in the
 * database when it was added has no history, and an em dash is the honest answer
 * rather than attributing them to whoever happens to be reading.
 */
export function LastChange({
  entry,
  now,
}: {
  entry: {
    action: ActivityAction;
    occurredAt: Date;
    detail?: string | null;
    actorName?: string | null;
    actorEmail?: string | null;
  } | null;
  /**
   * Passed in rather than read here, so every row on a page is measured against
   * the same instant — and so the value comes from the render, not from a
   * component that would otherwise re-read the clock per row.
   */
  now: Date;
}) {
  if (!entry) return <span className="text-gold-100/30">—</span>;

  const who = actorLabel(entry);
  const when = formatRelativeTime(entry.occurredAt, now);
  const summary =
    `${ACTION_LABEL[entry.action]} · ${when}` +
    (entry.detail ? ` · ${entry.detail}` : "");

  return (
    <span className="block max-w-48">
      <span className="block truncate" title={who}>
        {who}
      </span>
      {/* The verb, the age and any detail on one quiet line; full text on hover. */}
      <span
        className="mt-0.5 block truncate text-xs text-gold-100/35"
        title={`${summary} — ${formatTimestamp(entry.occurredAt)}`}
      >
        {summary}
      </span>
    </span>
  );
}
