import { ListingSkeleton, PageSkeleton } from "@/components/page-skeleton";

/** The log is read, not worked in: no search box and nothing to add. */
export default function LoadingActivity() {
  return (
    <PageSkeleton>
      <ListingSkeleton search={false} rows={8} columns={5} />
    </PageSkeleton>
  );
}
