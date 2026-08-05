import Image from "next/image";

import type { BrandLogo } from "@/lib/brand";

type ReydexMarkProps = {
  /**
   * The corporate mark, resolved server-side by `lib/brand.ts`. When `null`, a
   * vector stand-in in the brand colours is rendered instead so the layout
   * never shows a broken image.
   */
  logo: BrandLogo | null;
  /** Rendered height in pixels; width follows the artwork's aspect ratio. */
  height?: number;
  className?: string;
  priority?: boolean;
};

/** The vector stand-in's aspect ratio (its viewBox is square). */
const FALLBACK_ASPECT = 1;

export function ReydexMark({
  logo,
  height = 96,
  className,
  priority = false,
}: ReydexMarkProps) {
  if (!logo) {
    const size = Math.round(height * FALLBACK_ASPECT);
    return (
      <ReydexMarkFallback width={size} height={height} className={className} />
    );
  }

  // The lockup is wider than it is tall, so derive width rather than forcing a
  // square and stretching the dragon.
  const width = Math.round(height * (logo.width / logo.height));

  return (
    <Image
      src={logo.src}
      alt="Reydex Fire Extinguisher Trading"
      width={width}
      height={height}
      priority={priority}
      className={className}
      // No `sizes`: this is a fixed-size mark, so let next/image emit a plain
      // 1x/2x srcset. Passing `sizes` would mark it responsive and pull the
      // full-resolution source for a 100px-tall logo.
    />
  );
}

/**
 * Vector stand-in: a gold shield carrying a flame, echoing the corporate
 * badge's molten-gold-on-dark treatment without imitating the dragon artwork.
 *
 * Kept in step with `assets/reydex-mark.svg`, which feeds `npm run make-icons`.
 */
function ReydexMarkFallback({
  width,
  height,
  className,
}: {
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Reydex Fire Extinguisher Trading"
      className={className}
    >
      <defs>
        <linearGradient id="reydex-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6d1" />
          <stop offset="40%" stopColor="#ffd95c" />
          <stop offset="100%" stopColor="#c98a19" />
        </linearGradient>
        <linearGradient id="reydex-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6d1" />
          <stop offset="55%" stopColor="#f8c531" />
          <stop offset="100%" stopColor="#d1901a" />
        </linearGradient>
      </defs>

      {/* Shield */}
      <path
        d="M32 1 61 10.5V32c0 15.6-11.2 27-29 31C14.2 59 3 47.6 3 32V10.5Z"
        fill="url(#reydex-gold)"
      />
      <path
        d="M32 6.5 55.5 14.3V32c0 12.9-9.1 22.4-23.5 26C17.6 54.4 8.5 44.9 8.5 32V14.3Z"
        fill="#120e08"
      />

      {/* Flame */}
      <path
        d="M32 15c1.8 5.8 5.8 8.5 8.7 12.5a13 13 0 0 1 2.5 7.7C43.2 43 38.1 48 32 48s-11.2-5-11.2-12.8c0-2.9 1-5.5 2.7-7.8C26.7 23 30.2 20.4 32 15Z"
        fill="url(#reydex-flame)"
      />
      <path
        d="M32 27.8c1.1 3.2 4 5.1 4 9.1 0 3-1.8 5.6-4 5.6s-4-2.6-4-5.6c0-4 2.9-5.9 4-9.1Z"
        fill="#120e08"
        opacity="0.55"
      />
    </svg>
  );
}
