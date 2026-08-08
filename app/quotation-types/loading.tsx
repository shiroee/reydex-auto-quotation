import { ListingSkeleton, PageSkeleton } from "@/components/page-skeleton";

/** No search box on this listing, so the bones do not reserve one. */
export default function LoadingQuotationTypes() {
  return (
    <PageSkeleton action>
      <ListingSkeleton search={false} columns={5} />
    </PageSkeleton>
  );
}
