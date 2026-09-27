import { describe, expect, it } from "vitest";
import { CATALOG, DEFAULT_SPEC, EXTRAS, NO_EXTRAS, NONE_OPTION_ID } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import { evaluateSpareStraps } from "@/domain/rules";
import type { Issue, OptionStatus, WatchSpec } from "@/domain/types";
import {
  addOnGroups,
  extrasPriceEur,
  isExtrasIssue,
  setSpareStrap,
  spareStrapOptions,
  toggleExtraItem,
  visibleSpareStrapOptions,
  withExtras,
} from "./extrasOptions";

const retail = (spec: WatchSpec) => priceSpec(spec).retailInclVatEur;

const TOO_NARROW: Issue = {
  ruleId: "spare-strap",
  severity: "error",
  message: "This 20 mm strap won't fit the case's 22 mm lugs.",
  slots: [],
  fixes: [],
};

/** Spare strap statuses as evaluateSpareStraps gives them, for the default 22 mm diver. */
const STATUSES: OptionStatus[] = [
  { partId: NONE_OPTION_ID, compatible: true, issues: [] },
  { partId: "strap-leather-brown-22", compatible: true, issues: [] },
  { partId: "strap-leather-tan-20", compatible: false, issues: [TOO_NARROW] },
  { partId: "strap-nato-navy-22", compatible: true, issues: [{ ...TOO_NARROW, severity: "warning", message: "A caveat." }] },
];

describe("toggleExtraItem", () => {
  it("adds and removes add-ons, keeping catalogue order and each once", () => {
    const [box, pouch, tool] = EXTRAS.map((extra) => extra.id);
    let extras = toggleExtraItem(NO_EXTRAS, tool, true);
    extras = toggleExtraItem(extras, box, true);
    extras = toggleExtraItem(extras, box, true);
    expect(extras.itemIds).toEqual([box, tool]);
    expect(toggleExtraItem({ ...extras, itemIds: [tool, box] }, pouch, true).itemIds).toEqual([box, pouch, tool]);
    expect(toggleExtraItem(extras, box, false).itemIds).toEqual([tool]);
    expect(extras.spareStrapId).toBeNull();
  });

  it("keeps an id the catalogue doesn't list, after the others, for the rules engine to report", () => {
    const extras = { spareStrapId: "strap-nato-navy-22", itemIds: ["extra-retired", EXTRAS[3].id] };
    expect(toggleExtraItem(extras, EXTRAS[0].id, true)).toEqual({
      spareStrapId: "strap-nato-navy-22",
      itemIds: [EXTRAS[0].id, EXTRAS[3].id, "extra-retired"],
    });
  });
});

