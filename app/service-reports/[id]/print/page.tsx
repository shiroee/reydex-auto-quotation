import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Letterhead } from "@/components/quotations/letterhead";
import { ServiceReportSheet } from "@/components/service-reports/service-report-sheet";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { brandLogo, engineerSignatureImage } from "@/lib/brand";
import { documentFileName } from "@/lib/documents/filename";
import { serviceReportFilePrefix } from "@/lib/service-reports/format";
import { isServiceReportId } from "@/lib/service-reports/form";
import { getServiceReportForPrint } from "@/lib/service-reports/service";

import { PrintButton } from "@/components/documents/print-button";
import "@/components/documents/document.css";

export const dynamic = "force-dynamic";

/** `null` for both a malformed id and a missing row, so the page 404s either way. */
async function load(id: string) {
  return isServiceReportId(id) ? getServiceReportForPrint(db, id) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/service-reports/[id]/print">): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);

  /*
   * `absolute` so the root layout's "%s · Reydex Quotations" template is not
   * appended: the title is what Save as PDF offers as the filename, and a
   * service report should not save under the word "Quotations".
   */
  return {
    title: {
      absolute: data
        ? documentFileName(
            serviceReportFilePrefix(data.report.kind),
            data.report.reportNo,
            data.report.customerName,
          )
        : "Reydex service report",
    },
  };
}

export default async function ServiceReportPrintPage({
  params,
}: PageProps<"/service-reports/[id]/print">) {
  await requireSession();

  const { id } = await params;
  const data = await load(id);

  if (!data) notFound();

  return (
    /* `q-page-sr` tightens the shared frame for this document — see the CSS. */
    <div className="q-page q-page-sr q-viewport">
      <div className="q-toolbar">
        <span className="q-toolbar-note">
          Print or Save as PDF — A4, margins off (the letterhead is part of the
          page)
          {data.report.kind === "checklist"
            ? ", background graphics on for the shaded headings"
            : null}
          .
        </span>
        <Link href="/service-reports" className="q-back-link">
          All service reports
        </Link>
        <PrintButton />
      </div>

      <article className="q-sheet">
        {/*
         * The same single-column frame the quotation and the certificates use:
         * the letterhead lives in a `thead` so browsers repeat it — and reserve
         * its height — on every printed page, and the empty `tfoot` reserves the
         * bottom gap the same way. A service report is one page for a short
         * visit and two for a long one, so this is load-bearing here rather than
         * precautionary. See components/documents/document.css.
         */}
        <table className="q-frame" role="presentation">
          <thead>
            <tr>
              <td className="q-frame-head">
                <Letterhead profile={data.profile} logo={brandLogo} />
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="q-frame-body">
                {/*
                 * The engineer's signature, not the company's: a maintenance
                 * report is signed by whoever carried out and supervised the
                 * testing, in the same professional capacity that signs the
                 * safety & reliability certificate.
                 */}
                <ServiceReportSheet
                  report={data.report}
                  profile={data.profile}
                  signature={engineerSignatureImage}
                />
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="q-frame-foot" />
            </tr>
          </tfoot>
        </table>
      </article>
    </div>
  );
}
