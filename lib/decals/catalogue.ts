/*
 * The cylinder decals Reydex prints — the label stuck to the extinguisher body.
 *
 * Held as data in code rather than in the database, unlike the rest of the app.
 * There are four of them, they change when the artwork or a licence number
 * changes rather than in the course of a day's work, and self-service editing
 * would mean an artwork upload path this app does not otherwise need. Adding a
 * fifth chemical is an entry in `DECALS` plus, at most, a new wordmark in
 * `public/decals/`.
 *
 * The wording, the specification lines and the licence numbers are transcribed
 * from the four source documents in `Documents/reydex/decals/`. Everything the
 * four have in common is a shared constant below, which is the point: the
 * originals disagree with each other in small ways because each was patched from
 * a copy of the last.
 *
 * Two transcriptions are reproduced as printed and are worth an operator's eye
 * before a long run — see AFFF's `chemicalContent` and the note on `fireClasses`.
 */

export type FireClassKey = "A" | "B" | "C";

export type FireClass = {
  key: FireClassKey;
  /** Struck through with a prohibition mark, as AFFF's electrical class is. */
  prohibited?: boolean;
};

/** Which small print sits under the fire-class row. The originals differ. */
export type Footnote = "recharge-materials" | "residential";

export type DecalWordmark = "red" | "green" | "blue";

export type Decal = {
  slug: string;
  /** Large line in the title band, e.g. "DRY CHEMICAL". */
  title: string;
  /** Smaller line beneath it, e.g. "STORED PRESSURE TYPE". */
  subtitle: string;
  /** How the title band is drawn: ink on white, or reversed out of a colour. */
  band: "red-on-white" | "green-on-white" | "white-on-navy";
  wordmark: DecalWordmark;
  /** Lines printed under "CHEMICAL CONTENT". */
  chemicalContent: string[];
  /** Printed as "FIRE RATING <value>" when the source decal carries one. */
  fireRating?: string;
  fireClasses: FireClass[];
  footnote: Footnote;
  /** Bureau of Product Standards licence, printed on the certification badge. */
  licenceNo: string;
  /** Shown on the dashboard so an operator can tell them apart at a glance. */
  summary: string;
};

/* -------------------------------------------------------------------------- */
/* Shared wording                                                             */
/* -------------------------------------------------------------------------- */

/** Specification lines every decal carries below the chemical content. */
export const OPERATING_PRESSURE = "1344 kPa  AT 28°C";
export const TEST_PRESSURE = "2.5 MPa";
export const TEMP_RANGE = "- 40°C to +48°C";

export const WARNING_TEXT = "DANGEROUS TO USE OTHER THAN THE RECOMMENDED REFILL";

export const MAINTENANCE = [
  "INSPECT MONTHLY",
  "NOZZLE MUST BE UNOBSTRUCTED",
  "SAFETY PIN MUST BE INTACT",
  "IMMEDIATELY RECHARGE IF PRESSURE IS BELOW OPERABLE RANGE",
] as const;

export const CAUTION = [
  "DO NOT INCINERATE CONTENTS UNDER PRESSURE",
  "DO NOT PLACE EXTINGUISHER UNDER DIRECT SUNLIGHT OR IN WET PLACES",
  "KEEP AWAY FROM CHILDREN",
  "IMPROPER USE OF THIS APPLIANCE COULD CAUSE BODILY INJURY OR PROPERTY DAMAGED",
] as const;

export const FOOTNOTE_TEXT: Record<Footnote, string> = {
  "recharge-materials":
    "IT IS IMPORTANT THAT ONLY THOSE RECHARGING MATERIALS SPECIFIED ON THE EXTINGUISHER NAME PLATE BE USED. THE USE OF OTHER RECHARGING MATERIALS MAY IMPAIR THE EFFICIENCY/CAUSE MALFUNCTION OF THE EXTINGUISHER",
  residential: "FOR RESIDENTIAL AREAS AND/OR NON-RESIDENTIAL AREAS",
};

export const FIRE_CLASS_CAPTION: Record<FireClassKey, string> = {
  A: "TRASH WOOD PAPER",
  B: "LIQUID GREASE",
  C: "ELECTRICAL EQUIPMENT",
};

/** The manufacturer and distributor block along the foot of every decal. */
export const IMPRINT = {
  manufacturedBy: "Survivor Enterprises",
  distributedBy: "REYDEX FIRE EXTINGUISHER TRADING",
  mainAddress: "Main Add: #58-A Daang Pari St. P-4 San Pedro Hagonoy Bulacan",
  branchAddress: "Branch Add: P-2 Pag-asa St. Del Pilar Castillejos Zambales",
  phones: "Cell No.: 0933-334-7702  /  0906-841-5056  /  0949-658-4622  /  0955-042-4993",
  email: "Email Add: reydexservices@gmail.com",
} as const;

/** Every decal prints all three classes; AFFF strikes the electrical one. */
const ABC: FireClass[] = [{ key: "A" }, { key: "B" }, { key: "C" }];

/* -------------------------------------------------------------------------- */
/* The decals                                                                 */
/* -------------------------------------------------------------------------- */

export const DECALS: readonly Decal[] = [
  {
    slug: "dry-chemical",
    title: "DRY CHEMICAL",
    subtitle: "STORED PRESSURE TYPE",
    band: "red-on-white",
    wordmark: "red",
    chemicalContent: ["MONOAMMONIUM PHOSPHATE NH4H2 PO4"],
    fireClasses: ABC,
    footnote: "recharge-materials",
    licenceNo: "Q 0485",
    summary: "The general-purpose ABC unit — the one most jobs carry.",
  },
  {
    slug: "carbon-dioxide",
    title: "CARBON DIOXIDE",
    subtitle: "STORED PRESSURE TYPE",
    band: "red-on-white",
    wordmark: "red",
    chemicalContent: ["CARBON DIOXIDE", "CO₂"],
    fireClasses: ABC,
    footnote: "recharge-materials",
    licenceNo: "Q 0485",
    summary: "Clean agent for server rooms and switchgear.",
  },
  {
    slug: "hfc-236fa",
    title: "HFC 236FA",
    subtitle: "(HEXA FLUORO PROPANE)",
    band: "green-on-white",
    wordmark: "green",
    chemicalContent: ["HEXA FLUORO PROPANE C3H2F6"],
    fireRating: "2A-2BC",
    fireClasses: ABC,
    footnote: "residential",
    licenceNo: "Q 1265",
    summary: "Clean agent, non-conductive — the green-banded cylinder.",
  },
  {
    slug: "afff",
    title: "AFFF",
    subtitle: "FOAM (STORED PRESSURE TYPE)",
    band: "white-on-navy",
    wordmark: "blue",
    /*
     * Transcribed from the source decal exactly as it is printed today.
     *
     * Dichlorotrifluoroethane is HCFC-123, not AFFF: the AFFF artwork was patched
     * from a copy of the HCFC-123 decal and this line was left behind (the source
     * also misspells it "DICHLOUROTRIFLUOROETHANE"). It is reproduced rather than
     * silently corrected, because what a decal declares its cylinder to contain
     * is not a detail to guess at — but it almost certainly wants changing, and
     * this line is the only edit that takes.
     */
    chemicalContent: ["DICHLOUROTRIFLUOROETHANE"],
    fireClasses: [{ key: "A" }, { key: "B" }, { key: "C", prohibited: true }],
    footnote: "residential",
    licenceNo: "Q 1265",
    summary: "Foam unit — not for electrical fires, so class C is struck.",
  },
];

export function findDecal(slug: string): Decal | undefined {
  return DECALS.find((decal) => decal.slug === slug);
}
