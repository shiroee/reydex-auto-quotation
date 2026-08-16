import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import {
  companyProfile,
  serviceReportPhotos,
  serviceReportPlates,
  serviceReports,
} from "@/db/schema";
import { normalizeSearch, toContainsPattern } from "@/lib/quotations/search";

import type { PlateInput, ServiceReportInput } from "./form";
import {
  isSafePhotoSrc,
  normalizeChecklist,
  normalizeEquipment,
  normalizeLines,
  normalizeRecommendations,
} from "./report";

/**
 * Reading and writing FDAS service reports.
 *
 * As in `lib/quotations/service.ts`, the database handle is passed in rather
 * than imported so these functions can also be driven from `scripts/` and from
 * tests — `@/db` pulls in `server-only`, which throws outside a server component.
 */
export type ServiceReportDb = NodePgDatabase<typeof schema>;

type Tx = Parameters<Parameters<ServiceReportDb["transaction"]>[0]>[0];

/**
 * Reference in the form RDX-SR-2026-0001.
 *
 * A third series alongside the quotation's RDX-2026-0001 and the certificates'
 * RDX-COC / RDX-CSR, for the reason set out in `lib/certificates/service.ts`:
 * all of them get quoted in emails and filed in the same folder, so the letters
 * have to say which document is which before it is opened.
 *
 * Drawn from a Postgres sequence rather than `max(report_no) + 1` so two people
 * saving at once cannot land on the same number. The sequence is global rather
 * than per-year, so the counter does not restart each January — a deleted report
 * therefore leaves a gap, which is the intended behaviour: a reference that has
 * been printed and handed over is never reused.
 */
async function nextServiceReportNo(tx: Tx, year: number): Promise<string> {
  const result = await tx.execute<{ n: string }>(
    sql`SELECT nextval('service_report_no_seq')::text AS n`,
  );

  return `RDX-SR-${year}-${String(result.rows[0].n).padStart(4, "0")}`;
}

/**
 * Rewrites a report's plates from a submission.
 *
 * Deletes every plate and re-inserts rather than diffing. Now that a photograph
 * is a path rather than a blob, this is genuinely cheap — no image data moves —
 * and it sidesteps the reordering cases a positional patch would have to get
 * right. The files under `public/` are untouched either way: this rewrites which
 * paths the report points at, not what is on disk.
 *
 * Runs inside the caller's transaction, so a failure part-way leaves the
 * report's previous plates untouched.
 */
async function writePlates(
  tx: Tx,
  reportId: string,
  plates: PlateInput[],
): Promise<void> {
  // Cascades to the photograph rows.
  await tx
    .delete(serviceReportPlates)
    .where(eq(serviceReportPlates.reportId, reportId));

  for (const [index, plate] of plates.entries()) {
    const [row] = await tx
      .insert(serviceReportPlates)
      .values({ reportId, position: index, caption: plate.caption })
      .returning({ id: serviceReportPlates.id });

    // Filtered again here rather than trusting the caller: this is also reached
    // from `scripts/`, which does not go through the form's parser.
    const photos = plate.photos.filter(isSafePhotoSrc);

    if (photos.length === 0) continue;

    await tx.insert(serviceReportPhotos).values(
      photos.map((src, position) => ({ plateId: row.id, position, src })),
    );
  }
}

export type ListServiceReportsOptions = {
  /**
   * Free text matched case-insensitively against the reference, customer,
   * address, project and system. Blank or omitted lists everything.
   */
  search?: string;
  limit?: number;
};

