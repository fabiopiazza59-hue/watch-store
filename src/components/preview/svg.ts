// Small SVG conventions shared by the preview layers.

/** Builds document-unique ids for gradients, filters and clips from one React id. */
export type IdFor = (name: string) => string;

export function idFactory(reactId: string): IdFor {
  const scope = reactId.replace(/[^A-Za-z0-9]/g, "");
  return (name) => `wp${scope}-${name}`;
}

export const url = (id: string) => `url(#${id})`;

/** Neutral dashed look for any part that has not been chosen yet. */
export const PLACEHOLDER = {
  fill: "#ece8e1",
  fillOpacity: 0.55,
  stroke: "#9d978d",
  strokeWidth: 0.2,
  strokeDasharray: "0.9 0.6",
} as const;

export const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
export const SERIF = "Georgia, 'Times New Roman', Times, serif";
