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

  return (
    <>
      <span className="whitespace-nowrap">
        {ACTION_LABEL[entry.action]} by {actorLabel(entry)}
      </span>
      {/* The exact moment on hover; the cell itself only has room for "2h ago". */}
      <span
        className="mt-0.5 block text-xs text-gold-100/35"
        title={formatTimestamp(entry.occurredAt)}
      >
        {formatRelativeTime(entry.occurredAt, now)}
        {entry.detail ? ` · ${entry.detail}` : ""}
      </span>
    </>
  );
}
