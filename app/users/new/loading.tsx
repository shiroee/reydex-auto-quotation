import { FormSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingNewUser() {
  return (
    <PageSkeleton width="max-w-3xl">
      <FormSkeleton fields={5} />
    </PageSkeleton>
  );
}
