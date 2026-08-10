import "@/components/decals/sheet.css";

/**
 * A blank sheet while the route resolves, for the same reason the quotation and
 * certificate sheets draw one: this route wears none of the app shell, and what
 * is coming is a piece of paper.
 */
export default function LoadingDecalSheet() {
  return (
    <div className="ds-page ds-fit" aria-busy="true">
      <p className="ds-note" role="status">
        Preparing the sheet…
      </p>
      <div className="ds-sheet" />
    </div>
  );
}
