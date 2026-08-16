import { ListingSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingServiceReports() {
  return (
    <PageSkeleton action>
      <ListingSkeleton />
    </PageSkeleton>
  );
}
