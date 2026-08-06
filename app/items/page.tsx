import type { Metadata } from "next";
import Link from "next/link";
import { LuPencil, LuPlus } from "react-icons/lu";

import { AppHeader } from "@/components/app-header";
import { DeleteRowButton } from "@/components/delete-row-button";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { CATEGORY_LABEL, type Category } from "@/lib/items/form";
import { listItems } from "@/lib/items/service";
import { formatPeso } from "@/lib/quotations/money";
import { normalizeSearch, SEARCH_PARAM } from "@/lib/quotations/search";

import { deleteItemAction } from "./actions";
import { ItemsSearch } from "./items-search";

export const metadata: Metadata = { title: "Items" };

export const dynamic = "force-dynamic";

/** "₱1,200.00" for one price, "₱600.00 – ₱3,000.00" for a range. */
function priceRange(min: string | null, max: string | null): string {
  if (min === null || max === null) return "—";
  if (Number(min) === Number(max)) return formatPeso(min);
  return `${formatPeso(min)} – ${formatPeso(max)}`;
}

export default async function ItemsPage(props: PageProps<"/items">) {
  await requireSession();

  const term = normalizeSearch((await props.searchParams)[SEARCH_PARAM]);
  const rows = await listItems(db, { search: term });

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader>
        <Link
          href="/items/new"
          className="reydex-submit inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold"
        >
          <LuPlus aria-hidden className="size-4" />
          New item
        </Link>
      </AppHeader>

      <div className="flex-1 px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <ItemsSearch term={term} />

          {/*
           * `role="status"` on the result line and on the empty card, so a
           * search submitted from the keyboard is announced without focus
           * having to move into the results.
           */}
          {term && rows.length > 0 ? (
            <p className="mb-3 text-xs text-gold-100/45" role="status">
              {rows.length} {rows.length === 1 ? "match" : "matches"} for “
              {term}”
            </p>
          ) : null}

          {rows.length === 0 ? (
            <div
              className="reydex-card rounded-2xl p-8 text-center"
              role={term ? "status" : undefined}
            >
              {term ? (
                <>
                  <p className="text-gold-100/70">No items match “{term}”.</p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Searches cover the SKU, name and brand.{" "}
                    <Link href="/items" className="text-gold-300 underline">
                      Show all items
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gold-100/70">No items yet.</p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Add one with{" "}
                    <Link href="/items/new" className="text-gold-300 underline">
                      New item
                    </Link>
                    , or run{" "}
                    <code className="text-gold-300">npm run db:seed</code> to
                    load the catalogue the samples use.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="reydex-card overflow-hidden rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gold-500/15 text-xs uppercase tracking-wider text-gold-100/45">
                  <tr>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Live prices
                    </th>
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
                        {row.sku}
                      </td>
                      <td className="px-4 py-3 text-gold-100/85">
                        <span className="flex items-center gap-2">
                          <Link
                            href={`/items/${row.id}/edit`}
                            className="underline-offset-2 hover:text-gold-100 hover:underline"
                          >
                            {row.name}
                          </Link>
                          {row.isActive ? null : (
                            <span
                              title="Not offered in the builder"
                              className="rounded-md bg-gold-100/8 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-gold-100/50"
                            >
                              Retired
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-gold-100/35">
                          {[row.brand, `per ${row.unitLabel}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gold-100/55">
                        {CATEGORY_LABEL[row.category as Category] ??
                          row.category}
                      </td>
                      <td className="px-4 py-3 text-right text-gold-100/85">
                        {priceRange(row.minPrice, row.maxPrice)}
                        <span className="mt-0.5 block text-xs text-gold-100/35">
                          {row.variantCount === 0
                            ? "no live price"
                            : `${row.variantCount} ${
                                row.variantCount === 1 ? "variant" : "variants"
                              }`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start justify-end gap-4">
                          <Link
                            href={`/items/${row.id}/edit`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-300 underline-offset-2 hover:underline"
                          >
                            <LuPencil aria-hidden className="size-3.5" />
                            Edit
                          </Link>
                          {/*
                           * Deletion is allowed even for a quoted item: a
                           * quotation line holds its own snapshot and keeps only
                           * a soft backlink, which the FK nulls. Say what will be
                           * severed rather than blocking it — and note that
                           * clearing "available to quote" is the reversible way.
                           */}
                          <DeleteRowButton
                            action={deleteItemAction}
                            id={row.id}
                            name={row.name}
                            warning={
                              row.quotedLineCount > 0
                                ? `Quoted on ${row.quotedLineCount} ${
                                    row.quotedLineCount === 1 ? "line" : "lines"
                                  }. Those keep their wording but lose the link.`
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
