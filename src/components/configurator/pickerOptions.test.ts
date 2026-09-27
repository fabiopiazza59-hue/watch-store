import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, NONE_OPTION_ID } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import { evaluateOptions } from "@/domain/rules";
import type { WatchSpec } from "@/domain/types";
import { pickerOptions } from "./pickerOptions";

const FIELD_OLIVE: WatchSpec = { ...DEFAULT_SPEC, dialId: "dial-field-olive" };

describe("pickerOptions", () => {
  it("offers a case that takes the chosen dial once the parts around it change", () => {
    const options = pickerOptions("caseId", FIELD_OLIVE, "dialId");
    const field38 = options.find((option) => option.optionId === "case-field-38");
    expect(field38?.fit).toBe("fits-with-changes");
    expect(field38?.adjusted?.spec).toMatchObject({ caseId: "case-field-38", dialId: "dial-field-olive" });
    expect(field38?.adjusted?.changes).toHaveLength(3);
    expect(field38?.priceDeltaEur).toBe(
      priceSpec(field38?.adjusted?.spec ?? FIELD_OLIVE).retailInclVatEur - priceSpec(FIELD_OLIVE).retailInclVatEur,
    );
  });

  it("agrees with evaluateOptions wherever an option fits as it is", () => {
    const options = pickerOptions("dialId", DEFAULT_SPEC, null);
    const statuses = evaluateOptions("dialId", DEFAULT_SPEC);
    expect(options.map((option) => option.optionId)).toEqual(statuses.map((status) => status.partId));
    statuses.forEach((status, index) => {
      if (status.compatible) expect(options[index].fit).not.toBe("wont-fit");
      else expect(["wont-fit", "fits-with-changes"]).toContain(options[index].fit);
    });
  });

  it("leaves the selected option alone, and gives 'no part' a null id", () => {
    const selected = pickerOptions("dialId", FIELD_OLIVE, "dialId").find((option) => option.optionId === "dial-field-olive");
    expect(selected?.fit).toBe("wont-fit");
    expect(selected?.adjusted).toBeUndefined();
    expect(selected?.priceDeltaEur).toBe(0);

    const none = pickerOptions("bezelInsertId", DEFAULT_SPEC, null)[0];
    expect(none).toMatchObject({ optionId: NONE_OPTION_ID, partId: null });
  });
});