/** Newest service date first — the order a visit is looked up in. */
export async function listServiceReports(
  db: ServiceReportDb,
  { search, limit = 100 }: ListServiceReportsOptions = {},
) {
  const term = normalizeSearch(search);
  const pattern = toContainsPattern(term);

  const rows = await db
    .select({
      id: serviceReports.id,
      reportNo: serviceReports.reportNo,
      kind: serviceReports.kind,
      customerName: serviceReports.customerName,
      address: serviceReports.address,
      projectTitle: serviceReports.projectTitle,
      serviceDate: serviceReports.serviceDate,
      panelType: serviceReports.panelType,
      checklist: serviceReports.checklist,
      recommendations: serviceReports.recommendations,
      /*
       * A count, never the rows: a listing of a hundred reports must not pull
       * their photographs across the wire. See the note on the photos table.
       *
       * Written as literal SQL rather than interpolated from the schema objects.
       * Drizzle renders a `${column}` inside a `sql` fragment *unqualified*, so
       * the interpolated form came out as `ON "plate_id" = "id"` — three
       * ambiguous references and a correlated subquery that did not correlate.
       * Nothing here is caller-controlled, so there is no injection surface;
       * the aliases are what keep it unambiguous against the outer query.
       */
      photoCount: sql<number>`(
        SELECT count(*)::int
        FROM service_report_photos AS ph
        JOIN service_report_plates AS pl ON ph.plate_id = pl.id
        WHERE pl.report_id = service_reports.id
      )`,
    })
    .from(serviceReports)
    // `undefined` rather than a tautology, so the unfiltered query is unchanged.
    .where(
      term
        ? or(
            ilike(serviceReports.reportNo, pattern),
            ilike(serviceReports.customerName, pattern),
            ilike(serviceReports.address, pattern),
            ilike(serviceReports.projectTitle, pattern),
            ilike(serviceReports.systemDescription, pattern),
          )
        : undefined,
    )
    .orderBy(desc(serviceReports.serviceDate), desc(serviceReports.createdAt))
    .limit(limit);

  // The two `jsonb` columns are shaped by whatever last wrote them; the list
  // counts them, so it normalises rather than trusting the column's type.
  return rows.map((row) => ({
    ...row,
    checklist: normalizeChecklist(row.checklist),
    recommendations: normalizeRecommendations(row.recommendations),
  }));
}

export type ServiceReportListRow = Awaited<
  ReturnType<typeof listServiceReports>
>[number];

/**
 * One report, with its `jsonb` body read back defensively and its photo plates
 * attached — captions and photo *ids*, never the bytes. The printed sheet and
 * the editor both reference each photograph by URL, so the images travel to the
 * browser through the photo route and its cache rather than inside the page.
 */
export async function getServiceReport(db: ServiceReportDb, id: string) {
  const [row] = await db
    .select()
    .from(serviceReports)
    .where(eq(serviceReports.id, id))
    .limit(1);

  if (!row) return null;

  const plateRows = await db
    .select({
      id: serviceReportPlates.id,
      caption: serviceReportPlates.caption,
      src: serviceReportPhotos.src,
    })
    .from(serviceReportPlates)
    .leftJoin(
      serviceReportPhotos,
      eq(serviceReportPhotos.plateId, serviceReportPlates.id),
    )
    .where(eq(serviceReportPlates.reportId, id))
    .orderBy(asc(serviceReportPlates.position), asc(serviceReportPhotos.position));

  // Flattened by the join; folded back into plates in one pass, which the
  // ordering above makes safe.
  const plates: { id: string; caption: string; photos: string[] }[] = [];

  for (const plateRow of plateRows) {
    const last = plates.at(-1);
    const plate =
      last?.id === plateRow.id
        ? last
        : (plates.push({
            id: plateRow.id,
            caption: plateRow.caption,
            photos: [],
          }),
          plates[plates.length - 1]);

    /*
     * Null for a plate whose photographs have all gone — the left join's row.
     * Re-checked rather than trusted: this value goes straight into an
     * `<img src>`, and the row may predate the check or have been written by
     * hand. See `isSafePhotoSrc`.
     */
    if (isSafePhotoSrc(plateRow.src)) plate.photos.push(plateRow.src);
  }

  return {
    ...row,
    equipment: normalizeEquipment(row.equipment),
    checklist: normalizeChecklist(row.checklist),
    lines: normalizeLines(row.lines),
    recommendations: normalizeRecommendations(row.recommendations),
    findings: normalizeRecommendations(row.findings),
    activities: normalizeRecommendations(row.activities),
    plates,
  };
}

export type ServiceReportPlateView = ServiceReportRecord["plates"][number];

export type ServiceReportRecord = NonNullable<
  Awaited<ReturnType<typeof getServiceReport>>
>;

/**
 * The report and the letterhead it prints under.
 *
 * The profile is fetched here rather than in the page for the same reason
 * `getCertificateForPrint` does it: the printable route should make one call and
 * render, so there is one place that knows what a printed document needs.
 */
