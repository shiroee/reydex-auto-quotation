import { ListingSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingQuotations() {
  return (
    <PageSkeleton action>
      <ListingSkeleton />
    </PageSkeleton>
  );
}
