import { FormSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingNewServiceReport() {
  return (
    <PageSkeleton width="max-w-3xl">
      <FormSkeleton fields={6} />
    </PageSkeleton>
  );
}
