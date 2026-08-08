import { FormSkeleton, PageSkeleton } from "@/components/page-skeleton";

/*
 * Its own fallback rather than the listing's: `app/quotations/loading.tsx` would
 * otherwise cover this route too, and table bones where a form is about to
 * appear are worse than none — the placeholder would have to be thrown away and
 * relaid the moment the page arrives.
 */
export default function LoadingNewQuotation() {
  return (
    <PageSkeleton width="max-w-3xl">
      <FormSkeleton fields={7} />
    </PageSkeleton>
  );
}
