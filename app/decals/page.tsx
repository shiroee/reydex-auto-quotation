import type { Metadata } from "next";
import Link from "next/link";
import { LuPrinter } from "react-icons/lu";

import { AppHeader } from "@/components/app-header";
import { DecalArtwork } from "@/components/decals/decal";
import { requireSession } from "@/lib/auth/session";
import { DECALS, type Decal } from "@/lib/decals/catalogue";
import { DEFAULT_WIDTH_MM, decalHeight, planSheet } from "@/lib/decals/sheet";

import "@/components/decals/decal.css";

export const metadata: Metadata = { title: "Decals" };

/*
 * The decals are static, but the page gates on the session, which reads a
 * cookie — so it is rendered per request, like every other dashboard here.
 */
export const dynamic = "force-dynamic";

/** Width the card previews are drawn at. Everything on a decal scales with it. */
const PREVIEW_WIDTH_MM = 64;

/** "A · B · C", with a struck class marked as such. */
function classList(decal: Decal): string {
  return decal.fireClasses
    .map((fireClass) =>
      fireClass.prohibited ? `${fireClass.key} (struck)` : fireClass.key,
    )
    .join(" · ");
}

function DecalCard({ decal }: { decal: Decal }) {
  const plan = planSheet(DEFAULT_WIDTH_MM, "landscape");

  return (
    <li className="reydex-card flex flex-col overflow-hidden rounded-2xl">
      {/*
       * A real miniature rather than a screenshot: the same component the sheet
       * prints, drawn small. It cannot drift from what comes out of the printer,
       * because it is the same drawing.
       */}
      <div className="flex justify-center bg-white p-4">
        <DecalArtwork decal={decal} widthMm={PREVIEW_WIDTH_MM} />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-base font-semibold leading-snug text-gold-100/90">
          {decal.title}
        </h2>
        <p className="mt-0.5 text-xs uppercase tracking-wider text-gold-100/40">
          {decal.subtitle}
        </p>

        <p className="mt-2.5 text-sm leading-snug text-gold-100/60">
          {decal.summary}
        </p>

        <dl className="mt-3.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          <dt className="pt-px text-xs uppercase tracking-wider text-gold-100/40">
            Classes
          </dt>
          <dd className="text-sm text-gold-100/60">{classList(decal)}</dd>

          <dt className="pt-px text-xs uppercase tracking-wider text-gold-100/40">
            Licence
          </dt>
          <dd className="text-sm text-gold-100/60">{decal.licenceNo}</dd>

          <dt className="pt-px text-xs uppercase tracking-wider text-gold-100/40">
            Sheet
          </dt>
          <dd className="text-sm text-gold-100/60">
            {plan.perSheet} per A4 at {DEFAULT_WIDTH_MM}×
            {decalHeight(DEFAULT_WIDTH_MM)}mm
          </dd>
        </dl>

        <div className="mt-auto pt-4">
          <Link
            href={`/decals/${decal.slug}/print`}
            className="reydex-submit inline-flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold sm:h-9"
          >
            <LuPrinter aria-hidden className="size-4" />
            Print
          </Link>
        </div>
      </div>
    </li>
  );
}

export default async function DecalsPage() {
  await requireSession();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl">
          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-gold-100/55">
            The cylinder labels, drawn to size and printable from any machine
            that can reach this site — pick a decal, set the width to suit the
            cylinder, and print. Each one carries its own chemical content, fire
            classes and BPS licence number; everything else is common to all
            four.
          </p>

          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {DECALS.map((decal) => (
              <DecalCard key={decal.slug} decal={decal} />
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
