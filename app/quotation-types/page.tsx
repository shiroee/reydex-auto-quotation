import type { Metadata } from "next";
import Link from "next/link";
import { LuPencil, LuPlus, LuStar } from "react-icons/lu";

import { AppHeader } from "@/components/app-header";
import { DeleteRowButton } from "@/components/delete-row-button";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { TEMPLATE_LABEL, type Template } from "@/lib/presets/form";
import { listPresets } from "@/lib/presets/service";

import { deletePresetAction } from "./actions";

export const metadata: Metadata = { title: "Quotation types" };

export const dynamic = "force-dynamic";

export default async function QuotationTypesPage() {
  await requireSession();

  const rows = await listPresets(db);

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader>
        <Link
          href="/quotation-types/new"
          className="reydex-submit inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold"
        >
          <LuPlus aria-hidden className="size-4" />
          New type
        </Link>
      </AppHeader>

      <div className="flex-1 px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <p className="mb-5 text-sm leading-relaxed text-gold-100/45">
            A quotation type is the boilerplate the builder offers under{" "}
            <em>Quotation type</em>: layout, letter body, terms and exclusions. A
            quotation copies these when it is raised, so editing a type never
            changes a document that has already gone out.
          </p>

          {rows.length === 0 ? (
            <div className="reydex-card rounded-2xl p-8 text-center">
              <p className="text-gold-100/70">No quotation types yet.</p>
              <p className="mt-2 text-sm text-gold-100/40">
                Add one with{" "}
                <Link
                  href="/quotation-types/new"
                  className="text-gold-300 underline"
                >
                  New type
                </Link>
                , or run <code className="text-gold-300">npm run db:seed</code>{" "}
                to load the three the samples use.
              </p>
            </div>
          ) : (
            <div className="reydex-card overflow-hidden rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gold-500/15 text-xs uppercase tracking-wider text-gold-100/45">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Layout</th>
                    <th className="px-4 py-3 font-medium">Terms</th>
                    <th className="px-4 py-3 text-right font-medium">Validity</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gold-500/8 last:border-0"
                    >
                      <td className="px-4 py-3 text-gold-100/85">
                        <span className="flex items-center gap-2">
                          <Link
                            href={`/quotation-types/${row.id}/edit`}
                            className="underline-offset-2 hover:text-gold-100 hover:underline"
                          >
                            {row.label}
                          </Link>
                          {row.isDefault ? (
                            <span
                              title="Pre-selected in the builder"
                              className="inline-flex items-center gap-1 rounded-md bg-gold-500/12 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-gold-200"
                            >
                              <LuStar aria-hidden className="size-3" />
                              Default
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block font-mono text-xs text-gold-100/35">
                          {row.slug}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gold-100/55">
                        {TEMPLATE_LABEL[row.template as Template] ??
                          row.template}
                        <span className="mt-0.5 block text-xs text-gold-100/35">
                          {[
                            row.showBankDetails ? "bank details" : null,
                            row.exclusions.length > 0
                              ? `${row.exclusions.length} exclusions`
                              : null,
                            row.scopeOfWorks?.length
                              ? `scope: ${row.scopeOfWorks.length} sections`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gold-100/55">
                        <span className="block max-w-64 truncate">
                          {row.paymentTerms ?? "—"}
                        </span>
                        <span className="mt-0.5 block max-w-64 truncate text-xs text-gold-100/35">
                          {row.deliveryTerms ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gold-100/55">
                        {row.validityDays} days
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start justify-end gap-4">
                          <Link
                            href={`/quotation-types/${row.id}/edit`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-300 underline-offset-2 hover:underline"
                          >
                            <LuPencil aria-hidden className="size-3.5" />
                            Edit
                          </Link>
                          {/*
                           * Deleting is safe — quotations copy a type rather
                           * than referencing it — except for the last one, which
                           * the builder needs. The action enforces that; here it
                           * only explains.
                           */}
                          <DeleteRowButton
                            action={deletePresetAction}
                            id={row.id}
                            name={row.label}
                            blockedReason={
                              rows.length === 1
                                ? "The builder needs at least one quotation type"
                                : undefined
                            }
                            warning={
                              row.isDefault
                                ? "Another type will become the default."
                                : undefined
                            }
                          />
                        </div>
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
