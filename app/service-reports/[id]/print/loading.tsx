import "@/components/documents/document.css";

/**
 * The same blank sheet the quotation's and the certificate's fallbacks draw, and
 * for the same reason: this route wears none of the app shell, and what is
 * coming is a piece of paper. See app/quotations/[id]/print/loading.tsx.
 */
export default function LoadingServiceReportSheet() {
  return (
    <div className="q-page q-viewport" aria-busy="true">
      <div className="q-toolbar">
        <span className="q-toolbar-note" role="status">
          Preparing the service report…
        </span>
      </div>

      <article className="q-sheet" />
    </div>
  );
}
