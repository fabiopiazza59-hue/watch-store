import { CHAT_HISTORY_MAX_TURNS, CHAT_TURN_MAX_LENGTH } from "@/domain/schemas";
import type { ChatTurn } from "@/domain/types";

/**
 * The conversation so far, trimmed to what the design API accepts: the most recent turns, each
 * within the length limit, starting with a customer turn.
 */
export function toHistory(turns: ChatTurn[]): ChatTurn[] {
  const recent = turns
    .filter((turn) => turn.content.trim().length > 0)
    .slice(-CHAT_HISTORY_MAX_TURNS)
    .map(({ role, content }) => ({ role, content: content.slice(0, CHAT_TURN_MAX_LENGTH) }));
  const firstUserTurn = recent.findIndex((turn) => turn.role === "user");
  return firstUserTurn === -1 ? [] : recent.slice(firstUserTurn);
}
