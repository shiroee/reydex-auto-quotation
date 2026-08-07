import type { Metadata } from "next";
import Link from "next/link";
import { LuPencil, LuPlus } from "react-icons/lu";

import { AppHeader } from "@/components/app-header";
import { DeleteRowButton } from "@/components/delete-row-button";
import { LastChange } from "@/components/last-change";
import { RecordCard, RecordList } from "@/components/record-list";
import {
  RowAction,
  RowActions,
  type RowActionsAlign,
} from "@/components/row-actions";
import { latestActivityFor } from "@/lib/activity/service";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { CATEGORY_LABEL, type Category } from "@/lib/items/form";
import { listItems, type ItemListRow } from "@/lib/items/service";
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

/** One row's controls, drawn once in the table cell and once in the phone card. */
function Controls({
  row,
  align,
}: {
  row: ItemListRow;
  align?: RowActionsAlign;
}) {
  return (
    <RowActions align={align}>
      <RowAction href={`/items/${row.id}/edit`} icon={LuPencil} tone="primary">
        Edit
      </RowAction>
      {/*
       * Deletion is allowed even for a quoted item: a quotation line holds its
       * own snapshot and keeps only a soft backlink, which the FK nulls. Say what
       * will be severed rather than blocking it — and note that clearing
       * "available to quote" is the reversible way.
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
        align={align}
      />
    </RowActions>
  );
}

/** Shown beside the name of an item the builder no longer offers. */
function RetiredBadge() {
  return (
    <span
      title="Not offered in the builder"
      className="rounded-md bg-gold-100/8 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-gold-100/50"
    >
      Retired
    </span>
  );
}

/** The price range, with how many live variants it was drawn from. */
function Prices({ row }: { row: ItemListRow }) {
  return (
    <>
      {priceRange(row.minPrice, row.maxPrice)}
      <span className="mt-0.5 block text-xs font-normal text-gold-100/35">
        {row.variantCount === 0
          ? "no live price"
          : `${row.variantCount} ${
              row.variantCount === 1 ? "variant" : "variants"
            }`}
      </span>
    </>
  );
}

export default async function ItemsPage(props: PageProps<"/items">) {
  await requireSession();

  const term = normalizeSearch((await props.searchParams)[SEARCH_PARAM]);
  const rows = await listItems(db, { search: term });

  // One lookup for the rows on this page; `now` is fixed so every row is
  // measured against the same instant.
  const activity = await latestActivityFor(
    db,
    "item",
    rows.map((row) => row.id),
  );
  const now = new Date();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader>
        <Link
          href="/items/new"
          className="reydex-submit inline-flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold sm:h-9"
        >
          <LuPlus aria-hidden className="size-4" />
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New item</span>
        </Link>
      </AppHeader>

      <div className="flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl">
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
            <>
              {/* Cards on a phone and a small laptop; the table from `lg` up. */}
              <RecordList>
                {rows.map((row) => (
                  <RecordCard
                    key={row.id}
                    eyebrow={row.sku}
                    title={row.name}
                    href={`/items/${row.id}/edit`}
                    badge={row.isActive ? null : <RetiredBadge />}
                    subtitle={[row.brand, `per ${row.unitLabel}`]
                      .filter(Boolean)
                      .join(" · ")}
                    facts={[
                      {
                        label: "Category",
                        value:
                          CATEGORY_LABEL[row.category as Category] ??
                          row.category,
                      },
                      {
                        label: "Prices",
                        value: <Prices row={row} />,
                        strong: true,
                      },
                      {
                        label: "Change",
                        value: (
                          <LastChange
                            entry={activity.get(row.id) ?? null}
                            now={now}
                          />
                        ),
                      },
                    ]}
                    actions={<Controls row={row} />}
                  />
                ))}
              </RecordList>

              <div className="reydex-card hidden overflow-x-auto rounded-2xl lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gold-500/15 text-xs uppercase tracking-wider text-gold-100/45">
                    <tr>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Live prices
                      </th>
                      <th className="px-4 py-3 font-medium">Last change</th>
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
                        {/*
                         * Bounded and clipped, with the full name on hover: item
                         * names run to eighty characters ("CARBON DIOXIDE …"),
                         * which unbounded makes this the column that takes the
                         * table past its container.
                         */}
                        <td className="px-4 py-3 text-gold-100/85">
                          <span className="flex max-w-72 items-center gap-2">
                            <Link
                              href={`/items/${row.id}/edit`}
                              title={row.name}
                              className="truncate underline-offset-2 hover:text-gold-100 hover:underline"
                            >
                              {row.name}
                            </Link>
                            {row.isActive ? null : <RetiredBadge />}
                          </span>
                          <span className="mt-0.5 block max-w-72 truncate text-xs text-gold-100/35">
                            {[row.brand, `per ${row.unitLabel}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gold-100/55">
                          {CATEGORY_LABEL[row.category as Category] ??
                            row.category}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-gold-100/85">
                          <Prices row={row} />
                        </td>
                        <td className="px-4 py-3 text-gold-100/55">
                          <LastChange
                            entry={activity.get(row.id) ?? null}
                            now={now}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Controls row={row} align="end" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
