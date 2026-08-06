"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LuFileText,
  LuHouse,
  LuLayoutTemplate,
  LuPackage,
  LuUsers,
} from "react-icons/lu";

/**
 * The five places the app has. Order is the order of use: raise a quotation,
 * look one up, then maintain the three things quotations are built from.
 */
const SECTIONS = [
  { href: "/dashboard", label: "Home", Icon: LuHouse },
  { href: "/quotations", label: "Quotations", Icon: LuFileText },
  { href: "/customers", label: "Customers", Icon: LuUsers },
  { href: "/quotation-types", label: "Quotation types", Icon: LuLayoutTemplate },
  { href: "/items", label: "Items", Icon: LuPackage },
] as const;

/**
 * Primary navigation, shared by every page.
 *
 * A client component only so the current section can be derived from the path
 * rather than passed in by each page — one prop per page is one prop per page to
 * forget, and a nav that quietly highlights the wrong entry is worse than none.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="min-w-0">
      {/* Scrolls rather than wraps on a narrow screen, so the header keeps one line. */}
      <ul className="flex items-center gap-1 overflow-x-auto">
        {SECTIONS.map((section) => {
          // `/customers` is current on `/customers/new` too, but `/customersfoo`
          // is a different section, hence the explicit separator.
          const isCurrent =
            pathname === section.href ||
            pathname.startsWith(`${section.href}/`);

          const { Icon } = section;

          return (
            <li key={section.href} className="shrink-0">
              <Link
                href={section.href}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent
                    ? "inline-flex h-8 items-center gap-2 rounded-lg bg-gold-500/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold-200"
                    : "inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-medium uppercase tracking-[0.12em] text-gold-100/50 transition-colors hover:bg-gold-500/6 hover:text-gold-100"
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
