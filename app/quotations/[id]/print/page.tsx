import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Letterhead } from "@/components/quotations/letterhead";
import { ServiceProposalLayout } from "@/components/quotations/service-proposal-layout";
import { SupplyLayout } from "@/components/quotations/supply-layout";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { brandLogo, signatureImage } from "@/lib/brand";
import { getQuotationForPrint } from "@/lib/quotations/service";

import { PrintButton } from "./print-button";
import "./print.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/quotations/[id]/print">): Promise<Metadata> {
  const { id } = await params;
  const data = await getQuotationForPrint(db, id);

  return {
    title: data ? `${data.quotation.quoteNo} — ${data.customer?.name ?? ""}` : "Quotation",
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
        <Letterhead profile={data.profile} logo={brandLogo} />

        {data.quotation.template === "service_proposal" ? (
          <ServiceProposalLayout {...data} signature={signatureImage} />
        ) : (
          <SupplyLayout {...data} signature={signatureImage} />
        )}
      </article>
    </div>
  );
}
