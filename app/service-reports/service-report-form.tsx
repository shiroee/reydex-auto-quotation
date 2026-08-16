"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { LuPlus, LuX } from "react-icons/lu";

import {
  FIELD,
  checklistFieldName,
  type ServiceReportFormState,
} from "@/lib/service-reports/form";
import {
  CHECKLIST_GROUPS,
  CHECKLIST_MARKS,
  MARK_GLYPH,
  MARK_LABEL,
  PANEL_TYPES,
  PANEL_TYPE_LABEL,
  SERVICE_REPORT_KINDS,
  SERVICE_REPORT_KIND_LABEL,
  type ChecklistMark,
  type LineSeverity,
  type PanelType,
  type ServiceReportChecklist,
  type ServiceReportEquipment,
  type ServiceReportKind,
  type ServiceReportLine,
} from "@/lib/service-reports/report";
import type { ServiceReportRecord } from "@/lib/service-reports/service";

import {
  createServiceReportAction,
  updateServiceReportAction,
} from "./actions";
import {
  PlateEditor,
  blankPlate,
  platesFromRecord,
  type PlateDraft,
} from "./plate-editor";

/**
 * Add / edit form for an FDAS service report.
 *
 * Four of its six sections repeat, so unlike the certificate form this one holds
 * state: the equipment table, the checklist, the findings and the
 * recommendations are React state, submitted as parallel repeated fields in
 * document order — the arrangement `LineItemsField` uses, and the one
 * `parseServiceReportForm` reads back.
 *
 * The checklist deliberately starts with nothing selected. Every other default
 * in this app fills a blank with something harmless; a checklist pre-set to
 * "passes inspection" would instead have the printed sheet assert that thirteen
 * things were tested and found sound before anybody looked at them.
 */

/** Stable React keys for the repeating rows; not submitted. See `LineItemsField`. */
let nextKey = 1;

type EquipmentRow = ServiceReportEquipment & { key: number };
/** A row of the checklist report's "Action Taken / Findings" table. */
type LineRow = ServiceReportLine & { key: number };
type RecommendationRow = { key: number; text: string };

function blankEquipment(): EquipmentRow {
  return {
    key: nextKey++,
    model: "",
    brand: "",
    location: "",
    detectors: "",
    manualPulls: "",
    bellsStrobes: "",
  };
}

function blankLine(): LineRow {
  return { key: nextKey++, action: "", finding: "", severity: "note" };
}

function blankRecommendation(): RecommendationRow {
  return { key: nextKey++, text: "" };
}

/** Seeds a repeating section, always leaving one spare row to type into. */
function seed<T extends { key: number }>(rows: T[], blank: () => T): T[] {
  return rows.length > 0 ? [...rows, blank()] : [blank(), blank()];
}

/** The same, for the three bullet lists, which are all one string per row. */
function seedBullets(items: string[] | undefined): RecommendationRow[] {
  return seed(
    (items ?? []).map((text) => ({ key: nextKey++, text })),
    blankRecommendation,
  );
}

