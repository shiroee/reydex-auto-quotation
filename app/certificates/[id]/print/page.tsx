import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CertificateSheet } from "@/components/certificates/certificate-sheet";
import { Letterhead } from "@/components/quotations/letterhead";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { brandLogo } from "@/lib/brand";
import { certificateFilePrefix } from "@/lib/certificates/format";
import { isCertificateId } from "@/lib/certificates/form";
import { getCertificateForPrint } from "@/lib/certificates/service";
import { documentFileName } from "@/lib/documents/filename";

import { PrintButton } from "@/components/documents/print-button";
import "@/components/documents/document.css";

export const dynamic = "force-dynamic";

/** `null` for both a malformed id and a missing row, so the page 404s either way. */
async function load(id: string) {
  return isCertificateId(id) ? getCertificateForPrint(db, id) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/certificates/[id]/print">): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);

  /*
   * `absolute` so the root layout's "%s · Reydex Quotations" template is not
   * appended: the title is what Save as PDF offers as the filename, and a
   * certificate should not save under the word "Quotations".
   */
  return {
    title: {
      absolute: data
        ? documentFileName(
            certificateFilePrefix(data.certificate.kind),
            data.certificate.certNo,
            data.certificate.clientName,
          )
        : "Reydex certificate",
    },
  };
}

export default async function CertificatePrintPage({
  params,
}: PageProps<"/certificates/[id]/print">) {
  await requireSession();

  const { id } = await params;
  const data = await load(id);

  if (!data) notFound();

  return (
    <div className="q-page q-viewport">
      <div className="q-toolbar">
        <span className="q-toolbar-note">
          Print or Save as PDF — A4, margins off (the letterhead is part of the
          page).
        </span>
        <Link href="/certificates" className="q-back-link">
          All certificates
        </Link>
        <PrintButton />
      </div>

      <article className="q-sheet">
        {/*
         * The same single-column frame the quotation uses: the letterhead lives
         * in a `thead` so browsers repeat it — and reserve its height — on every
         * printed page, and the empty `tfoot` reserves the bottom gap the same
         * way. A certificate is one page today, but it is laid out to survive
         * becoming two. See components/documents/document.css.
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
                <CertificateSheet
                  certificate={data.certificate}
                  profile={data.profile}
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
