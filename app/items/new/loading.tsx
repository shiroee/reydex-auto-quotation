import { FormSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingNewItem() {
  return (
    <PageSkeleton width="max-w-3xl">
      <FormSkeleton />
    </PageSkeleton>
  );
}
