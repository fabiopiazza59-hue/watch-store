// The Claude designer's tools. Both are thin wrappers around the rules engine: check_design reports
// on any spec, and submit_design only accepts specs the rules call buildable.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CATALOG, EXTRAS } from "../catalog";
import { priceSpec } from "../pricing";
import { normalizePersonalization, repairSpec, reviewText, validateSpec } from "../rules";
import { DESIGN_NAME_MAX_LENGTH, MAX_EXTRA_ITEMS, watchSpecSchema } from "../schemas";
import type { Catalog, Issue, WatchSpec } from "../types";
import { MAX_REPLY_LENGTH } from "./prompt";

type BetaTool = Anthropic.Beta.BetaTool;
type BetaToolUseBlock = Anthropic.Beta.BetaToolUseBlock;
type BetaToolResultBlockParam = Anthropic.Beta.BetaToolResultBlockParam;

export const CHECK_DESIGN = "check_design";
export const SUBMIT_DESIGN = "submit_design";

/**
 * A spec from the model, with typographic apostrophes and dashes in its texts made plain, as the
 * configurator and the order store do: "Grandpa’s" is judged, and stored, as "Grandpa's".
 */
const modelSpecSchema = watchSpecSchema.transform((spec) => ({
  ...spec,
  personalization: normalizePersonalization(spec.personalization),
}));

const submitDesignInputSchema = z.object({
  spec: modelSpecSchema,
  reply: z.string().trim().min(1).max(MAX_REPLY_LENGTH),
});

/**
 * JSON schema for a full WatchSpec, with each slot limited to the catalogue's ids for that slot. The
 * extras are required here, though optional in a spec, so the model always says what they are
 * instead of dropping the customer's by leaving them out.
 */
function watchSpecJsonSchema(catalog: Catalog) {
  const ids = (key: keyof Catalog) => catalog[key].map((part) => part.id);
  const partId = (key: keyof Catalog, description: string) => ({ type: "string", enum: ids(key), description });
  return {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        maxLength: DESIGN_NAME_MAX_LENGTH,
        description: `Name of the design: at most 40 characters for one you choose; a name the customer gave may be up to ${DESIGN_NAME_MAX_LENGTH}.`,
      },
      movementId: partId("movements", "Movement id."),
      caseId: partId("cases", "Case id."),
      dialId: partId("dials", "Dial id."),
      handsId: partId("hands", "Hand set id."),
      crystalId: partId("crystals", "Crystal id."),
      bezelInsertId: {
        type: ["string", "null"],
        enum: [...ids("bezelInserts"), null],
        description: "Bezel insert id, or null when the case's bezel takes no insert.",
      },
      strapId: partId("straps", "Strap or bracelet id."),
      personalization: {
        type: "object",
        properties: {
          dialText: { type: "string", description: "Text printed on the dial above 6 o'clock; empty for none." },
          casebackEngraving: { type: "string", description: "Text engraved on a solid caseback; empty for none." },
        },
        required: ["dialText", "casebackEngraving"],
        additionalProperties: false,
      },
      extras: {
        type: "object",
        description:
          "What ships with the watch. Carry over the current design's extras unless the customer asks to change them; none is {\"spareStrapId\": null, \"itemIds\": []}.",
        properties: {
          spareStrapId: {
            type: ["string", "null"],
            enum: [...ids("straps"), null],
            description: "A spare strap that fits the case's lugs, or null for none.",
          },
          itemIds: {
            type: "array",
            items: { type: "string", enum: EXTRAS.map((extra) => extra.id) },
            uniqueItems: true,
            maxItems: MAX_EXTRA_ITEMS,
            description: "Add-on ids, each at most once.",
          },
        },
        required: ["spareStrapId", "itemIds"],
        additionalProperties: false,
      },
    },
    required: ["name", "movementId", "caseId", "dialId", "handsId", "crystalId", "bezelInsertId", "strapId", "personalization", "extras"],
    additionalProperties: false,
  };
}

