import "@/components/documents/document.css";

/**
 * The same blank sheet the quotation's fallback draws, and for the same reason:
 * this route wears none of the app shell, and what is coming is a piece of
 * paper. See app/quotations/[id]/print/loading.tsx.
 */
export default function LoadingCertificateSheet() {
  return (
    <div className="q-page q-viewport" aria-busy="true">
      <div className="q-toolbar">
        <span className="q-toolbar-note" role="status">
          Preparing the certificate…
        </span>
      </div>

      <article className="q-sheet" />
    </div>
  );
}
