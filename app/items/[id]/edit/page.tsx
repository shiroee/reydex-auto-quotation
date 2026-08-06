import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { isItemId } from "@/lib/items/form";
import { getItem } from "@/lib/items/service";

import { ItemForm } from "../../item-form";

export const dynamic = "force-dynamic";

/** `null` for both a malformed id and a missing row, so the page 404s either way. */
async function loadItem(id: string) {
  return isItemId(id) ? getItem(db, id) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/items/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  const item = await loadItem(id);

  return { title: item ? `Edit ${item.name}` : "Item" };
}

export default async function EditItemPage({
  params,
}: PageProps<"/items/[id]/edit">) {
  await requireSession();

  const { id } = await params;
  const item = await loadItem(id);

  if (!item) notFound();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
            Edit item
          </h1>

          {/*
           * Quotation lines snapshot what they quoted, so this is reassurance
           * rather than a warning: editing the catalogue cannot restate a
           * document that has already gone out.
           */}
          {item.quotedLineCount > 0 ? (
            <p className="text-xs text-gold-100/45">
              Quoted on {item.quotedLineCount}{" "}
              {item.quotedLineCount === 1 ? "line" : "lines"}. Those keep the
              wording and price they were raised with — changes here apply to new
              quotations only.
            </p>
          ) : null}

          <ItemForm item={item} />
        </div>
      </div>
    </main>
  );
}
