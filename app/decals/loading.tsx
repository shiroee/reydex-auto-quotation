import { PageSkeleton, SkeletonBar } from "@/components/page-skeleton";

/**
 * Bones for the decal dashboard: the intro line, then four cards each led by the
 * tall block its preview occupies. Aspect ratio rather than a fixed height, so
 * the placeholder is the same shape as the decal that replaces it.
 */
export default function LoadingDecals() {
  return (
    <PageSkeleton>
      <SkeletonBar className="mb-5 h-3 w-full max-w-3xl" />

      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="reydex-card rounded-2xl p-5">
            <SkeletonBar className="aspect-[141/190] w-full rounded-lg" />
            <SkeletonBar className="mt-4 h-4 w-2/3" />
            <SkeletonBar className="mt-2 h-2.5 w-1/2" />
            <SkeletonBar className="mt-3.5 h-3 w-full" />
            <SkeletonBar className="mt-4 h-10 w-24 rounded-lg sm:h-9" />
          </li>
        ))}
      </ul>
    </PageSkeleton>
  );
}
