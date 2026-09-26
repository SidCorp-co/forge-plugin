/* What the eval reads off the log's rows: the key a consult is grouped under and what one verdict row ruled, the two readers `forge codex stats` and the run corpus share so their figures cannot disagree. docs/cli/codex-the-stats.md. */
import { numbered } from "../log/replies.mjs";

/* The eval the log exists for: what each model found, what the caller kept, cached over every input
   token. The channel is part of the key and an unrecorded one is a value of its own: a row written
   before the effort moved onto the model states an effort the gateway never read, and grouping it
   with one written after would score two treatments as one. Where the model carried the effort its
   id already says which, so the level is not repeated in the key. */
export const modelKey = (one) => {
  const via = one.effortVia ?? "unrecorded";
  const level = via !== "model" && one.effort ? ` @${one.effort}` : "";
  return `${one.model ?? one.slot ?? "?"}${level} via ${via}`;
};

/** What one verdict row ruled, counted over the findings its consult's own reply carries: before ISS-651 the parser gave a positional id to a summary bullet in a reply counting itself at zero, and fifteen rows ruled on those ids. The log is append-only and the only copy of the corpus, so the row stays and the count skips what it names beyond the reply (ISS-1680). A count-form row names no id, and a recheck's rulings are the lines `numbered` leaves out, so its typed totals are all there is to read; a row whose consult the log does not hold is read by its totals for the same reason. */
export const ruledOn = (verdict, consult) => {
  const made = consult ? new Set(numbered(consult.reply).map((one) => one.id)) : null;
  const madeIn = (ids) => (made ? ids.filter((id) => made.has(id)).length : ids.length);
  /* A mechanism mark is always by id, so it is counted by id even on a row whose totals are a count's: a later word ruling on how over a count-form prior is new data, not the old count's. */
  const how = { sound: madeIn(verdict.sound ?? []), misreasoned: madeIn(Object.keys(verdict.misreasoned ?? {})) };
  if (!consult || verdict.counted || (!verdict.kept && !verdict.dropped)) {
    return { accepted: verdict.accepted ?? 0, rejected: verdict.rejected ?? 0, ...how };
  }
  return { accepted: madeIn(verdict.kept ?? []), rejected: madeIn(Object.keys(verdict.dropped ?? {})), ...how };
};
