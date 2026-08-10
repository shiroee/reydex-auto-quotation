"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LuAward,
  LuFileText,
  LuHistory,
  LuHouse,
  LuLayoutTemplate,
  LuPackage,
  LuSticker,
  LuUserCog,
  LuUsers,
} from "react-icons/lu";

/**
 * The places the app has. Order is the order of use: raise a quotation, look one
 * up, then maintain the three things quotations are built from — with the record
 * of who changed what last, since it is consulted rather than worked in.
 */
const SECTIONS = [
  { href: "/dashboard", label: "Home", Icon: LuHouse },
  { href: "/quotations", label: "Quotations", Icon: LuFileText },
  // Next to quotations: the two documents the business issues, in the order a
  // job passes through them — quote the work, then certify it finished.
  { href: "/certificates", label: "Certificates", Icon: LuAward },
  // The third thing the shop prints. Not a document for a client — it goes on
  // the cylinder — but it belongs with the printables rather than the catalogue.
  { href: "/decals", label: "Decals", Icon: LuSticker },
  { href: "/customers", label: "Customers", Icon: LuUsers },
  { href: "/quotation-types", label: "Quotation types", Icon: LuLayoutTemplate },
  { href: "/items", label: "Items", Icon: LuPackage },
  { href: "/activity", label: "Activity", Icon: LuHistory },
] as const;

/**
 * Administering accounts, kept last and shown only to administrators — it is
 * housekeeping rather than part of raising a quotation.
 */
const ADMIN_SECTION = {
  href: "/users",
  label: "Users",
  Icon: LuUserCog,
} as const;

/**
 * Primary navigation, shared by every page.
 *
 * A client component only so the current section can be derived from the path
 * rather than passed in by each page — one prop per page is one prop per page to
 * forget, and a nav that quietly highlights the wrong entry is worse than none.
 *
 * Whether the Users entry appears is the one thing it cannot derive, so
 * `AppHeader` reads the session and passes it in. Hiding the link is presentation
 * only: `/users` gates itself, as do its actions.
 */
export function AppNav({
  className,
  canManageUsers = false,
}: {
  className?: string;
  canManageUsers?: boolean;
}) {
  const pathname = usePathname();

  const sections = canManageUsers ? [...SECTIONS, ADMIN_SECTION] : SECTIONS;

  return (
    <nav aria-label="Main" className={`min-w-0 ${className ?? ""}`}>
      {/*
       * Scrolls rather than wraps on a narrow screen, so the navigation stays one
       * line however little room it has. `snap-x` so a swipe settles with a link
       * at the left edge instead of half of one.
       */}
      <ul className="reydex-rail flex snap-x snap-mandatory items-center gap-1 overflow-x-auto">
        {sections.map((section) => {
          // `/customers` is current on `/customers/new` too, but `/customersfoo`
          // is a different section, hence the explicit separator.
          const isCurrent =
            pathname === section.href ||
            pathname.startsWith(`${section.href}/`);

          const { Icon } = section;

          return (
            <li key={section.href} className="shrink-0 snap-start">
              <Link
                href={section.href}
                aria-current={isCurrent ? "page" : undefined}
                /* `h-9` on a phone: 32px is a small thing to hit with a thumb. */
                className={
                  isCurrent
                    ? "inline-flex h-9 items-center gap-2 rounded-lg bg-gold-500/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold-200 md:h-8"
                    : "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium uppercase tracking-[0.12em] text-gold-100/50 transition-colors hover:bg-gold-500/6 hover:text-gold-100 md:h-8"
                }
              >
                {/* Decorative: the label next to it already names the section. */}
                <Icon aria-hidden className="size-4 shrink-0" />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
