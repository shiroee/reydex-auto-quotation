import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { isCertificateId } from "@/lib/certificates/form";
import { getCertificate } from "@/lib/certificates/service";
import { todayInQuoteZone } from "@/lib/quotations/dates";

import { CertificateForm } from "../../certificate-form";

export const dynamic = "force-dynamic";

/** `null` for both a malformed id and a missing row, so the page 404s either way. */
async function load(id: string) {
  return isCertificateId(id) ? getCertificate(db, id) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/certificates/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  const certificate = await load(id);

  return {
    title: certificate ? `Edit ${certificate.certNo}` : "Edit certificate",
  };
}

export default async function EditCertificatePage({
  params,
}: PageProps<"/certificates/[id]/edit">) {
  await requireSession();

  const { id } = await params;
  const certificate = await load(id);

  if (!certificate) notFound();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
              Edit {certificate.certNo}
            </h1>
            {/*
             * The one thing that is not obvious from the form: the reference is
             * fixed at issue, so re-dating a certificate into another year does
             * not renumber it. It is the identifier on a document that may
             * already be in a client's fire-safety file.
             */}
            <p className="mt-2 text-sm leading-relaxed text-gold-100/45">
              {certificate.certNo} stays with this certificate even if you
              change the issue date.{" "}
              <Link
                href={`/certificates/${certificate.id}/print`}
                className="text-gold-300 underline underline-offset-2"
              >
                Open the printable certificate
              </Link>{" "}
              to check how an edit reads.
            </p>
          </div>

          <CertificateForm
            certificate={certificate}
            today={todayInQuoteZone()}
          />
        </div>
      </div>
    </main>
  );
}
