import { ListingSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingItems() {
  return (
    <PageSkeleton action>
      <ListingSkeleton />
    </PageSkeleton>
  );
}
