import { FormSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingEditUser() {
  return (
    <PageSkeleton width="max-w-3xl">
      <FormSkeleton fields={5} />
    </PageSkeleton>
  );
}
