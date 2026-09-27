// The Claude designer: a manual tool-use loop in which Claude proposes designs and the rules engine
// (through the tools) decides which are buildable. Any API failure or refusal falls back to the
// offline designer, so the customer always gets an answer.
import Anthropic from "@anthropic-ai/sdk";
import { CATALOG, DEFAULT_SPEC } from "../catalog";
import { repairSpec } from "../rules";
import type { Catalog, DesignRequest, WatchSpec } from "../types";
import { designOffline } from "./offline";
import { SYSTEM_PROMPT } from "./prompt";
import { DESIGNER_TOOLS, runDesignerTool } from "./tools";
import type { DesignDraft } from "./types";

type BetaMessage = Anthropic.Beta.BetaMessage;
type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaContentBlock = Anthropic.Beta.BetaContentBlock;
type BetaToolUseBlock = Anthropic.Beta.BetaToolUseBlock;
type BetaToolResultBlockParam = Anthropic.Beta.BetaToolResultBlockParam;
type MessageCreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming;

export const DEFAULT_MODEL = "claude-opus-5";

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];
export const DEFAULT_EFFORT: Effort = "medium";

const MAX_ITERATIONS = 8;
const MAX_TOKENS = 16000;
/** Lets the API retry a refused request on a suitable fallback model server-side. */
const SERVER_SIDE_FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** The slice of the Anthropic client the designer uses, so tests can script the conversation. */
export interface MessagesClient {
  beta: {
    messages: {
      create(params: MessageCreateParams): PromiseLike<Pick<BetaMessage, "content" | "stop_reason">>;
    };
  };
}

export interface ClaudeDesignerOptions {
  client?: MessagesClient;
  model?: string;
  effort?: Effort;
  maxIterations?: number;
  catalog?: Catalog;
}

export function configuredModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export function configuredEffort(): Effort {
  const effort = process.env.ANTHROPIC_EFFORT?.trim();
  return EFFORTS.find((level) => level === effort) ?? DEFAULT_EFFORT;
}

/**
 * Prior turns as plain text, then the latest message together with the design on screen. The API
 * wants the customer to speak first, so a leading assistant greeting is dropped.
 */
function conversation(req: DesignRequest, current: WatchSpec): BetaMessageParam[] {
  const history = req.history ?? [];
  const firstUserTurn = history.findIndex((turn) => turn.role === "user");
  const turns: BetaMessageParam[] = (firstUserTurn >= 0 ? history.slice(firstUserTurn) : []).map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));
  const shown = req.currentSpec ? "The design currently in the configurator" : "The starting design in the configurator";
  turns.push({
    role: "user",
    content: `${shown}:\n${JSON.stringify(current, null, 2)}\n\nCustomer's message:\n${req.message}`,
  });
  return turns;
}

function isToolUse(block: BetaContentBlock): block is BetaToolUseBlock {
  return block.type === "tool_use";
}

function textOf(content: BetaContentBlock[]): string {
  return content
    .flatMap((block) => (block.type === "text" ? [block.text.trim()] : []))
    .filter(Boolean)
    .join("\n\n");
}

/** When Claude runs out of turns without an accepted design, keep its last idea, repaired. */
function unfinishedDraft(proposal: WatchSpec, catalog: Catalog): DesignDraft {
  const repaired = repairSpec(proposal, catalog);
  const reply = repaired.report.buildable
    ? "I couldn't finish refining this design, so I've let the workshop's automatic fixes make my last idea buildable. Have a look, and tell me what you'd like to change."
    : "I couldn't get this design past the workshop's fit checks yet; the build check shows what still needs sorting. Tell me which parts matter most to you and I'll try again.";
  return { mode: "claude", spec: repaired.spec, reply };
}

async function runDesignLoop(
  req: DesignRequest,
  client: MessagesClient,
  settings: { model: string; effort: Effort; maxIterations: number; catalog: Catalog },
): Promise<DesignDraft> {
  const current = req.currentSpec ?? DEFAULT_SPEC;
  const messages = conversation(req, current);
  let lastProposal = current;

  for (let iteration = 0; iteration < settings.maxIterations; iteration++) {
    const response = await client.beta.messages.create({
      model: settings.model,
      max_tokens: MAX_TOKENS,
      betas: [SERVER_SIDE_FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: settings.effort },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: DESIGNER_TOOLS,
      messages,
    });

    if (response.stop_reason === "refusal") return designOffline(req, "refusal", settings.catalog);
    // The full content goes back each turn: thinking blocks must be returned unchanged.
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason === "pause_turn") continue;

    if (response.stop_reason !== "tool_use") {
      // A plain answer (a question, an explanation) leaves the design as it was. Anything else,
      // such as hitting max_tokens mid tool call, is never acted on.
      const text = textOf(response.content);
      if (response.stop_reason === "end_turn" && text) return { mode: "claude", spec: current, reply: text };
      break;
    }

    const toolUses = response.content.filter(isToolUse);
    if (toolUses.length === 0) break;
    const results: BetaToolResultBlockParam[] = [];
    for (const block of toolUses) {
      const outcome = runDesignerTool(block, settings.catalog);
      if (outcome.kind === "submitted") return { mode: "claude", spec: outcome.spec, reply: outcome.reply };
      if (outcome.proposal) lastProposal = outcome.proposal;
      results.push(outcome.result);
    }
    // Every result for this turn goes back in a single user message.
    messages.push({ role: "user", content: results });
  }
  return unfinishedDraft(lastProposal, settings.catalog);
}

/** Why the API call failed, for the server log; undefined when the error isn't an API failure. */
function apiFailure(error: unknown): string | undefined {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return `API key rejected (${error.status})`;
  }
  if (error instanceof Anthropic.RateLimitError) return "rate limited (429)";
  if (error instanceof Anthropic.APIConnectionError) return "could not reach the API";
  if (error instanceof Anthropic.InternalServerError) return `API server error (${error.status})`;
  if (error instanceof Anthropic.APIError) return `request rejected (${error.status})`;
  return undefined;
}

/** Designs with Claude; on refusal or API failure, answers with the offline designer instead. */
export async function designWithClaude(req: DesignRequest, options: ClaudeDesignerOptions = {}): Promise<DesignDraft> {
  const catalog = options.catalog ?? CATALOG;
  try {
    return await runDesignLoop(req, options.client ?? new Anthropic(), {
      model: options.model ?? configuredModel(),
      effort: options.effort ?? configuredEffort(),
      maxIterations: options.maxIterations ?? MAX_ITERATIONS,
      catalog,
    });
  } catch (error) {
    const failure = apiFailure(error);
    if (!failure) throw error;
    console.error(`[designer] Claude unavailable, using the offline designer: ${failure}`);
    return designOffline(req, "unavailable", catalog);
  }
}
