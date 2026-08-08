import { FormSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingNewQuotationType() {
  return (
    <PageSkeleton width="max-w-3xl">
      <FormSkeleton />
    </PageSkeleton>
  );
}
