import { PageSkeleton, SkeletonBar } from "@/components/page-skeleton";

/**
 * The dashboard reads the session before it can greet anyone or decide whether
 * Users belongs in the grid, so it has the same beat as the listings — hence its
 * own bones rather than the listing ones: a welcome card, then the tiles.
 *
 * Six tiles, the count a non-administrator sees. The seventh appearing when the
 * page lands grows the grid by one row; guessing seven and dropping to six would
 * shrink it, and a placeholder that overstates is the worse of the two.
 */
export default function LoadingDashboard() {
  return (
    <PageSkeleton width="max-w-2xl">
      <div className="reydex-card rounded-2xl p-6 sm:p-9">
        <div className="flex flex-col items-center">
          <SkeletonBar className="h-2.5 w-20" />
          <SkeletonBar className="mt-3.5 h-6 w-64 max-w-full" />
          <SkeletonBar className="mt-3.5 h-3 w-52 max-w-full" />
          <SkeletonBar className="mt-7 h-10 w-44 rounded-lg" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="reydex-card flex items-center gap-3.5 rounded-xl px-4 py-3.5"
          >
            <SkeletonBar className="size-5 shrink-0 rounded" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <SkeletonBar className="h-3 w-24" />
              <SkeletonBar className="h-2.5 w-36 max-w-full" />
            </span>
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}
