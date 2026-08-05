import type { Metadata } from "next";
import Link from "next/link";

import { ReydexMark } from "@/components/brand/reydex-mark";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { brandLogo } from "@/lib/brand";
import { formatPeso } from "@/lib/quotations/money";
import { listQuotations } from "@/lib/quotations/service";

export const metadata: Metadata = { title: "Quotations" };

export const dynamic = "force-dynamic";

const TEMPLATE_LABEL: Record<string, string> = {
  supply: "Supply",
  service_proposal: "Service proposal",
};

export default async function QuotationsPage() {
  await requireSession();

  const rows = await listQuotations(db);

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-gold-500/10 px-5 py-4 sm:px-8">
        <Link href="/dashboard" className="flex items-center gap-3">
          <ReydexMark logo={brandLogo} height={34} priority />
        </Link>
        <div className="flex items-center gap-5">
          <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
            Quotations
          </h1>
          <Link
            href="/quotations/new"
            className="reydex-submit inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-semibold"
          >
            New quotation
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-4xl">
          {rows.length === 0 ? (
            <div className="reydex-card rounded-2xl p-8 text-center">
              <p className="text-gold-100/70">No quotations yet.</p>
              <p className="mt-2 text-sm text-gold-100/40">
                Create one with{" "}
                <Link href="/quotations/new" className="text-gold-300 underline">
                  New quotation
                </Link>
                , or run{" "}
                <code className="text-gold-300">npm run db:seed-samples</code> to
                load the three samples.
              </p>
            </div>
          ) : (
            <div className="reydex-card overflow-hidden rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gold-500/15 text-xs uppercase tracking-wider text-gold-100/45">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ref. No.</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gold-500/8 last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gold-200">
                        {row.quoteNo}
                      </td>
                      <td className="px-4 py-3 text-gold-100/85">
                        {row.customerName}
                      </td>
                      <td className="px-4 py-3 text-gold-100/55">
                        {TEMPLATE_LABEL[row.template] ?? row.template}
                      </td>
                      <td className="px-4 py-3 text-gold-100/55">
                        {row.quoteDate}
                      </td>
                      <td className="px-4 py-3 text-right text-gold-100/85">
                        {formatPeso(row.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/quotations/${row.id}/print`}
                          className="text-xs font-medium text-gold-300 underline-offset-2 hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
