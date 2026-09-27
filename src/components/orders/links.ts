/**
 * The customer's confirmation page for an order. The token (from placing the order) keeps other
 * people's orders out of reach when the server signs confirmation links.
 */
export function confirmationHref(orderId: string, token: string | null): string {
  const path = `/order-placed/${encodeURIComponent(orderId)}`;
  return token ? `${path}?t=${encodeURIComponent(token)}` : path;
}
