import { ListingSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingCustomers() {
  return (
    <PageSkeleton action>
      <ListingSkeleton columns={5} />
    </PageSkeleton>
  );
}
