import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC, TEMPLATES } from "../catalog";
import { validateSpec } from "../rules";
import type { WatchSpec } from "../types";
import { configuredEffort, configuredModel, designWithClaude, type MessagesClient } from "./claude";
import { SYSTEM_PROMPT } from "./prompt";

type Turn = Pick<Anthropic.Beta.BetaMessage, "content" | "stop_reason">;
type Block = Anthropic.Beta.BetaContentBlock;
type Request = Anthropic.Beta.MessageCreateParamsNonStreaming;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

const FIELD = TEMPLATES.find((t) => t.id === "tpl-everyday-field")?.spec as WatchSpec;
/** A diver dial made for a 3.8 o'clock crown, in a case with the crown at 3: not buildable. */
const UNBUILDABLE: WatchSpec = { ...FIELD, dialId: "dial-diver-black" };

const thinking: Block = { type: "thinking", thinking: "", signature: "sig-1" };
const text = (value: string): Block => ({ type: "text", text: value, citations: null });
const toolUse = (id: string, name: string, input: unknown): Block => ({ type: "tool_use", id, name, input });
const turn = (stop_reason: Turn["stop_reason"], ...content: Block[]): Turn => ({ content, stop_reason });

/** A client that plays back scripted responses (or throws scripted errors) and records every request. */
function scriptedClient(...script: (Turn | Error)[]) {
  const requests: Request[] = [];
  const client: MessagesClient = {
    beta: {
      messages: {
        create: async (params) => {
          requests.push(structuredClone(params));
          const next = script.shift();
          if (!next) throw new Error("The script has no more responses");
          if (next instanceof Error) throw next;
          return next;
        },
      },
    },
  };
  return { client, requests };
}

function lastMessage(request: Request | undefined) {
  return request?.messages[request.messages.length - 1];
}

function toolResults(request: Request | undefined): ToolResult[] {
  const content = lastMessage(request)?.content;
  return Array.isArray(content) ? content.filter((block): block is ToolResult => block.type === "tool_result") : [];
}

