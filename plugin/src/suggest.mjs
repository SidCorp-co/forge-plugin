/* "Did you mean" for every name this CLI accepts, importing only the form table, because the parser
   asks it for the parser's own refusal. An agent recalls a name from the wrong SHAPE, not the keys. */
import { handledBy } from "./resolve/handler.mjs";

export const bare = (name) => name.replace(/[._\- ]/gu, "").toLowerCase();

const distance = (left, right) => {
  let previous = [...Array(right.length + 1).keys()];
  for (let index = 1; index <= left.length; index += 1) {
    const row = [index];
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[index - 1] === right[column - 1] ? 0 : 1;
      row[column] = Math.min(row[column - 1] + 1, previous[column] + 1, previous[column - 1] + cost);
    }
    previous = row;
  }
  return previous[right.length];
};

/* Zero means the stripped forms match, so a separator-only difference sorts first. */
const rank = (given, candidate) => {
  const [left, right] = [bare(given), bare(candidate)];
  if (left === right) return 0;
  if (right.includes(left) || left.includes(right)) return 1;
  const gap = distance(left, right);
  return gap <= Math.max(2, Math.floor(left.length / 3)) ? 1 + gap : Infinity;
};

export const suggest = (given, candidates, limit = 5) => {
  /* The handled forms are the synonyms too, read before distance: `forge get` is performed rather than suggested, and `forge attach get` is the same word where no verb runs. */
  const meant = handledBy(bare(given))?.verb;
  if (meant && candidates.includes(meant)) return [meant];
  return candidates
    .map((candidate) => ({ candidate, points: rank(given, candidate) }))
    .filter((scored) => Number.isFinite(scored.points))
    .sort((one, other) => one.points - other.points)
    .slice(0, limit)
    .map((scored) => scored.candidate);
};

/* A set this short beats a route to it; past it a set is a list rather than a sentence. */
const SET_SHOWN = 8;

const setSaid = (candidates, close) =>
  candidates.length < SET_SHOWN && candidates.length > close.length
    ? ` The set is ${candidates.join(", ")}.`
    : "";

/** What was given, the nearest names, the short set — and the hint only where the set is not said. */
export const didYouMean = (kind, given, candidates, hint) => {
  const close = suggest(given, candidates);
  const nearest = close.length ? ` Did you mean: ${close.join(", ")}?` : "";
  const set = setSaid(candidates, close);
  const route = nearest || set || !hint ? "" : ` ${hint}`;
  return `No ${kind} named ${given}.${nearest}${set}${route}`;
};

