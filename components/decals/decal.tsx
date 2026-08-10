import {
  CAUTION,
  FIRE_CLASS_CAPTION,
  FOOTNOTE_TEXT,
  IMPRINT,
  MAINTENANCE,
  OPERATING_PRESSURE,
  TEMP_RANGE,
  TEST_PRESSURE,
  WARNING_TEXT,
  type Decal,
} from "@/lib/decals/catalogue";
import { decalHeight } from "@/lib/decals/sheet";

/**
 * What an operator fills in per cylinder. All optional: left blank, the decal
 * prints the ruled space the shop writes on by hand today, which is still how
 * most of them are finished — the fields exist for a batch of identical units,
 * where typing the capacity once beats writing it forty times.
 */
export type DecalFill = {
  capacity?: string;
  fullWeight?: string;
  dateMfd?: string;
  serialNo?: string;
};

/**
 * One cylinder decal, drawn at true physical size.
 *
 * `widthMm` is the only size input: the height comes from the artwork's aspect
 * ratio and everything inside scales off the width (see `decal.css`). So the
 * same component prints the label for a 1 kg cylinder and for a 50 lb cart unit.
 *
 * The images are plain `<img>` rather than `next/image` on purpose. This is a
 * document destined for paper, not a page destined for a screen: the optimizer
 * would hand the browser a resampled variant chosen for CSS pixels, and at
 * 300 dpi that is exactly the resampling that makes a printed decal look soft.
 * These are small, already-cropped PNGs served straight from `public/`.
 */
