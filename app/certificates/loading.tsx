import { ListingSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingCertificates() {
  return (
    <PageSkeleton action>
      <ListingSkeleton />
    </PageSkeleton>
  );
}
