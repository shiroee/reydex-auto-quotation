import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Letterhead } from "@/components/quotations/letterhead";
import { ServiceProposalLayout } from "@/components/quotations/service-proposal-layout";
import { SupplyLayout } from "@/components/quotations/supply-layout";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { brandLogo, signatureImage } from "@/lib/brand";
import { documentFileName } from "@/lib/documents/filename";
import { getQuotationForPrint } from "@/lib/quotations/service";

import { PrintButton } from "@/components/documents/print-button";
import "@/components/documents/document.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/quotations/[id]/print">): Promise<Metadata> {
  const { id } = await params;
  const data = await getQuotationForPrint(db, id);

  /*
   * `absolute` so the root layout's "%s · Reydex Quotations" template is not
   * appended: the title is what Save as PDF offers as the filename, and the
   * suffix would land in it. See lib/documents/filename.ts.
   */
  return {
    title: {
      absolute: data
        ? documentFileName(
            "Reydex Quotation",
            data.quotation.quoteNo,
            data.customer?.name ?? "",
          )
        : "Reydex Quotation",
    },
  };
}

export default async function QuotationPrintPage({
  params,
}: PageProps<"/quotations/[id]/print">) {
  await requireSession();

  const { id } = await params;
  const data = await getQuotationForPrint(db, id);

  if (!data) notFound();

  return (
    <div className="q-page q-viewport">
      <div className="q-toolbar">
        <span className="q-toolbar-note">
          Print or Save as PDF — A4, margins off (the letterhead is part of the
          page).
        </span>
        <Link href="/quotations" className="q-back-link">
          All quotations
        </Link>
        <PrintButton />
      </div>

      <article className="q-sheet">
        {/*
         * The document is wrapped in a single-column layout table so the
         * letterhead can live in a `thead`: browsers repeat a table header group
         * at the top of every printed page *and* reserve its height in each
         * page's flow, which padding on the sheet cannot do (padding applies
         * once, to the first fragment). That reservation is what stops page two
         * from printing underneath the letterhead. The empty `tfoot` reserves
         * the bottom gap the same way. `role="presentation"` because none of
         * this is tabular data.
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
                {data.quotation.template === "service_proposal" ? (
                  <ServiceProposalLayout {...data} signature={signatureImage} />
                ) : (
                  <SupplyLayout {...data} signature={signatureImage} />
                )}
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
