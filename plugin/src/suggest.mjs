/* "Did you mean" for every name this CLI accepts. An agent recalls a name from the wrong SHAPE,
   not the wrong keys, so the match is on the separator-stripped form. */

import { FLAG_WORD } from "./resolve/flags.mjs";

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

export const suggest = (given, candidates, limit = 5) =>
  candidates
    .map((candidate) => ({ candidate, points: rank(given, candidate) }))
    .filter((scored) => Number.isFinite(scored.points))
    .sort((one, other) => one.points - other.points)
    .slice(0, limit)
    .map((scored) => scored.candidate);

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

export const flagsNamed = (usage) => [...new Set(usage.match(/--[a-z][\w-]*/gu) ?? [])];

/** Only a flag SHAPE is turned away; a flag no row names is offered to nobody — did-you-mean.md. */
export const unknownFlag = (verb, argv, { usage, hidden = [] }) => {
  const named = flagsNamed(usage);
  const known = [...named, ...hidden];
  const given = argv.find((token) => FLAG_WORD.test(token) && !known.includes(token));
  return given ? didYouMean(`${verb} flag`, given, named, usage) : null;
};
