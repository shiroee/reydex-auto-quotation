import { FormSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingEditQuotation() {
  return (
    <PageSkeleton width="max-w-3xl">
      <FormSkeleton fields={7} />
    </PageSkeleton>
  );
}
