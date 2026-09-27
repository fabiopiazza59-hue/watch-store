// The Claude designer: a manual tool-use loop in which Claude proposes designs and the rules engine
// (through the tools) decides which are buildable. Any API failure or refusal falls back to the
// offline designer, so the customer always gets an answer. Each customer message has a time limit
// and an output-token budget, so neither latency nor spend can run away.
import Anthropic from "@anthropic-ai/sdk";
import { CATALOG, DEFAULT_SPEC } from "../catalog";
import { repairSpec } from "../rules";
import type { Catalog, DesignRequest, WatchSpec } from "../types";
import { designOffline } from "./offline";
import { MAX_REPLY_LENGTH, SYSTEM_PROMPT } from "./prompt";
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

const MAX_ITERATIONS = 6;
/** Room for adaptive thinking plus a tool call; a lower cap risks cutting a call off mid-way. */
const MAX_TOKENS = 16000;
/** Output tokens (thinking included) one customer message may spend across all its rounds. */
const OUTPUT_TOKEN_BUDGET = 40_000;
/** Time one customer message may take; after that the best answer so far is returned. */
const DESIGN_DEADLINE_MS = 90_000;
/** A round started with less time than this left would almost certainly be cut off. */
const MIN_ROUND_MS = 5_000;
/** Plain-text answers (a question, an explanation) may run a little longer than a design reply. */
const MAX_TEXT_REPLY_LENGTH = 2 * MAX_REPLY_LENGTH;
/** Lets the API retry a refused request on a suitable fallback model server-side. */
const SERVER_SIDE_FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Sent once when Claude describes a design it checked but didn't submit, so the preview can show it. */
export const SUBMIT_NUDGE =
  "If your reply proposes the design you checked, call submit_design with it now; otherwise repeat your reply unchanged.";

type DesignerMessage = Pick<BetaMessage, "content" | "stop_reason"> & {
  usage?: Pick<BetaMessage["usage"], "output_tokens">;
};

/** The slice of the Anthropic client the designer uses, so tests can script the conversation. */
export interface MessagesClient {
  beta: {
    messages: {
      create(params: MessageCreateParams, options?: { signal?: AbortSignal }): PromiseLike<DesignerMessage>;
    };
  };
}

