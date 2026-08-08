import type { Metadata } from "next";

import { AppHeader } from "@/components/app-header";
import { requireSession } from "@/lib/auth/session";
import { todayInQuoteZone } from "@/lib/quotations/dates";

import { CertificateForm } from "../certificate-form";

export const metadata: Metadata = { title: "New certificate" };

export const dynamic = "force-dynamic";

export default async function NewCertificatePage() {
  await requireSession();

  // Manila, not UTC: `toISOString()` is a day behind for the whole Philippine
  // morning, which would date a certificate issued before 8 a.m. as yesterday.
  const today = todayInQuoteZone();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
              New certificate
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gold-100/45">
              The certificate&apos;s wording is fixed — it certifies preventive
              maintenance, inspection and testing, in compliance with the Bureau
              of Fire Protection. These fields fill its blanks. The reference
              number is allocated when you save.
            </p>
          </div>

          <CertificateForm today={today} />
        </div>
      </div>
    </main>
  );
}
