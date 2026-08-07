import { describe, expect, it } from "vitest";

import {
  ACTION_LABEL,
  actorLabel,
  describeActivity,
  entityHref,
  formatDate,
  formatRelativeTime,
  formatTimestamp,
  isActivityEntityName,
} from "./format";

describe("isActivityEntityName", () => {
  it("accepts the five entities the dashboards cover", () => {
    for (const name of [
      "quotation",
      "customer",
      "item",
      "quotation_type",
      "user",
    ]) {
      expect(isActivityEntityName(name), name).toBe(true);
    }
  });

  it("rejects anything else, so a crafted ?of= cannot reach the query", () => {
    for (const name of ["", "quotations", "Customer", "price", null, 7]) {
      expect(isActivityEntityName(name), String(name)).toBe(false);
    }
  });
});

describe("entityHref", () => {
  it("points at where each record is edited", () => {
    const id = "11111111-1111-4111-8111-111111111111";

    expect(entityHref("customer", id, "update")).toBe(`/customers/${id}/edit`);
    expect(entityHref("item", id, "update")).toBe(`/items/${id}/edit`);
    expect(entityHref("quotation_type", id, "update")).toBe(
      `/quotation-types/${id}/edit`,
    );
    expect(entityHref("user", id, "update")).toBe(`/users/${id}/edit`);
  });

  it("sends a quotation to its printable document", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(entityHref("quotation", id, "create")).toBe(
      `/quotations/${id}/print`,
    );
  });

  it("gives a deleted record no link — there is nothing left to open", () => {
    const id = "33333333-3333-4333-8333-333333333333";

    for (const entity of ["quotation", "customer", "item", "user"] as const) {
      expect(entityHref(entity, id, "delete"), entity).toBeNull();
    }
  });
});

describe("actorLabel", () => {
  it("prefers the name", () => {
    expect(
      actorLabel({ actorName: "Juan Dela Cruz", actorEmail: "juan@reydex.com" }),
    ).toBe("Juan Dela Cruz");
  });

  it("falls back to the email when the name is missing or blank", () => {
    expect(actorLabel({ actorName: null, actorEmail: "juan@reydex.com" })).toBe(
      "juan@reydex.com",
    );
    expect(actorLabel({ actorName: "   ", actorEmail: "juan@reydex.com" })).toBe(
      "juan@reydex.com",
    );
  });

  it("names the scripts that write without a session", () => {
    expect(actorLabel({})).toBe("System");
    expect(actorLabel({ actorName: null, actorEmail: null })).toBe("System");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-08T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("reads as “just now” inside the first minute", () => {
    expect(formatRelativeTime(ago(0), now)).toBe("just now");
    expect(formatRelativeTime(ago(59_000), now)).toBe("just now");
  });

  it("counts minutes, then hours, then days", () => {
    expect(formatRelativeTime(ago(60_000), now)).toBe("1m ago");
    expect(formatRelativeTime(ago(45 * 60_000), now)).toBe("45m ago");
    expect(formatRelativeTime(ago(60 * 60_000), now)).toBe("1h ago");
    expect(formatRelativeTime(ago(23 * 3_600_000), now)).toBe("23h ago");
    expect(formatRelativeTime(ago(24 * 3_600_000), now)).toBe("1d ago");
    expect(formatRelativeTime(ago(6 * 24 * 3_600_000), now)).toBe("6d ago");
  });

  it("switches to a date once a week has passed", () => {
    // Past a week the hour stops mattering and the date is more use.
    expect(formatRelativeTime(new Date("2026-07-20T09:30:00Z"), now)).toBe(
      "Jul 20, 2026",
    );
  });

  it("does not print a negative age when the clock is skewed ahead", () => {
    expect(formatRelativeTime(new Date("2026-08-08T12:00:30Z"), now)).toBe(
      "just now",
    );
  });
});

describe("formatDate", () => {
  /*
   * The reason this is pinned to Asia/Manila rather than the server's zone:
   * 23:00 UTC is already 07:00 the next morning in Manila, and the server runs
   * in UTC. Formatting locally would file the whole Philippine morning under
   * yesterday — the same trap `todayInQuoteZone` exists to avoid.
   */
  it("dates an entry by the Philippine day, not the server's", () => {
    expect(formatDate(new Date("2026-08-07T23:30:00Z"))).toBe("Aug 8, 2026");
    expect(formatDate(new Date("2026-08-08T15:00:00Z"))).toBe("Aug 8, 2026");
  });
});

describe("formatTimestamp", () => {
  it("gives the full date and time for the tooltip", () => {
    // 04:05 UTC is 12:05 in Manila.
    expect(formatTimestamp(new Date("2026-08-08T04:05:00Z"))).toBe(
      "Aug 8, 2026, 12:05 PM",
    );
  });
});

describe("describeActivity", () => {
  it("names the verb and the person", () => {
    expect(
      describeActivity({ action: "update", actorName: "Ana Reyes" }),
    ).toBe("Edited by Ana Reyes");
  });

  it("appends the detail when there is one", () => {
    expect(
      describeActivity({
        action: "update",
        detail: "disabled",
        actorName: "Ana Reyes",
      }),
    ).toBe("Edited by Ana Reyes (disabled)");
  });

  it("ignores a blank detail rather than printing empty parentheses", () => {
    expect(
      describeActivity({ action: "delete", detail: "  ", actorName: "Ana" }),
    ).toBe("Deleted by Ana");
  });

  it("uses the same verbs the dashboards' buttons do", () => {
    expect(ACTION_LABEL.create).toBe("Added");
    expect(ACTION_LABEL.update).toBe("Edited");
    expect(ACTION_LABEL.delete).toBe("Deleted");
  });
});