describe("designWithClaude", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ANTHROPIC_MODEL", "");
    vi.stubEnv("ANTHROPIC_EFFORT", "");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("sends the configured model, effort, fallbacks, cached system prompt and both tools", async () => {
    const { client, requests } = scriptedClient(turn("end_turn", text("Happy to help!")));
    await designWithClaude({ message: "hello", currentSpec: FIELD }, { client });

    const [request] = requests;
    expect(request).toMatchObject({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    });
    expect(request).not.toHaveProperty("temperature");
    expect(request).not.toHaveProperty("tool_choice");
    expect(request.tools?.map((tool) => ("name" in tool ? tool.name : ""))).toEqual(["check_design", "submit_design"]);
    const latest = lastMessage(request);
    expect(latest?.role).toBe("user");
    expect(latest?.content).toContain(JSON.stringify(FIELD, null, 2));
    expect(latest?.content).toContain("hello");
  });

  it("checks, gets a rejected submission back as an error, and ends on a buildable submission", async () => {
    const { client, requests } = scriptedClient(
      turn("tool_use", thinking, toolUse("t1", "check_design", FIELD), toolUse("t2", "check_design", { dial: "blue" })),
      turn("tool_use", toolUse("t3", "submit_design", { spec: UNBUILDABLE, reply: "Here you go." })),
      turn("tool_use", toolUse("t4", "submit_design", { spec: FIELD, reply: "An olive field watch on canvas." })),
    );

    const draft = await designWithClaude({ message: "a green field watch" }, { client });

    expect(draft).toEqual({ mode: "claude", spec: FIELD, reply: "An olive field watch on canvas." });
    expect(requests).toHaveLength(3);

    // The assistant turn is passed back whole (thinking included), then all results in one message.
    const second = requests[1];
    expect(second.messages[second.messages.length - 2]).toEqual({ role: "assistant", content: [
      thinking,
      toolUse("t1", "check_design", FIELD),
      toolUse("t2", "check_design", { dial: "blue" }),
    ] });
    const [checked, malformed] = toolResults(second);
    expect(toolResults(second)).toHaveLength(2);
    expect(checked).toMatchObject({ tool_use_id: "t1", is_error: false });
    expect(JSON.parse(String(checked.content))).toMatchObject({ buildable: true, price: expect.any(Object) });
    expect(malformed).toMatchObject({ tool_use_id: "t2", is_error: true });
    expect(String(malformed.content)).toContain("Invalid input for check_design");

    const [rejected] = toolResults(requests[2]);
    expect(rejected).toMatchObject({ tool_use_id: "t3", is_error: true });
    expect(JSON.parse(String(rejected.content))).toMatchObject({
      accepted: false,
      errors: [expect.objectContaining({ rule: "dial-crown-position", severity: "error" })],
    });
  });

  it("falls back to the offline designer when Claude refuses", async () => {
    const { client } = scriptedClient(turn("refusal"));
    const draft = await designWithClaude({ message: "a field watch" }, { client });
    expect(draft.mode).toBe("offline");
    expect(draft.reply).toMatch(/couldn't take this request/);
    expect(validateSpec(draft.spec).buildable).toBe(true);
  });

  it.each([
    ["an invalid API key", new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", new Headers())],
    ["a rate limit", new Anthropic.RateLimitError(429, undefined, "slow down", new Headers())],
    ["a connection failure", new Anthropic.APIConnectionError({ message: "Connection error." })],
    ["a server error", new Anthropic.InternalServerError(529, undefined, "overloaded", new Headers())],
  ])("falls back to the offline designer on %s, without leaking the error", async (_, error) => {
    const { client } = scriptedClient(error);
    const draft = await designWithClaude({ message: "a field watch" }, { client });
    expect(draft.mode).toBe("offline");
    expect(draft.reply).toMatch(/unavailable right now/);
    expect(draft.reply).not.toContain(error.message);
  });

  it("lets programming errors through instead of hiding them", async () => {
    const { client } = scriptedClient(new TypeError("boom"));
    await expect(designWithClaude({ message: "a field watch" }, { client })).rejects.toThrow("boom");
  });

  it("keeps the current design when Claude answers in plain text", async () => {
    const { client } = scriptedClient(turn("end_turn", text("Do you prefer a date window?")));
    const draft = await designWithClaude({ message: "a field watch", currentSpec: FIELD }, { client });
    expect(draft).toEqual({ mode: "claude", spec: FIELD, reply: "Do you prefer a date window?" });
  });

  it("never runs a tool call cut off by max_tokens", async () => {
    const { client, requests } = scriptedClient(
      turn("max_tokens", toolUse("t1", "submit_design", { spec: FIELD, reply: "Here" })),
    );
    const draft = await designWithClaude({ message: "a field watch" }, { client });
    expect(requests).toHaveLength(1);
    expect(draft.spec).toEqual(DEFAULT_SPEC);
    expect(draft.reply).toMatch(/couldn't finish/);
  });

  it("resumes a paused turn by sending the assistant content back", async () => {
    const { client, requests } = scriptedClient(
      turn("pause_turn", thinking),
      turn("tool_use", toolUse("t1", "submit_design", { spec: FIELD, reply: "Done." })),
    );
    const draft = await designWithClaude({ message: "a field watch" }, { client });
    expect(draft.reply).toBe("Done.");
    expect(lastMessage(requests[1])).toEqual({ role: "assistant", content: [thinking] });
  });

  it("repairs the last proposal when it runs out of iterations", async () => {
    const { client, requests } = scriptedClient(
      turn("tool_use", toolUse("t1", "check_design", UNBUILDABLE)),
      turn("tool_use", toolUse("t2", "check_design", UNBUILDABLE)),
    );
    const draft = await designWithClaude({ message: "a field watch" }, { client, maxIterations: 2 });
    expect(requests).toHaveLength(2);
    expect(draft.mode).toBe("claude");
    expect(validateSpec(draft.spec).buildable).toBe(true);
    expect(draft.spec.caseId).toBe(UNBUILDABLE.caseId);
  });

  it("sends history as alternating text turns that start with the customer", async () => {
    const { client, requests } = scriptedClient(turn("end_turn", text("Sure.")));
    await designWithClaude(
      {
        message: "and a leather strap",
        history: [
          { role: "assistant", content: "Hello! What shall we design?" },
          { role: "user", content: "a field watch" },
          { role: "assistant", content: "Here's a field watch." },
        ],
      },
      { client },
    );
    const roles = requests[0].messages.map((message) => message.role);
    expect(roles).toEqual(["user", "assistant", "user"]);
    expect(requests[0].messages[0].content).toBe("a field watch");
  });
});

describe("configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads the model and effort from the environment, with safe defaults", () => {
    vi.stubEnv("ANTHROPIC_MODEL", "");
    vi.stubEnv("ANTHROPIC_EFFORT", "");
    expect(configuredModel()).toBe("claude-opus-5");
    expect(configuredEffort()).toBe("medium");

    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-5");
    vi.stubEnv("ANTHROPIC_EFFORT", "high");
    expect(configuredModel()).toBe("claude-sonnet-5");
    expect(configuredEffort()).toBe("high");

    vi.stubEnv("ANTHROPIC_EFFORT", "extreme");
    expect(configuredEffort()).toBe("medium");
  });
});
