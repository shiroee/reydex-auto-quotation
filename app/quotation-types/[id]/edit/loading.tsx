import { FormSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingEditQuotationType() {
  return (
    <PageSkeleton width="max-w-3xl">
      <FormSkeleton />
    </PageSkeleton>
  );
}