export function designerTools(catalog: Catalog = CATALOG): BetaTool[] {
  const spec = watchSpecJsonSchema(catalog);
  return [
    {
      name: CHECK_DESIGN,
      description:
        "Run the workshop's feasibility rules on a complete watch design. Returns whether it is buildable and every " +
        "issue: errors (cannot be built), warnings (buildable with a downside to mention) and info (taste), each " +
        "with suggested fixes as partial specs. Buildable designs also get a price and lead time; unbuildable ones " +
        "get an automatic repair suggestion. To compare options, check several candidates in the same turn, then " +
        "submit the one you choose.",
      input_schema: spec,
    },
    {
      name: SUBMIT_DESIGN,
      description:
        "Submit the final design and your reply to the customer. Only buildable designs are accepted: otherwise " +
        "the errors come back and you should fix them and submit again. Submitting ends your turn.",
      input_schema: {
        type: "object",
        properties: {
          spec,
          reply: {
            type: "string",
            maxLength: MAX_REPLY_LENGTH,
            description: `Your reply to the customer: plain text, at most ${MAX_REPLY_LENGTH} characters.`,
          },
        },
        required: ["spec", "reply"],
        additionalProperties: false,
      },
    },
  ];
}

export const DESIGNER_TOOLS = designerTools();

function issueSummary({ severity, ruleId, message, fixes }: Issue) {
  return { severity, rule: ruleId, message, fixes: fixes.map(({ description, patch }) => ({ description, patch })) };
}

/**
 * Why a design name can't be used, or undefined when it can. The rules engine judges only what is
 * printed or engraved; the name also appears on the order and the build sheet, so it follows the
 * same trademark rule.
 */
function designNameProblem(name: string): string | undefined {
  const { trademarks, protectedIndications } = reviewText(name);
  if (trademarks.length > 0) {
    return `The design name uses another company's trademark (${trademarks.join(", ")}); choose an original name.`;
  }
  if (protectedIndications.length > 0) {
    return `The design name uses a protected Swiss indication (${protectedIndications.join(", ")}); choose another name.`;
  }
  return undefined;
}

function checkReport(spec: WatchSpec, catalog: Catalog) {
  const report = validateSpec(spec, catalog);
  const issues = report.issues.map(issueSummary);
  const nameProblem = designNameProblem(spec.name);
  const name = nameProblem ? { nameProblem } : {};
  if (report.buildable) {
    const quote = priceSpec(spec, catalog);
    return {
      buildable: true,
      issues,
      ...name,
      price: { customerPriceInclVatEur: quote.retailInclVatEur, leadTimeDays: quote.leadTimeDays },
    };
  }
  const repair = repairSpec(spec, catalog);
  return {
    buildable: false,
    issues,
    ...name,
    repairSuggestion: { buildable: repair.report.buildable, changes: repair.changes, spec: repair.spec },
  };
}

export type ToolOutcome =
  /** A tool result to send back; `proposal` is the spec the model tried, when its input was valid. */
  | { kind: "result"; result: BetaToolResultBlockParam; proposal?: WatchSpec }
  /** submit_design accepted a buildable design: the conversation is over. */
  | { kind: "submitted"; spec: WatchSpec; reply: string };

function result(block: BetaToolUseBlock, content: unknown, isError = false): BetaToolResultBlockParam {
  return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(content), is_error: isError };
}

function invalidInput(block: BetaToolUseBlock, error: z.ZodError): ToolOutcome {
  return {
    kind: "result",
    result: result(block, { error: `Invalid input for ${block.name}`, details: z.prettifyError(error) }, true),
  };
}

/** Runs one tool call. Inputs are validated before anything runs; problems become error results. */
export function runDesignerTool(block: BetaToolUseBlock, catalog: Catalog = CATALOG): ToolOutcome {
  switch (block.name) {
    case CHECK_DESIGN: {
      const input = modelSpecSchema.safeParse(block.input);
      if (!input.success) return invalidInput(block, input.error);
      return { kind: "result", result: result(block, checkReport(input.data, catalog)), proposal: input.data };
    }
    case SUBMIT_DESIGN: {
      const input = submitDesignInputSchema.safeParse(block.input);
      if (!input.success) return invalidInput(block, input.error);
      const { spec, reply } = input.data;
      const nameProblem = designNameProblem(spec.name);
      if (nameProblem) return { kind: "result", result: result(block, { accepted: false, reason: nameProblem }, true) };
      const report = validateSpec(spec, catalog);
      if (report.buildable) return { kind: "submitted", spec, reply };
      const errors = report.issues.filter((issue) => issue.severity === "error").map(issueSummary);
      const rejection = { accepted: false, reason: "The design is not buildable. Fix these errors and submit again.", errors };
      return { kind: "result", result: result(block, rejection, true), proposal: spec };
    }
    default:
      return { kind: "result", result: result(block, { error: `Unknown tool '${block.name}'` }, true) };
  }
}
