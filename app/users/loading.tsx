import { ListingSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingUsers() {
  return (
    <PageSkeleton action>
      <ListingSkeleton columns={5} />
    </PageSkeleton>
  );
}
