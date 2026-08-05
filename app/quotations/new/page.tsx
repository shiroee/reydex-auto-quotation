import type { Metadata } from "next";
import Link from "next/link";

import { ReydexMark } from "@/components/brand/reydex-mark";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { brandLogo } from "@/lib/brand";
import {
  listCustomerOptions,
  listPresetOptions,
  listPriceVariants,
} from "@/lib/quotations/catalogue";

import { QuotationForm } from "./quotation-form";

export const metadata: Metadata = { title: "New quotation" };

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  await requireSession();

  const [customers, presets, variants] = await Promise.all([
    listCustomerOptions(db),
    listPresetOptions(db),
    listPriceVariants(db),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-gold-500/10 px-5 py-4 sm:px-8">
        <Link href="/quotations" className="flex items-center gap-3">
          <ReydexMark logo={brandLogo} height={34} priority />
        </Link>
        <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
          New quotation
        </h1>
      </header>

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto w-full max-w-3xl">
          {customers.length === 0 || variants.length === 0 ? (
            <div className="reydex-card rounded-2xl p-8 text-center">
              <p className="text-gold-100/70">
                The catalogue is empty, so there is nothing to quote yet.
              </p>
              <p className="mt-2 text-sm text-gold-100/40">
                Run <code className="text-gold-300">npm run db:seed</code> to
                load products, prices and customers.
              </p>
            </div>
          ) : (
            <QuotationForm
              customers={customers}
              presets={presets}
              variants={variants}
              today={today}
            />
          )}
        </div>
      </div>
    </main>
  );
}