export interface ClaudeDesignerOptions {
  client?: MessagesClient;
  model?: string;
  effort?: Effort;
  maxIterations?: number;
  catalog?: Catalog;
  /** Ends the conversation early, e.g. when the customer has gone. */
  signal?: AbortSignal;
  /** Time limit for the whole conversation, in milliseconds. */
  deadlineMs?: number;
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
 * wants the customer to speak first, so a leading assistant greeting is dropped. The design is
 * fenced in a tag: its name and texts are whatever the customer (or a shared link) typed, and the
 * system prompt says to treat them as data.
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
    content:
      `${shown}:\n<current_design>\n${JSON.stringify(current, null, 2)}\n</current_design>\n\n` +
      `Customer's message:\n${req.message}`,
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

function sameSpec(a: WatchSpec, b: WatchSpec): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** Cuts text to `max` characters, at the end of a sentence when one ends in the second half. */
function truncateAtSentence(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const sentenceEnds = [...cut.matchAll(/[.!?](?=\s)/g)].map((match) => match.index);
  const lastEnd = sentenceEnds.at(-1) ?? -1;
  if (lastEnd >= max / 2) return cut.slice(0, lastEnd + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace >= max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** A plain-text answer as the chat shows it: no markdown emphasis, headings or list bullets, bounded. */
function plainReply(text: string): string {
  const plain = text
    .replace(/\*\*|__/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[ \t]*[-*•][ \t]+/gm, "")
    .trim();
  return truncateAtSentence(plain, MAX_TEXT_REPLY_LENGTH);
}

/**
 * The answer when the conversation ends without a submitted design (out of rounds, time or budget,
 * or a turn that can't be acted on): Claude's last proposal if it can be made buildable, otherwise
 * the offline designer's take on the message.
 */
function fallbackDraft(req: DesignRequest, current: WatchSpec, proposal: WatchSpec, catalog: Catalog): DesignDraft {
  if (!sameSpec(proposal, current)) {
    const repaired = repairSpec(proposal, catalog);
    if (repaired.report.buildable) {
      const reply =
        repaired.changes.length > 0
          ? "I couldn't finish refining this design, so I've let the workshop's automatic fixes make my last idea buildable. Have a look, and tell me what you'd like to change."
          : "I couldn't finish refining this design, so here is my latest idea. Have a look, and tell me what you'd like to change.";
      return { mode: "claude", spec: repaired.spec, reply };
    }
  }
  return designOffline(req, "unavailable", catalog);
}

function isAbort(error: unknown): boolean {
  return error instanceof Anthropic.APIUserAbortError || error instanceof Anthropic.APIConnectionTimeoutError;
}

interface LoopSettings {
  model: string;
  effort: Effort;
  maxIterations: number;
  catalog: Catalog;
  signal?: AbortSignal;
  deadlineMs: number;
}

async function runDesignLoop(req: DesignRequest, client: MessagesClient, settings: LoopSettings): Promise<DesignDraft> {
  const current = req.currentSpec ?? DEFAULT_SPEC;
  const messages = conversation(req, current);
  const deadline = Date.now() + settings.deadlineMs;
  let lastProposal = current;
  let outputTokens = 0;
  /** A plain-text answer held back while Claude is asked whether it meant to submit a design. */
  let heldReply: string | undefined;

  for (let iteration = 0; iteration < settings.maxIterations; iteration++) {
    const remaining = deadline - Date.now();
    if (settings.signal?.aborted || remaining < MIN_ROUND_MS || outputTokens >= OUTPUT_TOKEN_BUDGET) break;
    const timeout = AbortSignal.timeout(remaining);
    const signal = settings.signal ? AbortSignal.any([settings.signal, timeout]) : timeout;

    let response: DesignerMessage;
    try {
      response = await client.beta.messages.create(
        {
          model: settings.model,
          max_tokens: MAX_TOKENS,
          betas: [SERVER_SIDE_FALLBACK_BETA],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: { effort: settings.effort },
          // Caches the conversation so far for the next round; the system prompt has its own marker.
          cache_control: { type: "ephemeral" },
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          tools: DESIGNER_TOOLS,
          messages,
        },
        { signal },
      );
    } catch (error) {
      if (!signal.aborted && !isAbort(error)) throw error;
      const why = settings.signal?.aborted ? "the request was cancelled" : "it ran out of time";
      console.warn(`[designer] Claude conversation stopped early: ${why}`);
      break;
    }
    outputTokens += response.usage?.output_tokens ?? 0;

    if (response.stop_reason === "refusal") return designOffline(req, "refusal", settings.catalog);
    // The full content goes back each turn: thinking blocks must be returned unchanged.
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason === "pause_turn") continue;

    if (response.stop_reason !== "tool_use") {
      // A plain answer (a question, an explanation) leaves the design as it was. Anything else,
      // such as hitting max_tokens mid tool call, is never acted on.
      const text = textOf(response.content);
      if (response.stop_reason !== "end_turn" || !text) break;
      const checkedAnotherDesign = !sameSpec(lastProposal, current);
      const canAskAgain = heldReply === undefined && iteration + 1 < settings.maxIterations;
      if (checkedAnotherDesign && canAskAgain && !text.endsWith("?")) {
        heldReply = text;
        messages.push({ role: "user", content: SUBMIT_NUDGE });
        continue;
      }
      return { mode: "claude", spec: current, reply: plainReply(text) };
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
  if (heldReply !== undefined) return { mode: "claude", spec: current, reply: plainReply(heldReply) };
  return fallbackDraft(req, current, lastProposal, settings.catalog);
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
    // One retry at most: the conversation's own deadline bounds the time any call can take.
    return await runDesignLoop(req, options.client ?? new Anthropic({ maxRetries: 1 }), {
      model: options.model ?? configuredModel(),
      effort: options.effort ?? configuredEffort(),
      maxIterations: options.maxIterations ?? MAX_ITERATIONS,
      catalog,
      signal: options.signal,
      deadlineMs: options.deadlineMs ?? DESIGN_DEADLINE_MS,
    });
  } catch (error) {
    const failure = apiFailure(error);
    if (!failure) throw error;
    console.error(`[designer] Claude unavailable, using the offline designer: ${failure}`);
    return designOffline(req, "unavailable", catalog);
  }
}
