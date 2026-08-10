import { describe, expect, it } from "vitest";

import { DECALS, FIRE_CLASS_CAPTION, findDecal } from "./catalogue";

describe("findDecal", () => {
  it("finds a decal by its slug", () => {
    expect(findDecal("dry-chemical")?.title).toBe("DRY CHEMICAL");
    expect(findDecal("afff")?.title).toBe("AFFF");
  });

  it("returns nothing for a slug that is not one, so the route can 404", () => {
    expect(findDecal("halon")).toBeUndefined();
    expect(findDecal("")).toBeUndefined();
  });
});

describe("the catalogue", () => {
  it("keeps slugs unique — they are the route", () => {
    const slugs = DECALS.map((decal) => decal.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every decal the artwork its wordmark names", () => {
    for (const decal of DECALS) {
      expect(["red", "green", "blue"]).toContain(decal.wordmark);
    }
  });

  /*
   * Every class printed on a decal needs a caption to print under it. A missing
   * one would render an empty line rather than fail, which is exactly the sort
   * of omission nobody notices until a box of labels is already printed.
   */
  it("has a caption for every fire class in use", () => {
    for (const decal of DECALS) {
      for (const fireClass of decal.fireClasses) {
        expect(FIRE_CLASS_CAPTION[fireClass.key]).toBeTruthy();
      }
    }
  });

  /*
   * AFFF is a water-based foam: it must not be turned on live electrical
   * equipment, and its decal strikes class C to say so. This is the one piece of
   * per-decal safety marking in the catalogue, so it is pinned.
   */
  it("strikes the electrical class on AFFF and on nothing else", () => {
    const struck = DECALS.filter((decal) =>
      decal.fireClasses.some((fireClass) => fireClass.prohibited),
    );

    expect(struck.map((decal) => decal.slug)).toEqual(["afff"]);
    expect(
      findDecal("afff")?.fireClasses.find((fireClass) => fireClass.prohibited)
        ?.key,
    ).toBe("C");
  });

  it("carries the licence number transcribed from each source decal", () => {
    expect(findDecal("dry-chemical")?.licenceNo).toBe("Q 0485");
    expect(findDecal("carbon-dioxide")?.licenceNo).toBe("Q 0485");
    expect(findDecal("hfc-236fa")?.licenceNo).toBe("Q 1265");
    expect(findDecal("afff")?.licenceNo).toBe("Q 1265");
  });

  it("gives every decal something to print in every required field", () => {
    for (const decal of DECALS) {
      expect(decal.title).toBeTruthy();
      expect(decal.subtitle).toBeTruthy();
      expect(decal.summary).toBeTruthy();
      expect(decal.licenceNo).toBeTruthy();
      expect(decal.chemicalContent.length).toBeGreaterThan(0);
      expect(decal.fireClasses.length).toBeGreaterThan(0);
    }
  });
});
