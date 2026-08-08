import "@/components/documents/document.css";

/**
 * Opening a quotation loads the document, its lines and its company profile, so
 * there is a beat between clicking Open on the listing and the sheet painting.
 *
 * The app's gold bones would be wrong here twice over: this route wears none of
 * the app shell, and what is coming is a piece of paper. So the fallback is that
 * paper, blank — the same 210×297mm sheet on the same backdrop, which is exactly
 * where the real one lands.
 */
export default function LoadingQuotationSheet() {
  return (
    <div className="q-page q-viewport" aria-busy="true">
      <div className="q-toolbar">
        <span className="q-toolbar-note" role="status">
          Preparing the document…
        </span>
      </div>

      <article className="q-sheet" />
    </div>
  );
}
