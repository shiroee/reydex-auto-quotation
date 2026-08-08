import { FormSkeleton, PageSkeleton } from "@/components/page-skeleton";

export default function LoadingNewCertificate() {
  return (
    <PageSkeleton width="max-w-3xl">
      <FormSkeleton fields={6} />
    </PageSkeleton>
  );
}
