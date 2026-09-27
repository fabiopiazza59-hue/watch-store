// The Claude designer's tools. Both are thin wrappers around the rules engine: check_design reports
// on any spec, and submit_design only accepts specs the rules call buildable.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CATALOG } from "../catalog";
import { priceSpec } from "../pricing";
import { repairSpec, validateSpec } from "../rules";
import { watchSpecSchema } from "../schemas";
import type { Catalog, Issue, WatchSpec } from "../types";
import { MAX_REPLY_LENGTH } from "./prompt";

type BetaTool = Anthropic.Beta.BetaTool;
type BetaToolUseBlock = Anthropic.Beta.BetaToolUseBlock;
type BetaToolResultBlockParam = Anthropic.Beta.BetaToolResultBlockParam;

export const CHECK_DESIGN = "check_design";
export const SUBMIT_DESIGN = "submit_design";

const submitDesignInputSchema = z.object({
  spec: watchSpecSchema,
  reply: z.string().trim().min(1).max(MAX_REPLY_LENGTH),
});

/** JSON schema for a full WatchSpec, with each slot limited to the catalogue's ids for that slot. */
function watchSpecJsonSchema(catalog: Catalog) {
  const ids = (key: keyof Catalog) => catalog[key].map((part) => part.id);
  const partId = (key: keyof Catalog, description: string) => ({ type: "string", enum: ids(key), description });
  return {
    type: "object" as const,
    properties: {
      name: { type: "string", maxLength: 60, description: "Short name for the design, at most 40 characters." },
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
    },
    required: ["name", "movementId", "caseId", "dialId", "handsId", "crystalId", "bezelInsertId", "strapId", "personalization"],
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
        "get an automatic repair suggestion. Use it freely to explore options before submitting.",
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

function checkReport(spec: WatchSpec, catalog: Catalog) {
  const report = validateSpec(spec, catalog);
  const issues = report.issues.map(issueSummary);
  if (report.buildable) {
    const quote = priceSpec(spec, catalog);
    return {
      buildable: true,
      issues,
      price: { suggestedRetailEur: quote.suggestedRetailEur, leadTimeDays: quote.leadTimeDays },
    };
  }
  const repair = repairSpec(spec, catalog);
  return {
    buildable: false,
    issues,
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
      const input = watchSpecSchema.safeParse(block.input);
      if (!input.success) return invalidInput(block, input.error);
      return { kind: "result", result: result(block, checkReport(input.data, catalog)), proposal: input.data };
    }
    case SUBMIT_DESIGN: {
      const input = submitDesignInputSchema.safeParse(block.input);
      if (!input.success) return invalidInput(block, input.error);
      const { spec, reply } = input.data;
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
