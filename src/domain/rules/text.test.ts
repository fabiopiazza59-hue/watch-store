import { describe, expect, it } from "vitest";
import { compactText, normalizePersonalizationText, normalizeText, reviewText, words } from "./text";

describe("normalisation", () => {
  it("lowercases, strips accents and collapses whitespace", () => {
    expect(normalizeText("  Genève \t  SWISS\n Söhne ")).toBe("geneve swiss sohne");
  });

  it("folds compatibility forms such as fullwidth letters and ligatures to plain letters", () => {
    expect(normalizeText("ＲＯＬＥＸ")).toBe("rolex");
    expect(normalizeText("Ｓｗｉｓｓ\u3000Ｍａｄｅ")).toBe("swiss made");
    expect(normalizeText("ﬁeld")).toBe("field");
  });

  it("splits words on punctuation but keeps apostrophes inside words", () => {
    expect(words("Tag-Heuer, Genève.")).toEqual(["tag", "heuer", "geneve"]);
    expect(words("Grandpa’s L'heure")).toEqual(["grandpas", "lheure"]);
  });

  it("removes all spaces and punctuation in the compact form", () => {
    expect(compactText("R O L E X")).toBe("rolex");
    expect(compactText("tag-heuer")).toBe("tagheuer");
  });
});

describe("watch trademarks", () => {
  it.each([
    ["Rolex", "Rolex"],
    ["ROLEX", "Rolex"],
    ["R O L E X", "Rolex"],
    ["R.O.L.E.X.", "Rolex"],
    ["Rolexes forever", "Rolex"],
    ["MyRolex", "Rolex"],
    ["tag-heuer", "TAG Heuer"],
    ["TagHeuer", "TAG Heuer"],
    ["T.A.G.", "TAG Heuer"],
    ["Grand Seiko", "Seiko"],
    ["A. Lange & Söhne", "A. Lange & Söhne"],
    ["lange und sohne", "A. Lange & Söhne"],
    ["IWC", "IWC"],
    ["Sinn", "Sinn"],
    ["Oris", "Oris"],
    ["Jaeger-LeCoultre", "Jaeger-LeCoultre"],
    ["g shock", "G-Shock"],
    ["Patek", "Patek Philippe"],
    ["Mont Blanc", "Montblanc"],
    ["Submariner", "Submariner"],
    ["ＲＯＬＥＸ", "Rolex"],
    ["Ｏｍｅｇａ", "Omega"],
    ["Heuer", "TAG Heuer"],
    ["TAG Heuer", "TAG Heuer"],
    ["Lange & Soehne", "A. Lange & Söhne"],
    ["Lange und Soehne", "A. Lange & Söhne"],
    ["Glashuette Original", "Glashütte Original"],
  ])("catches %j as %s", (text, brand) => {
    expect(reviewText(text).trademarks).toContain(brand);
  });

  it.each([
    "Vintage",
    "Stage",
    "Grace",
    "Doris",
    "Sinner",
    "Colorado",
    "Tagline",
    "Oriental",
    "Carole Xu",
    "Home Game",
    "Horizon",
    "Radio",
    "Genevieve",
    "Grandpa's watch",
    "Theuer",
    "Familie Scheuer",
  ])("does not flag the ordinary text %j", (text) => {
    const review = reviewText(text);
    expect(review.trademarks).toEqual([]);
    expect(review.protectedIndications).toEqual([]);
  });

  it("names each brand once", () => {
    expect(reviewText("TAG Heuer tag heuer").trademarks).toEqual(["TAG Heuer"]);
    expect(reviewText("Rolex or Omega").trademarks).toEqual(["Rolex", "Omega"]);
  });
});

describe("protected Swiss indications", () => {
  it.each([
    ["Swiss", "Swiss"],
    ["Swiss Made", "Swiss"],
    ["SWISSMADE", "Swiss"],
    ["Suisse", "Swiss"],
    ["Made in Switzerland", "Swiss"],
    ["Genève", "Genève"],
    ["GENEVE", "Genève"],
    ["Geneva", "Genève"],
    ["Genf", "Genève"],
    ["Ｓｗｉｓｓ Ｍａｄｅ", "Swiss"],
  ])("catches %j as %s", (text, indication) => {
    expect(reviewText(text).protectedIndications).toContain(indication);
  });
});

describe("characters and length", () => {
  it("allows letters (accented too), digits, spaces and . , ' & -", () => {
    expect(reviewText("Zoë-Ångström & Co., 1953 'ok'").disallowedCharacters).toEqual([]);
  });

  it("refuses compatibility forms, which would be printed as typed", () => {
    expect(reviewText("ﬁeld").disallowedCharacters).toEqual(["ﬁ"]);
    expect(reviewText("ＲＯＬＥＸ").disallowedCharacters).toEqual(["Ｒ", "Ｏ", "Ｌ", "Ｅ", "Ｘ"]);
    expect(reviewText("No²").disallowedCharacters).toEqual(["²"]);
  });

  it("lists each disallowed character once, in order", () => {
    expect(reviewText("Hi! Hi! #1").disallowedCharacters).toEqual(["!", "#"]);
    expect(reviewText("Dad’s").disallowedCharacters).toEqual(["’"]);
    expect(reviewText("東京").disallowedCharacters).toEqual(["東", "京"]);
    expect(reviewText("A\tB").disallowedCharacters).toEqual(["\t"]);
  });

  it("counts characters of the trimmed text, composed accents as one", () => {
    expect(reviewText("  abc  ").length).toBe(3);
    expect(reviewText("é").length).toBe(1);
  });
});

describe("normalizePersonalizationText", () => {
  it("turns typographic apostrophes and dashes into the ASCII marks the review accepts", () => {
    expect(normalizePersonalizationText("Grandpa’s watch")).toBe("Grandpa's watch");
    expect(normalizePersonalizationText("‘Anna’ ʼ92 1953–2026 — Tom")).toBe("'Anna' '92 1953-2026 - Tom");
    expect(reviewText(normalizePersonalizationText("Grandpa’s watch")).disallowedCharacters).toEqual([]);
  });

  it("leaves everything else as typed, for the review to judge", () => {
    expect(normalizePersonalizationText("Zoë-Ångström & Co.")).toBe("Zoë-Ångström & Co.");
    expect(normalizePersonalizationText("“Carpe diem”")).toBe("“Carpe diem”");
    expect(normalizePersonalizationText("ＲＯＬＥＸ")).toBe("ＲＯＬＥＸ");
  });
});