export function ServiceReportForm({
  report,
  today,
}: {
  report?: ServiceReportRecord;
  /** Today in Manila, for a new report's date. See lib/quotations/dates. */
  today: string;
}) {
  const isEdit = report !== undefined;

  const [state, formAction, isPending] = useActionState<
    ServiceReportFormState | null,
    FormData
  >(isEdit ? updateServiceReportAction : createServiceReportAction, null);

  /*
   * A rejected submit wins over the stored row, for the same reason the
   * certificate form echoes its values: React resets the form once the action
   * settles, and without this the repeating sections would snap back to what was
   * loaded and quietly discard the edit.
   */
  const submitted = state?.values;

  /*
   * Which of the two reports this is. Unlike a certificate's kind this stays
   * editable: the reference does not name the document, and both are raised for
   * one visit, so picking the wrong one is an ordinary slip to correct. What it
   * costs is warned about below — the other kind's body is not kept.
   */
  const [kind, setKind] = useState<ServiceReportKind>(
    submitted?.kind ?? report?.kind ?? "checklist",
  );
  const isPhoto = kind === "photo_report";

  const [panelType, setPanelType] = useState<PanelType>(
    submitted?.panelType ?? report?.panelType ?? "conventional",
  );

  const [equipment, setEquipment] = useState<EquipmentRow[]>(() =>
    seed(
      (submitted?.equipment ?? report?.equipment ?? []).map((row) => ({
        ...row,
        key: nextKey++,
      })),
      blankEquipment,
    ),
  );

  const [checklist, setChecklist] = useState<ServiceReportChecklist>(
    () => submitted?.checklist ?? report?.checklist ?? {},
  );

  const [lines, setLines] = useState<LineRow[]>(() =>
    seed(
      (submitted?.lines ?? report?.lines ?? []).map((line) => ({
        ...line,
        key: nextKey++,
      })),
      blankLine,
    ),
  );

  const [recommendations, setRecommendations] = useState<RecommendationRow[]>(
    () => seedBullets(submitted?.recommendations ?? report?.recommendations),
  );

  const [findings, setFindings] = useState<RecommendationRow[]>(() =>
    seedBullets(submitted?.findings ?? report?.findings),
  );

  const [activities, setActivities] = useState<RecommendationRow[]>(() =>
    seedBullets(submitted?.activities ?? report?.activities),
  );

  /*
   * Plates survive a rejected submit whole: the photographs were uploaded when
   * they were picked, so by this point a plate is a caption and some paths.
   */
  const [plates, setPlates] = useState<PlateDraft[]>(() => {
    const stored = platesFromRecord(submitted?.plates ?? report?.plates ?? []);
    return stored.length > 0 ? stored : [blankPlate()];
  });

  /** Scalar fields fall back the same way: submission, then row, then blank. */
  function initial(
    field:
      | "customerName"
      | "address"
      | "projectTitle"
      | "systemDescription"
      | "otherEquipment"
      | "servicedByName"
      | "servicedByTitle"
      | "notedByName",
  ): string {
    return submitted?.[field] ?? report?.[field] ?? "";
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {isEdit ? (
        <input type="hidden" name={FIELD.id} value={report.id} />
      ) : null}

      {/* Always rendered so screen readers announce errors on submit. */}
      <div aria-live="polite" aria-atomic="true">
        {state?.formError ? (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200"
          >
            {state.formError}
          </p>
        ) : null}
      </div>

      <Section
        title="Document"
        blurb={
          isEdit
            ? "Both reports cover the same visit. Switching between them keeps the particulars and the recommendations, and discards the rest — including any photos on a photo report."
            : "Both reports are raised after the same visit, and both can be changed later."
        }
      >
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Kind of report</legend>

          {SERVICE_REPORT_KINDS.map((candidate) => (
            <KindChoice
              key={candidate}
              value={candidate}
              checked={kind === candidate}
              onSelect={setKind}
              title={SERVICE_REPORT_KIND_LABEL[candidate]}
              detail={
                candidate === "photo_report"
                  ? "Findings, activities and recommendations in prose, evidenced by plates of site photographs. Runs to several pages."
                  : "The ruled FDAS maintenance form: equipment serviced, the thirteen-point component checklist, and an action-taken table. One page."
              }
            />
          ))}
        </fieldset>
      </Section>

      <Section title="The visit">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label={isPhoto ? "Client" : "Customer"}
              error={state?.errors?.customerName}
              required
            >
              <input
                name={FIELD.customerName}
                defaultValue={initial("customerName")}
                autoFocus={!isEdit}
                aria-invalid={state?.errors?.customerName ? "true" : undefined}
                placeholder="SHOPPERS SAVER GROCERY"
                className={FIELD_CLASS}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Address" error={state?.errors?.address} required>
              <input
                name={FIELD.address}
                defaultValue={initial("address")}
                aria-invalid={state?.errors?.address ? "true" : undefined}
                placeholder="Brgy. Baraca Camachile Subic, Zambales"
                className={FIELD_CLASS}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label={isPhoto ? "Subject" : "Project"}
              error={state?.errors?.projectTitle}
              hint={
                isPhoto
                  ? "Printed after “SUBJECT:”, in capitals as typed"
                  : "What the visit was for, as printed after “Project:”"
              }
              required
            >
              <input
                name={FIELD.projectTitle}
                defaultValue={initial("projectTitle")}
                aria-invalid={state?.errors?.projectTitle ? "true" : undefined}
                placeholder={
                  isPhoto
                    ? "ONE-TIME PREVENTIVE MAINTENANCE OF FIRE DETECTION AND ALARM SYSTEM"
                    : "Preventive Maintenance of Fire Detection and Alarm System (FDAS)"
                }
                className={FIELD_CLASS}
              />
            </Field>
          </div>

          {/* The System line belongs to the checklist's particulars alone. */}
          {isPhoto ? null : (
            <Field
              label="System"
              error={state?.errors?.systemDescription}
              required
            >
              <input
                name={FIELD.systemDescription}
                defaultValue={initial("systemDescription")}
                aria-invalid={
                  state?.errors?.systemDescription ? "true" : undefined
                }
                placeholder="Conventional Fire Detection and Alarm System"
                className={FIELD_CLASS}
              />
            </Field>
          )}

          <Field
            label="Date of service"
            error={state?.errors?.serviceDate}
            required
          >
            <input
              name={FIELD.serviceDate}
              type="date"
              defaultValue={
                submitted?.serviceDate ?? report?.serviceDate ?? today
              }
              aria-invalid={state?.errors?.serviceDate ? "true" : undefined}
              className={FIELD_CLASS}
            />
          </Field>
        </div>
      </Section>

      {/* ---- Checklist report only ---- */}

      {isPhoto ? null : (
        <>
      <Section
        title="Equipment serviced"
        blurb="One row per panel. The three counts print exactly as typed, so keep their units — “SD - 16 Units”, “2 UNITS”."
      >
        {state?.errors?.equipment ? (
          <p role="alert" className="mb-3 text-xs text-red-300">
            {state.errors.equipment}
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          {equipment.map((row, index) => (
            <div
              key={row.key}
              className="rounded-xl border border-gold-500/12 p-3.5"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-gold-100/35">
                  Panel {index + 1}
                </span>
                <RemoveRowButton
                  label={`Remove panel ${index + 1}`}
                  onClick={() =>
                    setEquipment((rows) =>
                      rows.filter((candidate) => candidate.key !== row.key),
                    )
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <SubField label="Model">
                  <input
                    name={FIELD.equipmentModel}
                    defaultValue={row.model}
                    placeholder="AW-CFP2166-4"
                    className={FIELD_CLASS}
                  />
                </SubField>
                <SubField label="Brand">
                  <input
                    name={FIELD.equipmentBrand}
                    defaultValue={row.brand}
                    placeholder="ASENWARE"
                    className={FIELD_CLASS}
                  />
                </SubField>
                <SubField label="Location">
                  <input
                    name={FIELD.equipmentLocation}
                    defaultValue={row.location}
                    placeholder="ALL FLOORS"
                    className={FIELD_CLASS}
                  />
                </SubField>
                <SubField label="No. detector">
                  <input
                    name={FIELD.equipmentDetectors}
                    defaultValue={row.detectors}
                    placeholder="SD - 16 Units"
                    className={FIELD_CLASS}
                  />
                </SubField>
                <SubField label="No. manual pull">
                  <input
                    name={FIELD.equipmentManualPulls}
                    defaultValue={row.manualPulls}
                    placeholder="2 UNITS"
                    className={FIELD_CLASS}
                  />
                </SubField>
                <SubField label="No. bell / horn strobe">
                  <input
                    name={FIELD.equipmentBellsStrobes}
                    defaultValue={row.bellsStrobes}
                    placeholder="2 UNITS"
                    className={FIELD_CLASS}
                  />
                </SubField>
              </div>
            </div>
          ))}
        </div>

        <AddRowButton
          onClick={() => setEquipment((rows) => [...rows, blankEquipment()])}
        >
          Add a panel
        </AddRowButton>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field
            label="Others"
            error={state?.errors?.otherEquipment}
            hint="The free row under the equipment table"
          >
            <input
              name={FIELD.otherEquipment}
              defaultValue={initial("otherEquipment")}
              aria-invalid={state?.errors?.otherEquipment ? "true" : undefined}
              className={FIELD_CLASS}
            />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-gold-100/90">
              Panel type
            </legend>
            {/*
             * Both words are printed on the sheet and the one that applies is
             * ticked, so this is a choice between two rather than a checkbox.
             */}
            <div className="flex gap-2">
              {PANEL_TYPES.map((type) => (
                <label
                  key={type}
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm transition ${
                    panelType === type
                      ? "border-gold-500/60 bg-gold-500/10 font-semibold text-gold-100"
                      : "border-gold-500/15 text-gold-100/60 hover:border-gold-500/35"
                  }`}
                >
                  <input
                    type="radio"
                    name={FIELD.panelType}
                    value={type}
                    checked={panelType === type}
                    onChange={() => setPanelType(type)}
                    className="peer sr-only"
                  />
                  <span className="peer-focus-visible:underline">
                    {PANEL_TYPE_LABEL[type]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Section>

      <Section
        title="Component checklist"
        blurb="Anything you leave unmarked prints as an empty box, the way it would on the paper form — it is not recorded as a pass."
      >
        <div className="flex flex-col gap-6">
          {CHECKLIST_GROUPS.map((group) => (
            <fieldset key={group.title}>
              <legend className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-gold-100/45">
                {group.title}
              </legend>

              <div className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col gap-2 rounded-lg border border-gold-500/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-gold-100/85">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="mt-0.5 block text-xs leading-snug text-gold-100/35">
                          {item.description}
                        </span>
                      ) : null}
                    </span>

                    <MarkChoice
                      itemKey={item.key}
                      itemLabel={item.label}
                      mark={checklist[item.key]}
                      onSelect={(next) =>
                        setChecklist((marks) => ({
                          ...marks,
                          [item.key]: next,
                        }))
                      }
                      onClear={() =>
                        setChecklist((marks) => {
                          // Deleted rather than set to undefined: the map is
                          // stored as `jsonb`, and an explicit null would read
                          // back as an answer rather than as an unmarked item.
                          const rest = { ...marks };
                          delete rest[item.key];
                          return rest;
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </Section>

      <Section
        title="Action taken & findings"
        blurb="Two independent columns, printed as typed. A row with only an action is an area heading (“A. Ground Floor: (Zone 1)”); a row with only a finding hangs a defect under the heading above it."
      >
        {state?.errors?.lines ? (
          <p role="alert" className="mb-3 text-xs text-red-300">
            {state.errors.lines}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          {lines.map((row, index) => (
            <div
              key={row.key}
              className="rounded-xl border border-gold-500/12 p-3.5"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-gold-100/35">
                  Row {index + 1}
                </span>
                <RemoveRowButton
                  label={`Remove row ${index + 1}`}
                  onClick={() =>
                    setLines((rows) =>
                      rows.filter((candidate) => candidate.key !== row.key),
                    )
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SubField label="Action taken">
                  <textarea
                    name={FIELD.lineAction}
                    defaultValue={row.action}
                    rows={2}
                    placeholder="Smoke Detectors - 9 Units   MPS - 1 Unit   Alarm Bell - 1 Unit"
                    className={`${FIELD_CLASS} resize-y`}
                  />
                </SubField>
                <SubField label="Finding">
                  <textarea
                    name={FIELD.lineFinding}
                    defaultValue={row.finding}
                    rows={2}
                    placeholder="Batteries were busted."
                    className={`${FIELD_CLASS} resize-y`}
                  />
                </SubField>
              </div>

              {/*
               * Submitted for every row so the three columns stay aligned — the
               * parser reads them positionally.
               */}
              <label className="mt-2.5 inline-flex items-center gap-2 text-xs text-gold-100/60">
                <input
                  type="checkbox"
                  checked={row.severity === "defect"}
                  onChange={(event) =>
                    setLines((rows) =>
                      rows.map((candidate) =>
                        candidate.key === row.key
                          ? {
                              ...candidate,
                              severity: (event.target.checked
                                ? "defect"
                                : "note") satisfies LineSeverity,
                            }
                          : candidate,
                      ),
                    )
                  }
                  className="size-4 accent-red-400"
                />
                Print this finding in red as a defect
              </label>
              <input
                type="hidden"
                name={FIELD.lineSeverity}
                value={row.severity}
              />
            </div>
          ))}
        </div>

        <AddRowButton
          onClick={() => setLines((rows) => [...rows, blankLine()])}
        >
          Add a row
        </AddRowButton>
      </Section>
        </>
      )}

      {/* ---- Photo report only ---- */}

      {isPhoto ? (
        <>
          <BulletSection
            title="Findings"
            blurb="What the visit found, one line each — printed under “FINDINGS:”."
            name={FIELD.finding}
            placeholder="Batteries were already drained and defective"
            rows={findings}
            setRows={setFindings}
            error={state?.errors?.findings}
          />

          <BulletSection
            title="Activities done"
            blurb="What was carried out, one line each — printed under “ACTIVITIES DONE:”."
            name={FIELD.activity}
            placeholder="Check and test the voltage reading of the batteries."
            rows={activities}
            setRows={setActivities}
            error={state?.errors?.activities}
          />

          <Section
            title="Photo plates"
            blurb="Each plate prints its photos above a captioned box. The first plate is printed before the findings, as the panel’s existing condition; the rest follow the recommendations. Photos are resized in your browser before they upload, so shooting at full resolution is fine."
          >
            <PlateEditor
              plates={plates}
              setPlates={setPlates}
              error={state?.errors?.plates}
            />
          </Section>
        </>
      ) : null}

      {/* The one body section both documents print, under the same heading. */}
      <BulletSection
        title="Recommendations"
        blurb="One per line, printed in order. Left empty, the section is dropped from the sheet."
        name={FIELD.recommendation}
        placeholder="Replace the Batteries of the Fire Alarm Control Panel"
        rows={recommendations}
        setRows={setRecommendations}
        error={state?.errors?.recommendations}
      />

      {/*
       * The checklist sheet carries the two signature blocks. The photo report
       * has none on the original — it is a record left with the client rather
       * than a document countersigned on site — so the fields are not offered
       * for it, in the same way the certificate form hides what its other kind
       * does not print.
       */}
      {isPhoto ? null : (
      <Section
        title="Signatures"
        blurb="All three are optional. Leave who serviced the system blank to print whoever the company profile names, and the owner's representative blank to print an empty rule to sign on site."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Serviced by" error={state?.errors?.servicedByName}>
            <input
              name={FIELD.servicedByName}
              defaultValue={initial("servicedByName")}
              aria-invalid={state?.errors?.servicedByName ? "true" : undefined}
              placeholder="Engr. Bryan A. Lalap"
              className={FIELD_CLASS}
            />
          </Field>

          <Field label="Title" error={state?.errors?.servicedByTitle}>
            <input
              name={FIELD.servicedByTitle}
              defaultValue={initial("servicedByTitle")}
              aria-invalid={state?.errors?.servicedByTitle ? "true" : undefined}
              placeholder="Registered Mechanical Engineer (RME)"
              className={FIELD_CLASS}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Noted by owner or representative"
              error={state?.errors?.notedByName}
              hint="Usually left blank — the sheet is countersigned on site"
            >
              <input
                name={FIELD.notedByName}
                defaultValue={initial("notedByName")}
                aria-invalid={state?.errors?.notedByName ? "true" : undefined}
                className={FIELD_CLASS}
              />
            </Field>
          </div>
        </div>
      </Section>
      )}

      {/* Stacked on a phone, submit full-width — see the certificate form. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <Link
          href="/service-reports"
          className="order-2 text-center text-sm text-gold-100/50 underline-offset-2 hover:text-gold-100 hover:underline sm:order-1"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="reydex-submit order-1 inline-flex h-11 w-full items-center justify-center rounded-lg px-6 text-sm font-semibold tracking-wide sm:order-2 sm:w-auto"
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Save report"}
        </button>
      </div>
    </form>
  );
}

const FIELD_CLASS =
  "reydex-field w-full min-w-0 rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25";

/**
 * One of the two reports, as a card-sized radio.
 *
 * The same control the certificate form uses, and for the same reasons: a real
 * radio gives arrow-key navigation, one tab stop and a form value for free, and
 * `sr-only` rather than `display: none` keeps it in the accessibility tree along
 * with the focus ring the card draws from `peer-focus-visible`.
 */
function KindChoice({
  value,
  checked,
  onSelect,
  title,
  detail,
}: {
  value: ServiceReportKind;
  checked: boolean;
  onSelect: (kind: ServiceReportKind) => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 transition ${
        checked
          ? "border-gold-500/60 bg-gold-500/10"
          : "border-gold-500/15 hover:border-gold-500/35"
      }`}
    >
      <input
        type="radio"
        name={FIELD.kind}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="peer sr-only"
      />
      <span className="text-sm font-semibold text-gold-100 peer-focus-visible:underline">
        {title}
      </span>
      <span className="text-xs leading-relaxed text-gold-100/45">{detail}</span>
    </label>
  );
}

/**
 * A section holding one bullet list — findings, activities, recommendations.
 *
 * All three are the same control over the same shape, differing only in their
 * field name and their example, so they are one component. Written out three
 * times they would be three places to fix the day the remove button needs a
 * larger hit area.
 */
function BulletSection({
  title,
  blurb,
  name,
  placeholder,
  rows,
  setRows,
  error,
}: {
  title: string;
  blurb: string;
  name: string;
  placeholder: string;
  rows: RecommendationRow[];
  setRows: React.Dispatch<React.SetStateAction<RecommendationRow[]>>;
  error?: string;
}) {
  return (
    <Section title={title} blurb={blurb}>
      {error ? (
        <p role="alert" className="mb-3 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {rows.map((row, index) => (
          <div key={row.key} className="flex items-center gap-2.5">
            <input
              name={name}
              defaultValue={row.text}
              aria-label={`${title} ${index + 1}`}
              placeholder={placeholder}
              className={FIELD_CLASS}
            />
            <RemoveRowButton
              label={`Remove ${title.toLowerCase()} ${index + 1}`}
              onClick={() =>
                setRows((current) =>
                  current.filter((candidate) => candidate.key !== row.key),
                )
              }
            />
          </div>
        ))}
      </div>

      <AddRowButton
        onClick={() => setRows((current) => [...current, blankRecommendation()])}
      >
        Add a line
      </AddRowButton>
    </Section>
  );
}

/**
 * One item's mark, as a three-way radio group plus a way back to unmarked.
 *
 * Real `<input type="radio">`s rather than styled buttons: arrow-key navigation
 * within the group, a single tab stop, and a form value, all for free. Clearing
 * matters as much as choosing — a mark set by mistake has to be removable, and
 * an unmarked item is a distinct state rather than the absence of one.
 */
function MarkChoice({
  itemKey,
  itemLabel,
  mark,
  onSelect,
  onClear,
}: {
  itemKey: string;
  itemLabel: string;
  mark: ChecklistMark | undefined;
  onSelect: (mark: ChecklistMark) => void;
  onClear: () => void;
}) {
  const name = checklistFieldName(itemKey);

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {CHECKLIST_MARKS.map((candidate) => (
        <label
          key={candidate}
          title={MARK_LABEL[candidate]}
          className={`flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-md border px-2 text-sm font-semibold transition ${
            mark === candidate
              ? candidate === "service"
                ? "border-red-400/60 bg-red-500/15 text-red-200"
                : "border-gold-500/60 bg-gold-500/12 text-gold-100"
              : "border-gold-500/15 text-gold-100/40 hover:border-gold-500/35"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={candidate}
            checked={mark === candidate}
            onChange={() => onSelect(candidate)}
            className="peer sr-only"
          />
          {/* The glyph is decorative; the legend beside it names the mark. */}
          <span aria-hidden className="peer-focus-visible:underline">
            {MARK_GLYPH[candidate]}
          </span>
          <span className="sr-only">
            {itemLabel} — {MARK_LABEL[candidate]}
          </span>
        </label>
      ))}

      <button
        type="button"
        onClick={onClear}
        disabled={mark === undefined}
        aria-label={`Clear the mark on “${itemLabel}”`}
        className="flex h-9 w-7 items-center justify-center rounded-md text-gold-100/35 transition-colors hover:text-gold-100 disabled:opacity-25 disabled:hover:text-gold-100/35"
      >
        <LuX aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="reydex-card rounded-2xl p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gold-500/80">
        {title}
      </h2>
      {blurb ? (
        <p className="mb-5 mt-2 text-sm leading-relaxed text-gold-100/45">
          {blurb}
        </p>
      ) : (
        <div className="mb-5" />
      )}
      {children}
    </section>
  );
}

function AddRowButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-gold-500/25 px-3 text-xs font-medium text-gold-100/70 transition-colors hover:border-gold-400/45 hover:text-gold-100"
    >
      <LuPlus aria-hidden className="size-3.5" />
      {children}
    </button>
  );
}

function RemoveRowButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-7 items-center justify-center rounded-md text-gold-100/35 transition-colors hover:text-red-300"
    >
      <LuX aria-hidden className="size-3.5" />
    </button>
  );
}

function Field({
  label,
  hint,
  error,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gold-100/90">
        {label}
        {required ? <span className="ml-1 text-gold-500/70">*</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="text-xs text-red-300">
          {error}
        </span>
      ) : hint ? (
        <span className="truncate text-xs text-gold-100/30">{hint}</span>
      ) : null}
    </label>
  );
}

/** A field inside a repeating row: quieter label, no required marker. */
function SubField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-gold-100/40">
        {label}
      </span>
      {children}
    </label>
  );
}