describe("spareStrapOptions", () => {
  const withSpare = withExtras(DEFAULT_SPEC, setSpareStrap(NO_EXTRAS, "strap-leather-brown-22"));

  it("follows the rules engine's verdict, with no spare strap first", () => {
    const options = spareStrapOptions(DEFAULT_SPEC, STATUSES);
    expect(options.map((option) => [option.optionId, option.strapId, option.fit])).toEqual([
      [NONE_OPTION_ID, null, "fits"],
      ["strap-leather-brown-22", "strap-leather-brown-22", "fits"],
      ["strap-leather-tan-20", "strap-leather-tan-20", "wont-fit"],
      ["strap-nato-navy-22", "strap-nato-navy-22", "caveats"],
    ]);
    expect(options[1].strap).toBe(CATALOG.straps.find((strap) => strap.id === "strap-leather-brown-22"));
    expect(options[2].reason).toBe(TOO_NARROW);
    expect(options.map((option) => option.sameAsWatch)).toEqual([false, false, false, false]);
    const onBrown = spareStrapOptions({ ...DEFAULT_SPEC, strapId: "strap-leather-brown-22" }, STATUSES);
    expect(onBrown.map((option) => option.sameAsWatch)).toEqual([false, true, false, false]);
  });

  it("prices each choice against the design as it stands", () => {
    const options = spareStrapOptions(withSpare, STATUSES);
    const [none, chosen, tan] = options;
    expect(chosen.priceDeltaEur).toBe(0);
    expect(none.priceDeltaEur).toBe(retail(DEFAULT_SPEC) - retail(withSpare));
    expect(tan.priceDeltaEur).toBe(
      retail(withExtras(DEFAULT_SPEC, setSpareStrap(NO_EXTRAS, "strap-leather-tan-20"))) - retail(withSpare),
    );
  });

  it("lists only what fits by default, but always 'none' and the chosen strap", () => {
    const options = spareStrapOptions(DEFAULT_SPEC, STATUSES);
    const ids = (selectedId: string, showAll: boolean) =>
      visibleSpareStrapOptions(options, selectedId, showAll).map((option) => option.optionId);
    expect(ids(NONE_OPTION_ID, false)).toEqual([NONE_OPTION_ID, "strap-leather-brown-22", "strap-nato-navy-22"]);
    expect(ids("strap-leather-tan-20", false)).toEqual([
      NONE_OPTION_ID,
      "strap-leather-brown-22",
      "strap-leather-tan-20",
      "strap-nato-navy-22",
    ]);
    expect(ids(NONE_OPTION_ID, true)).toHaveLength(STATUSES.length);
  });

  it("offers the catalogue's straps, judged by the rules engine against the case's lugs", () => {
    const statuses = evaluateSpareStraps(DEFAULT_SPEC);
    const options = spareStrapOptions(DEFAULT_SPEC);
    expect(options.map((option) => option.optionId)).toEqual(statuses.map((status) => status.partId));
    expect(options[0].strapId).toBeNull();
    expect(options.find((option) => option.optionId === "strap-leather-tan-20")?.fit).toBe("wont-fit");
    expect(options.find((option) => option.optionId === "strap-leather-brown-22")?.fit).not.toBe("wont-fit");
  });
});

describe("addOnGroups", () => {
  it("lists every add-on once: what goes in the box, then the bench services", () => {
    const groups = addOnGroups(DEFAULT_SPEC);
    expect(groups.map((group) => group.title)).toEqual(["In the box", "At the bench"]);
    const ids = groups.flatMap((group) => group.options.map((option) => option.extra.id));
    expect([...ids].sort()).toEqual(EXTRAS.map((extra) => extra.id).sort());
    const boxOrder = groups[0].options.map((option) => ["packaging", "gift", "tool"].indexOf(option.extra.kind));
    expect(boxOrder).not.toContain(-1);
    expect(boxOrder).toEqual([...boxOrder].sort((a, b) => a - b));
    expect(groups[1].options.every((option) => option.extra.kind === "service")).toBe(true);
  });

  it("gives each add-on what it adds to the price, whether it is chosen or not", () => {
    const [box, , , gift] = EXTRAS;
    const spec = withExtras(DEFAULT_SPEC, { spareStrapId: null, itemIds: [box.id] });
    const options = addOnGroups(spec).flatMap((group) => group.options);
    const boxOption = options.find((option) => option.extra.id === box.id);
    const giftOption = options.find((option) => option.extra.id === gift.id);
    expect(boxOption?.selected).toBe(true);
    expect(boxOption?.priceDeltaEur).toBe(retail(spec) - retail(DEFAULT_SPEC));
    expect(giftOption?.selected).toBe(false);
    expect(giftOption?.priceDeltaEur).toBe(
      retail(withExtras(DEFAULT_SPEC, { spareStrapId: null, itemIds: [box.id, gift.id] })) - retail(spec),
    );
    for (const option of options) expect(option.priceDeltaEur).toBeGreaterThanOrEqual(0);
  });
});

describe("extrasPriceEur", () => {
  it("is what the extras add together, and nothing without any", () => {
    expect(extrasPriceEur(DEFAULT_SPEC)).toBe(0);
    const spec = withExtras(DEFAULT_SPEC, { spareStrapId: "strap-nato-navy-22", itemIds: [EXTRAS[0].id] });
    expect(extrasPriceEur(spec)).toBe(retail(spec) - retail(DEFAULT_SPEC));
  });
});

describe("isExtrasIssue", () => {
  it("recognises the spare strap and add-on rules", () => {
    expect(isExtrasIssue(TOO_NARROW)).toBe(true);
    expect(isExtrasIssue({ ...TOO_NARROW, ruleId: "extras" })).toBe(true);
    expect(isExtrasIssue({ ...TOO_NARROW, ruleId: "lug-width" })).toBe(false);
  });
});
