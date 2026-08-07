import { and, desc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { activityLog } from "@/db/schema";

import type { ActivityAction, ActivityEntityName } from "./format";

/**
 * Reading and writing the activity log — who added, edited or deleted each
 * record.
 *
 * As with the other services the database handle is passed in rather than
 * imported, so this can also be driven from `scripts/` and from tests.
 */
export type ActivityDb = NodePgDatabase<typeof schema>;

/** Whoever is performing the action, taken from the session. */
export type Actor = {
  id: string;
  name?: string | null;
  email?: string | null;
};

/**
 * The actor for a signed-in session.
 *
 * A helper rather than three properties written out in every action — twelve
 * call sites is twelve chances to forget the email and leave history naming
 * "System".
 */
export function toActor(session: {
  user: { id: string; name?: string | null; email?: string | null };
}): Actor {
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
  };
}

export type RecordActivityInput = {
  action: ActivityAction;
  entity: ActivityEntityName;
  entityId: string;
  /** What the record is called, captured now so a deletion stays readable. */
  label: string;
  /** For anything a bare verb does not convey: "disabled", "re-dated to …". */
  detail?: string | null;
  /** Null for work done by a script, which has no session. */
  actor?: Actor | null;
};

/**
 * Appends one entry.
 *
 * **Never throws.** The log is a record of work, not the work itself: if writing
 * it fails, the customer that was just saved is still saved, and turning that
 * into an error the user sees — or worse, rolling the save back — would be a
 * far worse outcome than a missing line of history. Failures go to the server
 * log instead.
 *
 * For the same reason this is deliberately *not* enrolled in the caller's
 * transaction. A quotation is written in one interactive transaction; wiring the
 * log into it would mean a logging bug could abort a saved quotation.
 */
export async function recordActivity(
  db: ActivityDb,
  input: RecordActivityInput,
): Promise<void> {
  try {
    await db.insert(activityLog).values({
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      label: input.label,
      detail: input.detail ?? null,
      actorUserId: input.actor?.id ?? null,
      // Snapshots: the account may be deleted long before this entry is read.
      actorName: input.actor?.name ?? null,
      actorEmail: input.actor?.email ?? null,
    });
  } catch (cause) {
    console.error(
      `[activity] could not log ${input.action} of ${input.entity}`,
      cause,
    );
  }
}

/** The last thing that happened to one record, as a dashboard shows it. */
export type LatestActivity = {
  action: ActivityAction;
  occurredAt: Date;
  detail: string | null;
  actorName: string | null;
  actorEmail: string | null;
};

/**
 * The most recent entry for each of the given records, keyed by id.
 *
 * `DISTINCT ON` rather than a max/group-by, because the actor is wanted from the
 * same row as the timestamp — a plain `max(occurred_at)` would have to be joined
 * back to find out who it belonged to. Postgres requires the distinct expression
 * to lead the ordering, which is why `entityId` comes first.
 *
 * Scoped to the ids actually on the page: a dashboard shows at most a hundred
 * rows, and the log grows without bound.
 */
export async function latestActivityFor(
  db: ActivityDb,
  entity: ActivityEntityName,
  entityIds: string[],
): Promise<Map<string, LatestActivity>> {
  // `inArray` with an empty list is not valid SQL, and there is nothing to ask.
  if (entityIds.length === 0) return new Map();

  const rows = await db
    .selectDistinctOn([activityLog.entityId], {
      entityId: activityLog.entityId,
      action: activityLog.action,
      occurredAt: activityLog.occurredAt,
      detail: activityLog.detail,
      actorName: activityLog.actorName,
      actorEmail: activityLog.actorEmail,
    })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.entity, entity),
        inArray(activityLog.entityId, entityIds),
      ),
    )
    .orderBy(activityLog.entityId, desc(activityLog.occurredAt));

  return new Map(
    rows.map((row) => [
      row.entityId,
      {
        action: row.action,
        occurredAt: row.occurredAt,
        detail: row.detail,
        actorName: row.actorName,
        actorEmail: row.actorEmail,
      },
    ]),
  );
}

export type ActivityRow = {
  id: string;
  occurredAt: Date;
  action: ActivityAction;
  entity: ActivityEntityName;
  entityId: string;
  label: string;
  detail: string | null;
  actorName: string | null;
  actorEmail: string | null;
};

export type ListActivityOptions = {
  /** Narrows to one kind of record; omitted lists everything. */
  entity?: ActivityEntityName;
  limit?: number;
};

/** Newest first, for the activity page. */
export async function listActivity(
  db: ActivityDb,
  { entity, limit = 100 }: ListActivityOptions = {},
): Promise<ActivityRow[]> {
  return db
    .select({
      id: activityLog.id,
      occurredAt: activityLog.occurredAt,
      action: activityLog.action,
      entity: activityLog.entity,
      entityId: activityLog.entityId,
      label: activityLog.label,
      detail: activityLog.detail,
      actorName: activityLog.actorName,
      actorEmail: activityLog.actorEmail,
    })
    .from(activityLog)
    // `undefined` rather than a tautology, so the unfiltered query is unchanged.
    .where(entity ? eq(activityLog.entity, entity) : undefined)
    .orderBy(desc(activityLog.occurredAt))
    .limit(limit);
}
