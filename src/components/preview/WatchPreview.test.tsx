import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Personalization, ResolvedSpec } from "@/domain/types";
import { PREVIEW_FIXTURES } from "./__fixtures__/designs";
import { PLACEHOLDER } from "./svg";
import { WatchPreview } from "./WatchPreview";

const render = (element: ReactElement) => renderToStaticMarkup(element);
const personalization = (dialText = ""): Personalization => ({ dialText, casebackEngraving: "" });
const placeholderDash = `stroke-dasharray="${PLACEHOLDER.strokeDasharray}"`;
const [diver] = PREVIEW_FIXTURES;

/** The markup of one drawing layer, up to the start of the next. */
function layer(markup: string, part: string): string {
  const start = markup.indexOf(`data-part="${part}"`);
  if (start < 0) return "";
  const next = markup.indexOf('<g data-part="', start + 1);
  return markup.slice(start, next < 0 ? undefined : next);
}

function without(parts: ResolvedSpec, key: keyof ResolvedSpec): ResolvedSpec {
  const rest = { ...parts };
  delete rest[key];
  return rest;
}

describe("WatchPreview", () => {
  it.each(PREVIEW_FIXTURES.map((fixture) => [fixture.name, fixture] as const))(
    "renders %s with only finite, defined attributes",
    (_, fixture) => {
      const markup = render(
        <WatchPreview parts={fixture.parts} personalization={personalization(fixture.dialText)} showDimensions />,
      );
      expect(markup.startsWith("<svg")).toBe(true);
      expect(markup).not.toMatch(/NaN|undefined|Infinity/);
      expect(markup).not.toContain(placeholderDash);
    },
  );

  it("draws at true scale in a fixed millimetre viewBox", () => {
    const markup = render(<WatchPreview parts={diver.parts} personalization={personalization()} />);
    expect(markup).toContain('viewBox="-30 -30 60 60"');
    expect(markup).toContain('<circle r="21" fill="url('); // the 42mm case body
  });

  it("turns the crown to the case's crown position", () => {
    const crownRotation = (crownPosition: 3 | 3.8 | 4) => {
      const watchCase = diver.parts.case;
      if (!watchCase) throw new Error("fixture needs a case");
      const markup = render(
        <WatchPreview parts={{ ...diver.parts, case: { ...watchCase, crownPosition } }} personalization={personalization()} />,
      );
      return markup.match(/data-part="crown" transform="rotate\((-?[\d.]+)\)"/)?.[1];
    };
    // Drawn along 3 o'clock and turned: 3 → 90°, 3.8 → 114°, 4 → 120° clockwise from 12.
    expect(crownRotation(3)).toBe("0");
    expect(crownRotation(3.8)).toBe("24");
    expect(crownRotation(4)).toBe("30");
  });

  it("shows a dial made for another crown position sitting turned, with the hands set against it", () => {
    const watchCase = diver.parts.case;
    const dial = diver.parts.dial;
    if (!watchCase || !dial) throw new Error("fixture needs a case and a dial");
    const turns = (dialCrown: 3 | 3.8 | 4) =>
      render(
        <WatchPreview
          parts={{ ...diver.parts, case: { ...watchCase, crownPosition: 3 }, dial: { ...dial, crownPosition: dialCrown } }}
          personalization={personalization()}
        />,
      ).match(/transform="rotate\(-?[\d.]+\)"/g) ?? [];
    expect(turns(3)).not.toContain('transform="rotate(-24)"');
    // An SKX (3.8) dial in a 3 o'clock case: its feet hold it 24° anticlockwise; dial face and hands.
    expect(turns(3.8).filter((t) => t === 'transform="rotate(-24)"')).toHaveLength(2);
  });

  it("draws a dashed placeholder for every missing part, and no dimensions without a case", () => {
    const markup = render(<WatchPreview parts={{}} personalization={personalization()} showDimensions />);
    expect(markup).not.toMatch(/NaN|undefined|Infinity/);
    for (const part of ["strap", "case", "dial", "hands", "crystal"]) {
      expect(layer(markup, part)).toContain(placeholderDash);
    }
    expect(markup).not.toContain('data-part="dimensions"');
  });

  it.each([
    ["case", "case"],
    ["dial", "dial"],
    ["hands", "hands"],
    ["crystal", "crystal"],
    ["bezelInsert", "bezel"],
    ["strap", "strap"],
  ] as const)("draws a placeholder in its own layer when only the %s is missing", (key, part) => {
    const markup = render(<WatchPreview parts={without(diver.parts, key)} personalization={personalization()} />);
    expect(layer(markup, part)).toContain(placeholderDash);
    expect(markup).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("prints each bezel insert scale: dive and countdown numerals, 24h hours, plain without marks", () => {
    const insert = diver.parts.bezelInsert;
    if (!insert) throw new Error("fixture needs an insert");
    const scaleMarkup = (scale: typeof insert.scale) =>
      render(<WatchPreview parts={{ ...diver.parts, bezelInsert: { ...insert, scale } }} personalization={personalization()} />);
    expect(scaleMarkup("dive-60")).toContain(">50</text>");
    expect(scaleMarkup("countdown-60")).toContain(">50</text>");
    expect(scaleMarkup("gmt-24")).toContain(">22</text>");
    expect(scaleMarkup("plain")).not.toMatch(/>(10|20|30|40|50)<\/text>/);
  });

  it("prints the customer's dial text in capitals, and nothing when it is empty", () => {
    const withText = render(<WatchPreview parts={diver.parts} personalization={personalization("Night shift")} />);
    expect(withText).toContain(">NIGHT SHIFT</text>");
    const blank = render(<WatchPreview parts={diver.parts} personalization={personalization("   ")} />);
    expect(blank).toBe(render(<WatchPreview parts={diver.parts} personalization={personalization()} />));
  });

  it("is an image with a spoken summary of the design", () => {
    const markup = render(<WatchPreview parts={diver.parts} personalization={personalization()} />);
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="42 mm steel diver, black dial, Mercedes hands, black rubber strap"');

    const empty = render(<WatchPreview parts={{}} personalization={personalization()} />);
    expect(empty).toMatch(/aria-label="case not chosen yet, dial not chosen yet, hands not chosen yet, strap not chosen yet"/);
  });

  it("gives two previews on one page distinct ids, and every reference resolves", () => {
    const [first, second] = PREVIEW_FIXTURES;
    const markup = render(
      <div>
        <WatchPreview parts={first.parts} personalization={personalization(first.dialText)} showDimensions />
        <WatchPreview parts={second.parts} personalization={personalization(second.dialText)} />
      </div>,
    );
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);

    const references = [...markup.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)].map((match) => match[1] ?? match[2]);
    expect(references.length).toBeGreaterThan(20);
    for (const reference of references) expect(ids).toContain(reference);
  });

  it("is deterministic", () => {
    const fixture = PREVIEW_FIXTURES[5];
    const once = render(<WatchPreview parts={fixture.parts} personalization={personalization("Same")} />);
    const twice = render(<WatchPreview parts={fixture.parts} personalization={personalization("Same")} />);
    expect(twice).toBe(once);
  });

  it("survives nonsense dimensions and colours without emitting bad attributes", () => {
    const { case: watchCase, dial, hands } = diver.parts;
    const broken: ResolvedSpec = {
      ...diver.parts,
      case: watchCase && { ...watchCase, diameterMm: Number.NaN, lugToLugMm: -4 },
      dial: dial && { ...dial, diameterMm: 0, colorHex: "not-a-colour" },
      hands: hands && { ...hands, lengthsMm: { hour: Number.POSITIVE_INFINITY, minute: Number.NaN, seconds: -1 } },
    };
    const markup = render(<WatchPreview parts={broken} personalization={personalization("Hello")} showDimensions />);
    expect(markup).not.toMatch(/NaN|undefined|Infinity|not-a-colour/);
  });
});
