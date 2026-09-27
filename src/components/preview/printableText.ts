import { reviewText } from "@/domain/rules";
import type { Dial } from "@/domain/types";

/**
 * Whether the preview may draw this dial text: never on a dial that can't be printed, and never
 * another watch brand or a Swiss indication. Text that is only too long or has an odd character
 * is still drawn, so the customer sees what they typed while the rules engine asks for a change.
 */
export function isPrintableDialText(dial: Dial | undefined, text: string): boolean {
  if (!text.trim()) return true;
  const { trademarks, protectedIndications } = reviewText(text);
  return dial?.printable !== false && trademarks.length === 0 && protectedIndications.length === 0;
}
