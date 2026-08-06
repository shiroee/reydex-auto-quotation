import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { db } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { isPresetId } from "@/lib/presets/form";
import { getPreset } from "@/lib/presets/service";

import { PresetForm } from "../../preset-form";

export const dynamic = "force-dynamic";

/** `null` for both a malformed id and a missing row, so the page 404s either way. */
async function loadPreset(id: string) {
  return isPresetId(id) ? getPreset(db, id) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/quotation-types/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  const preset = await loadPreset(id);

  return { title: preset ? `Edit ${preset.label}` : "Quotation type" };
}

export default async function EditQuotationTypePage({
  params,
}: PageProps<"/quotation-types/[id]/edit">) {
  await requireSession();

  const { id } = await params;
  const preset = await loadPreset(id);

  if (!preset) notFound();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="mb-6 text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
            Edit quotation type
          </h1>
          <PresetForm preset={preset} />
        </div>
      </div>
    </main>
  );
}
