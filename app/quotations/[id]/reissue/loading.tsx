import { FormSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingReissueQuotation() {
  return (
    <PageSkeleton width="max-w-3xl">
      <FormSkeleton fields={4} />
    </PageSkeleton>
  );
}
