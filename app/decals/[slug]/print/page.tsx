import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintSheet } from "./print-sheet";
import { requireSession } from "@/lib/auth/session";
import { findDecal } from "@/lib/decals/catalogue";
import { documentFileName } from "@/lib/documents/filename";

import "@/components/decals/decal.css";
import "@/components/decals/sheet.css";

/*
 * Dynamic despite the decals themselves being static: the page gates on the
 * session, which reads a cookie. Declaring it here rather than letting Next
 * discover it — a `generateStaticParams` on this route makes the build attempt
 * a prerender that can only fail, and it fails four times, once per decal.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/decals/[slug]/print">): Promise<Metadata> {
  const { slug } = await params;
  const decal = findDecal(slug);

  /*
   * `absolute` so the layout's "%s · Reydex Quotations" template is not appended:
   * this title is what Save as PDF offers as the filename, and a sheet of decals
   * should not save under the word "Quotations".
   */
  return {
    title: {
      absolute: decal
        ? documentFileName("Reydex Decal", decal.title, "")
        : "Reydex Decal",
    },
  };
}

export default async function DecalPrintPage({
  params,
}: PageProps<"/decals/[slug]/print">) {
  await requireSession();

  const { slug } = await params;
  const decal = findDecal(slug);

  if (!decal) notFound();

  return <PrintSheet decal={decal} />;
}
