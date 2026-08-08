import { desc, eq, ilike, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { certificates, companyProfile } from "@/db/schema";
import { normalizeSearch, toContainsPattern } from "@/lib/quotations/search";

import type { CertificateInput } from "./form";

/**
 * Reading and writing certificates of completion.
 *
 * As in `lib/quotations/service.ts`, the database handle is passed in rather
 * than imported so these functions can also be driven from `scripts/` and from
 * tests — `@/db` pulls in `server-only`, which throws outside a server component.
 */
export type CertificateDb = NodePgDatabase<typeof schema>;

type Tx = Parameters<Parameters<CertificateDb["transaction"]>[0]>[0];

/**
 * Reference in the form RDX-COC-2026-0001.
 *
 * `COC` sets it apart from a quotation's RDX-2026-0001 at a glance, which
 * matters because both get quoted in emails and filed in the same folder.
 *
 * Drawn from a Postgres sequence rather than `max(cert_no) + 1` so two people
 * saving at once cannot land on the same number. The sequence is global rather
 * than per-year, so the counter does not restart each January — a deleted
 * certificate therefore leaves a gap, which is the intended behaviour: a
 * reference that has been printed and handed over is never reused.
 */
async function nextCertificateNo(tx: Tx, year: number): Promise<string> {
  const result = await tx.execute<{ n: string }>(
    sql`SELECT nextval('certificate_no_seq')::text AS n`,
  );

  return `RDX-COC-${year}-${String(result.rows[0].n).padStart(4, "0")}`;
}

export type ListCertificatesOptions = {
  /**
   * Free text matched case-insensitively against the reference, client, project
   * and location. Blank or omitted lists everything.
   */
  search?: string;
  limit?: number;
};

/** Newest issue date first — the order a certificate is looked up in. */
export async function listCertificates(
  db: CertificateDb,
  { search, limit = 100 }: ListCertificatesOptions = {},
) {
  const term = normalizeSearch(search);
  const pattern = toContainsPattern(term);

  return db
    .select({
      id: certificates.id,
      certNo: certificates.certNo,
      clientName: certificates.clientName,
      projectTitle: certificates.projectTitle,
      location: certificates.location,
      completionDate: certificates.completionDate,
      issueDate: certificates.issueDate,
    })
    .from(certificates)
    // `undefined` rather than a tautology, so the unfiltered query is unchanged.
    .where(
      term
        ? or(
            ilike(certificates.certNo, pattern),
            ilike(certificates.clientName, pattern),
            ilike(certificates.projectTitle, pattern),
            ilike(certificates.location, pattern),
          )
        : undefined,
    )
    .orderBy(desc(certificates.issueDate), desc(certificates.createdAt))
    .limit(limit);
}

export type CertificateListRow = Awaited<
  ReturnType<typeof listCertificates>
>[number];

/** One certificate, for the edit page. */
export async function getCertificate(db: CertificateDb, id: string) {
  const [row] = await db
    .select()
    .from(certificates)
    .where(eq(certificates.id, id))
    .limit(1);

  return row ?? null;
}

export type CertificateRecord = NonNullable<
  Awaited<ReturnType<typeof getCertificate>>
>;

/**
 * The certificate and the letterhead it prints under.
 *
 * The profile is fetched here rather than in the page for the same reason
 * `getQuotationForPrint` does it: the printable route should make one call and
 * render, so there is one place that knows what a printed document needs.
 */
export async function getCertificateForPrint(db: CertificateDb, id: string) {
  const certificate = await getCertificate(db, id);

  if (!certificate) return null;

  const [profile] = await db
    .select()
    .from(companyProfile)
    .where(eq(companyProfile.slug, "reydex"))
    .limit(1);

  return { certificate, profile };
}

export type PrintableCertificate = NonNullable<
  Awaited<ReturnType<typeof getCertificateForPrint>>
>;

/**
 * Issues a certificate, allocating its reference from the sequence.
 *
 * In a transaction so a failed insert does not strand a consumed number — the
 * sequence itself is non-transactional, but keeping the two together means the
 * only gaps are from deletions rather than from failed saves as well.
 */
export async function createCertificate(
  db: CertificateDb,
  input: CertificateInput,
  preparedByUserId?: string | null,
): Promise<{ id: string; certNo: string }> {
  return db.transaction(async (tx) => {
    // Numbered by the year it is issued, which is the date printed on it.
    const certNo = await nextCertificateNo(
      tx,
      Number(input.issueDate.slice(0, 4)),
    );

    const [row] = await tx
      .insert(certificates)
      .values({ ...input, certNo, preparedByUserId: preparedByUserId ?? null })
      .returning({ id: certificates.id });

    return { id: row.id, certNo };
  });
}

/**
 * Applies an edit. Returns null when the row is gone — deleted in another tab
 * between loading the form and submitting it — so the caller can say so rather
 * than reporting a silent success.
 *
 * The reference is never rewritten, even when the issue date moves to another
 * year: it is the identifier on a document that has already been handed over.
 */
export async function updateCertificate(
  db: CertificateDb,
  id: string,
  input: CertificateInput,
): Promise<{ certNo: string } | null> {
  const updated = await db
    .update(certificates)
    .set({ ...input, updatedAt: sql`now()` })
    .where(eq(certificates.id, id))
    .returning({ certNo: certificates.certNo });

  return updated[0] ?? null;
}

export type DeleteCertificateResult =
  | { ok: true; certNo: string }
  | { ok: false; reason: "not_found" };

/**
 * Deletes a certificate.
 *
 * Nothing references one, so unlike a customer there is nothing to block on.
 * What the caller should warn about instead is that the reference is retired
 * rather than freed — see `nextCertificateNo`.
 */
export async function deleteCertificate(
  db: CertificateDb,
  id: string,
): Promise<DeleteCertificateResult> {
  const deleted = await db
    .delete(certificates)
    .where(eq(certificates.id, id))
    .returning({ certNo: certificates.certNo });

  if (deleted.length === 0) return { ok: false, reason: "not_found" };

  return { ok: true, certNo: deleted[0].certNo };
}