export function DecalArtwork({
  decal,
  widthMm,
  fill,
}: {
  decal: Decal;
  widthMm: number;
  fill?: DecalFill;
}) {
  const heightMm = decalHeight(widthMm);

  return (
    <article
      className="decal"
      style={
        {
          "--decal-w": `${widthMm}mm`,
          "--decal-h": `${heightMm}mm`,
        } as React.CSSProperties
      }
      aria-label={`${decal.title} decal`}
    >
      <header className={`decal-band decal-band-${bandTone(decal.band)}`}>
        <p className="decal-title">{decal.title}</p>
        <p className="decal-subtitle">{decal.subtitle}</p>
      </header>

      <div className="decal-brand">
        {/* eslint-disable-next-line @next/next/no-img-element -- print fidelity; see the note above */}
        <img className="decal-crest" src="/decals/crest.png" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element -- print fidelity; see the note above */}
        <img
          className="decal-wordmark"
          src={`/decals/lion-${decal.wordmark}.png`}
          alt="Lion"
        />
      </div>

      <div className="decal-grid">
        <section className="decal-col decal-specs">
          <h2 className="decal-heading">SPECIFICATIONS</h2>

          <ul className="decal-list">
            <li>
              CHEMICAL CONTENT
              {decal.chemicalContent.map((line) => (
                <span key={line} className="decal-sub">
                  {line}
                </span>
              ))}
            </li>
            <li>
              CAPACITY
              <span className="decal-blank">{fill?.capacity ?? ""}</span>
              kg
            </li>
            <li>
              FULL WEIGHT OF FIRE EXTINGUISHER
              <span className="decal-blank decal-blank-wide">
                {fill?.fullWeight ?? ""}
              </span>
              kg
            </li>
            <li>
              OPERATING PRESSURE
              <span className="decal-sub">{OPERATING_PRESSURE}</span>
            </li>
            <li>
              TEST PRESSURE
              <span className="decal-sub">{TEST_PRESSURE}</span>
            </li>
            <li>
              OPERABLE TEMP RANGE
              <span className="decal-centred-sub">{TEMP_RANGE}</span>
            </li>
          </ul>

          {decal.fireRating ? (
            <p className="decal-rating">FIRE RATING {decal.fireRating}</p>
          ) : null}

          <div className="decal-warning">
            <p className="decal-warning-title">WARNING</p>
            <p className="decal-warning-text">{WARNING_TEXT}</p>
          </div>

          <p className="decal-recharge">“RECHARGE AFTER USE”</p>
          <p className="decal-origin">
            MADE IN THE
            <br />
            PHILIPPINES
          </p>
        </section>

        <section className="decal-col decal-centre">
          <h2 className="decal-operate-title">HOW TO OPERATE:</h2>

          {/* eslint-disable-next-line @next/next/no-img-element -- print fidelity; see the note above */}
          <img
            className="decal-operate"
            src="/decals/operate.png"
            alt="Pull the pin, aim at the base of the fire, squeeze the handle, sweep from side to side"
          />

          <div className="decal-classes">
            {decal.fireClasses.map((fireClass) => {
              const struck = fireClass.prohibited ? " decal-struck" : "";
              return (
                <div className="decal-class" key={fireClass.key}>
                  <span className={`decal-class-letter${struck}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- print fidelity; see the note above */}
                    <img
                      src={`/decals/letter-${fireClass.key.toLowerCase()}.png`}
                      alt={
                        fireClass.prohibited
                          ? `Not for class ${fireClass.key} fires`
                          : `Class ${fireClass.key}`
                      }
                    />
                  </span>
                  <span className="decal-class-caption">
                    {FIRE_CLASS_CAPTION[fireClass.key]}
                  </span>
                  <span className={`decal-class-tile${struck}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- print fidelity; see the note above */}
                    <img
                      src={`/decals/tile-${fireClass.key.toLowerCase()}.png`}
                      alt=""
                    />
                  </span>
                </div>
              );
            })}
          </div>

          <p
            className={
              decal.footnote === "residential"
                ? "decal-footnote decal-footnote-residential"
                : "decal-footnote"
            }
          >
            {decal.footnote === "residential"
              ? `“${FOOTNOTE_TEXT.residential}”`
              : FOOTNOTE_TEXT[decal.footnote]}
          </p>
        </section>

        <section className="decal-col decal-maint">
          <h2 className="decal-heading">MAINTENANCE</h2>

          <ul className="decal-list">
            {MAINTENANCE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <p className="decal-caution">CAUTION:</p>

          <ul className="decal-list">
            {CAUTION.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <div className="decal-stamps">
            <p className="decal-stamp">
              Date MFd.
              <span className="decal-stamp-value">{fill?.dateMfd ?? ""}</span>
            </p>
            <p className="decal-stamp">
              Serial No.
              <span className="decal-stamp-value">{fill?.serialNo ?? ""}</span>
            </p>
          </div>
        </section>
      </div>

      <footer className="decal-foot">
        {/* eslint-disable-next-line @next/next/no-img-element -- print fidelity; see the note above */}
        <img
          className="decal-foot-mark"
          src="/images/Logo%20text%20no%20outline.png"
          alt=""
        />

        <div className="decal-imprint">
          <p className="decal-imprint-line">
            Manufactured by:{" "}
            <span className="decal-imprint-strong">
              {IMPRINT.manufacturedBy}
            </span>
          </p>
          <p className="decal-imprint-line">Distributed by:</p>
          <p className="decal-distributor">{IMPRINT.distributedBy}</p>
          <p className="decal-address">
            {IMPRINT.mainAddress}
            <br />
            {IMPRINT.branchAddress}
            <br />
            {IMPRINT.phones}
            <br />
            {IMPRINT.email}
          </p>
        </div>

        <div className="decal-badge">
          {/* eslint-disable-next-line @next/next/no-img-element -- print fidelity; see the note above */}
          <img src="/decals/certified.png" alt="" />
          <p className="decal-licence">CERTIFIED</p>
          <p className="decal-licence">Product Quality</p>
          <p className="decal-licence">LIC - NO: {decal.licenceNo}</p>
        </div>
      </footer>
    </article>
  );
}

/** `red-on-white` → `red`, so the band's colour is one class suffix. */
function bandTone(band: Decal["band"]): "red" | "green" | "navy" {
  if (band === "green-on-white") return "green";
  if (band === "white-on-navy") return "navy";
  return "red";
}
