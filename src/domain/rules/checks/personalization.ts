import { PERSONALIZATION_LIMITS } from "../../catalog";
import type { Personalization, SuggestedFix, WatchSpec } from "../../types";
import { listJoin, quote } from "../format";
import { finding, swaps, type Finding, type RuleContext } from "../model";
import { ALLOWED_PUNCTUATION, reviewText } from "../text";

interface TextField {
  ruleId: "dial-text" | "caseback-engraving";
  field: keyof Personalization;
  /** Sentence subject: "Dial text can be at most…". */
  subject: string;
  verb: "print" | "engrave";
  maxLength: number;
  removalLabel: string;
}

const DIAL_TEXT: TextField = {
  ruleId: "dial-text",
  field: "dialText",
  subject: "Dial text",
  verb: "print",
  maxLength: PERSONALIZATION_LIMITS.dialTextMaxLength,
  removalLabel: "Remove the dial text",
};

const CASEBACK_ENGRAVING: TextField = {
  ruleId: "caseback-engraving",
  field: "casebackEngraving",
  subject: "A caseback engraving",
  verb: "engrave",
  maxLength: PERSONALIZATION_LIMITS.casebackEngravingMaxLength,
  removalLabel: "Remove the caseback engraving",
};

function removal(spec: WatchSpec, text: TextField): SuggestedFix {
  return {
    description: text.removalLabel,
    patch: { personalization: { ...spec.personalization, [text.field]: "" } },
  };
}

function describeCharacter(char: string): string {
  if (char === "\n" || char === "\r") return "line breaks";
  if (char === "\t") return "tabs";
  if (/\s/.test(char)) return "special spaces";
  return quote(char);
}

/** Problems with the words themselves, whatever parts are chosen. */
function contentFindings(spec: WatchSpec, text: TextField): Finding[] {
  const review = reviewText(spec.personalization[text.field]);
  const remedies = [{ patch: removal(spec, text) }];
  const report = (variant: string, message: string) =>
    finding({ ruleId: text.ruleId, variant, severity: "error", message, slots: [], remedies });
  const findings: Finding[] = [];

  if (review.length > text.maxLength) {
    findings.push(
      report("length", `${text.subject} can be at most ${text.maxLength} characters long; yours has ${review.length}.`),
    );
  }
  if (review.disallowedCharacters.length > 0) {
    findings.push(
      report(
        "characters",
        `${text.subject} can use letters, numbers, spaces and the marks ${ALLOWED_PUNCTUATION.join(" ")} ` +
          `but not ${listJoin(review.disallowedCharacters.map(describeCharacter))}.`,
      ),
    );
  }
  if (review.trademarks.length > 0) {
    const names = listJoin(review.trademarks.map(quote));
    const isOrAre = review.trademarks.length > 1 ? "are other watch companies' trademarks" : "is another watch company's trademark";
    findings.push(
      report(
        "trademark",
        `${names} ${isOrAre}, and we never ${text.verb} other brands on our watches. ` +
          `Try a name, initials, a date or a motto of your own.`,
      ),
    );
  }
  if (review.protectedIndications.length > 0) {
    const names = listJoin(review.protectedIndications.map(quote));
    const plural = review.protectedIndications.length > 1;
    findings.push(
      report(
        "swiss-indication",
        `${names} ${plural ? "are protected indications" : "is a protected indication"}, reserved by Swiss law ` +
          `for watches that meet strict origin rules. Ours are built around NH-family movements, which aren't ` +
          `Swiss, so we can't ${text.verb} ${plural ? "them" : "it"}.`,
      ),
    );
  }
  return findings;
}

/** `dial-text`: custom dial text goes on a printable dial and is printable, original wording. */
export function dialText({ spec, parts }: RuleContext): Finding[] {
  if (!spec.personalization.dialText.trim()) return [];
  const { dial } = parts;
  const findings: Finding[] = [];
  if (dial && !dial.printable) {
    findings.push(
      finding({
        ruleId: "dial-text",
        variant: "not-printable",
        severity: "error",
        message: `The ${quote(dial.name)} dial can't take custom printing. Choose a printable dial, or remove the text.`,
        slots: ["dialId"],
        remedies: [...swaps("dialId"), { patch: removal(spec, DIAL_TEXT) }],
      }),
    );
  }
  return [...findings, ...contentFindings(spec, DIAL_TEXT)];
}

/** `caseback-engraving`: engravings go on a solid caseback and are engravable, original wording. */
export function casebackEngraving({ spec, parts }: RuleContext): Finding[] {
  if (!spec.personalization.casebackEngraving.trim()) return [];
  const { case: watchCase } = parts;
  const findings: Finding[] = [];
  if (watchCase && watchCase.caseback === "display") {
    findings.push(
      finding({
        ruleId: "caseback-engraving",
        variant: "display-caseback",
        severity: "error",
        message:
          `The ${quote(watchCase.name)} case has a display caseback, a glass window onto the movement, and glass ` +
          `can't be laser-engraved. Choose a case with a solid caseback, or remove the engraving.`,
        slots: ["caseId"],
        remedies: [...swaps("caseId"), { patch: removal(spec, CASEBACK_ENGRAVING) }],
      }),
    );
  }
  return [...findings, ...contentFindings(spec, CASEBACK_ENGRAVING)];
}
