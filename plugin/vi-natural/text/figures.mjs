// A rewrite decides the wording and never what a number says. The model reads a figure as prose it
// may localise, so `12.371` came back with the separators swapped, a thousand times larger to the
// project that wrote it, and the pronoun "one" came back as the numeral `1` (ISS-2104). The document
// kind holds every figure out of the model's reach; this is the check for what the protector cannot
// hold — a figure the model wrote on its own.
//
// Invented only, never missing: a held figure the rewrite dropped is already a lost sentinel, and the
// digits an ordinal keeps ("3rd") may faithfully come back as a word.

/** A figure as it is written: digit groups and the separators between them, kept whole so that a
 *  respelling is a different figure rather than the same digits. */
export const FIGURE_SPELLING = String.raw`\d+(?:[-.,:/]\d+)*`;

/* A digit run glued to a letter is part of a name or a sentinel (`v3`, `⟦VI12⟧`), not a figure. */
const FIGURE = new RegExp(String.raw`(?<![\p{L}\p{N}_])${FIGURE_SPELLING}`, "gu");

const tally = (text) => {
  const counts = new Map();
  for (const [figure] of text.matchAll(FIGURE)) counts.set(figure, (counts.get(figure) ?? 0) + 1);
  return counts;
};

/** The figures a candidate carries that its source does not, named, or null. */
export function diff(source, candidate) {
  if (typeof source !== "string" || typeof candidate !== "string") return null;
  const had = tally(source);
  const added = [...tally(candidate)].filter(([figure, count]) => count > (had.get(figure) ?? 0)).map(([figure]) => figure);
  if (!added.length) return null;
  const sent = [...had.keys()];
  return `the rewrite carries the figure(s) ${added.join(", ")}, which the source does not (it carries ${sent.length ? sent.join(", ") : "none"}): a figure is copied exactly as it was written, never respelled, converted or written for a word`;
}
