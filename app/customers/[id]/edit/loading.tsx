import { FormSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingEditCustomer() {
  return (
    <PageSkeleton width="max-w-3xl">
      <FormSkeleton />
    </PageSkeleton>
  );
}