export async function getServiceReportForPrint(
  db: ServiceReportDb,
  id: string,
) {
  const report = await getServiceReport(db, id);

  if (!report) return null;

  const [profile] = await db
    .select()
    .from(companyProfile)
    .where(eq(companyProfile.slug, "reydex"))
    .limit(1);

  return { report, profile };
}

export type PrintableServiceReport = NonNullable<
  Awaited<ReturnType<typeof getServiceReportForPrint>>
>;

/**
 * Raises a report, allocating its reference from the sequence.
 *
 * In a transaction so a failed insert does not strand a consumed number — the
 * sequence itself is non-transactional, but keeping the two together means the
 * only gaps are from deletions rather than from failed saves as well.
 */
export async function createServiceReport(
  db: ServiceReportDb,
  input: ServiceReportInput,
  preparedByUserId?: string | null,
): Promise<{ id: string; reportNo: string }> {
  return db.transaction(async (tx) => {
    // Numbered by the year of the visit, which is the date printed on it.
    const reportNo = await nextServiceReportNo(
      tx,
      Number(input.serviceDate.slice(0, 4)),
    );

    // `plates` is not a column; it becomes rows in the two tables below.
    const { plates, ...columns } = input;

    const [row] = await tx
      .insert(serviceReports)
      .values({
        ...columns,
        reportNo,
        preparedByUserId: preparedByUserId ?? null,
      })
      .returning({ id: serviceReports.id });

    if (plates.length > 0) await writePlates(tx, row.id, plates);

    return { id: row.id, reportNo };
  });
}

/**
 * Applies an edit. Returns null when the row is gone — deleted in another tab
 * between loading the form and submitting it — so the caller can say so rather
 * than reporting a silent success.
 *
 * The reference is never rewritten, even when the service date moves to another
 * year: it is the identifier on a document that has already been handed over.
 *
 * The columns are listed out rather than spread, so that what an edit is allowed
 * to change is readable in one place — and so a column added later is written
 * here on purpose rather than by default. Add new editable columns to the list.
 */
export async function updateServiceReport(
  db: ServiceReportDb,
  id: string,
  input: ServiceReportInput,
): Promise<{ reportNo: string } | null> {
  // In a transaction because the plates are rewritten alongside the row: a
  // failure between the two would leave a checklist report holding photographs.
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(serviceReports)
      .set({
        kind: input.kind,
        customerName: input.customerName,
        address: input.address,
        projectTitle: input.projectTitle,
        systemDescription: input.systemDescription,
        serviceDate: input.serviceDate,
        panelType: input.panelType,
        equipment: input.equipment,
        otherEquipment: input.otherEquipment,
        checklist: input.checklist,
        lines: input.lines,
        findings: input.findings,
        activities: input.activities,
        recommendations: input.recommendations,
        servicedByName: input.servicedByName,
        servicedByTitle: input.servicedByTitle,
        notedByName: input.notedByName,
        updatedAt: sql`now()`,
      })
      .where(eq(serviceReports.id, id))
      .returning({ reportNo: serviceReports.reportNo });

    if (updated.length === 0) return null;

    // Unconditional: switching a report to the checklist kind submits no plates,
    // and that has to clear the ones it had rather than strand them.
    await writePlates(tx, id, input.plates);

    return { reportNo: updated[0].reportNo };
  });
}

export type DeleteServiceReportResult =
  | { ok: true; reportNo: string }
  | { ok: false; reason: "not_found" };

/**
 * Deletes a report.
 *
 * Nothing references one, so unlike a customer there is nothing to block on.
 * What the caller should warn about instead is that the reference is retired
 * rather than freed — see `nextServiceReportNo`.
 */
export async function deleteServiceReport(
  db: ServiceReportDb,
  id: string,
): Promise<DeleteServiceReportResult> {
  const deleted = await db
    .delete(serviceReports)
    .where(eq(serviceReports.id, id))
    .returning({ reportNo: serviceReports.reportNo });

  if (deleted.length === 0) return { ok: false, reason: "not_found" };

  return { ok: true, reportNo: deleted[0].reportNo };
}
