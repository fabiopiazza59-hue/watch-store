import { describe, expect, it } from "vitest";
import { CHAT_HISTORY_MAX_TURNS, CHAT_TURN_MAX_LENGTH } from "@/domain/schemas";
import type { ChatTurn } from "@/domain/types";
import { toHistory } from "./chatHistory";

const turn = (role: ChatTurn["role"], content: string): ChatTurn => ({ role, content });

describe("toHistory", () => {
  it("keeps a short conversation as it is", () => {
    const turns = [turn("user", "A green field watch"), turn("assistant", "Here's a 38mm field watch.")];
    expect(toHistory(turns)).toEqual(turns);
  });

  it("keeps only the most recent turns, starting with the customer", () => {
    const turns = Array.from({ length: CHAT_HISTORY_MAX_TURNS + 5 }, (_, index) =>
      turn(index % 2 === 0 ? "user" : "assistant", `turn ${index}`),
    );
    const history = toHistory(turns);
    expect(history.length).toBeLessThanOrEqual(CHAT_HISTORY_MAX_TURNS);
    expect(history[0].role).toBe("user");
    expect(history.at(-1)).toEqual(turns.at(-1));
  });

  it("trims overlong turns and drops empty ones", () => {
    const history = toHistory([
      turn("user", "x".repeat(CHAT_TURN_MAX_LENGTH + 100)),
      turn("assistant", "   "),
      turn("assistant", "Done."),
    ]);
    expect(history.map((t) => t.content.length)).toEqual([CHAT_TURN_MAX_LENGTH, 5]);
  });

  it("returns nothing when there is no customer turn", () => {
    expect(toHistory([turn("assistant", "Hello")])).toEqual([]);
  });
});
