/* What is already open beside a filing, asked of the tracker's own memory search from inside the
   create path. Every decision below — the two queries, the floor, why the fold answers to both of
   them and what that costs, and the cases it cannot reach — is docs/cli/beside.md's. */
import { tried } from "./rpc.mjs";

const TOOL = "forge_memory.search";
const SOURCE = ["issue"];
const TOP_K = 10;
const QUERY_MAX = 4000;
const NO_SCORE = "  —  ";
const KEY = 8;

/** Measured, 2026-09-04: two thresholds, not one, showing costing a glance and folding costing a
 *  comment nothing can take back. docs/cli/beside.md holds the numbers behind both. */
export const FLOOR = 0.7;
export const FOLD_FLOOR = 0.78;

export const BESIDE_HELP = [
  "Every filing is measured against what is already open. Two questions go to the tracker's own",
  "memory: what reads like this filing, and what names the same place — the first path or verb the",
  `*Where* section gives, or the body's own first. Neighbours at or above ${FLOOR.toFixed(2)} print`,
  "under the reply with their key, that score and whether the place matched, on every filing and",
  "including the one that found nothing. None of it refuses anything.",
  "",
  `A filing folds onto one only at ${FOLD_FLOOR.toFixed(2)}, above the band where a neighbour shares`,
  "the machinery and not the subject: what is worth a glance is not worth a comment.",
  "",
  "  --new       file it even where the mark would have folded it, and say what it would have joined",
  "",
  "A filing marked `Size: fix.` lands on the nearest of the neighbours naming its place, as a",
  "finding under its own title instead of becoming a second issue. It takes no lease and it does",
  "read the thread first, once, the way a named target does. Both signals are needed: the place",
  "query ranks nothing — every hit comes back at one score — so a fold on it alone would post a",
  "comment, which nothing here can take back, onto an arbitrary issue.",
].join("\n");

const hitsOf = (answer) => (Array.isArray(answer?.hits) ? answer.hits : []);
const first = (text) => String(text ?? "").split("\n")[0];

const ask = async (query, strategy) => {
  const text = String(query ?? "").trim();
  /* A `note` means a query that COULD not run, so one with no subject leaves none. */
  if (!text) return { hits: [], note: null };
  const answer = await tried(TOOL, {
    query: text.slice(0, QUERY_MAX),
    topK: TOP_K,
    strategy,
    sourceFilter: SOURCE,
  });
  if (answer?.refused) {
    return { hits: [], note: `the ${strategy} query could not run: ${first(answer.refused)}` };
  }
  return { hits: hitsOf(answer), note: null };
};

/** Every open issue either query reached. The key, the title and the open-ness are the
 *  projection's, which `live` already is, so the resolve costs no call of its own. */
export const neighboursOf = async ({ seed, place }, live) => {
  const open = new Map(live.filter((one) => one.documentId).map((one) => [one.documentId, one]));
  const [near, named] = await Promise.all([ask(seed, "semantic"), ask(place, "keyword")]);
  const samePlace = new Set(named.hits.map((one) => one.sourceRef));
  const found = new Map();
  const add = (ref, score) => {
    const row = open.get(ref);
    if (!row) return;
    found.set(ref, {
      issueId: row.issueId,
      documentId: ref,
      title: row.title,
      score: score ?? found.get(ref)?.score ?? null,
      samePlace: samePlace.has(ref),
    });
  };
  for (const hit of near.hits) if (Number(hit.score) >= FLOOR) add(hit.sourceRef, Number(hit.score));
  for (const hit of named.hits) add(hit.sourceRef, null);
  return {
    place,
    notes: [near.note, named.note].filter(Boolean),
    /* Scored first and descending, so `foldOnto` reads the nearest off the front. */
    suggestions: [...found.values()].sort((one, two) => (two.score ?? 0) - (one.score ?? 0)),
  };
};

/** The issue a fix-size filing joins: the nearest of those the place query found too, at the
 *  fold's own threshold. Nearest among THOSE, and no line here calls it nearest of all. */
export const foldOnto = (suggestions) =>
  suggestions.find((one) => one.samePlace && one.score !== null && one.score >= FOLD_FLOOR) ?? null;

const row = (one) =>
  `  ${one.issueId.padEnd(KEY)} ${one.score === null ? NO_SCORE : one.score.toFixed(2)}  `
  + `${one.samePlace ? "same place  " : "            "}${one.title}`;

const HEAD = "Open beside this filing, by the tracker's own memory — key, how near it reads, and "
  + "whether it names the same place:";
const SHOWN = "Nothing above is a refusal: a duplicate filed anyway is one the filer was shown.";

const named = (place) => (place ? ` or names \`${place}\`` : "");

/* An empty answer and an unmeasured one are what this tells apart, so one line is not both. */
const emptyLine = (place, measured) =>
  (measured
    ? `Nothing open reads like this filing${named(place)} — the check ran and found none.`
    : `Nothing open that was measured reads like this filing${named(place)}, and the check did not`
      + " run whole:");

/* Qualifying and being foldable are two questions; one answer has `--new` reporting a fiction. */
const declinedLine = (nearest, foldable) => {
  if (!nearest) {
    return `--new declined nothing: no open issue both reads like this filing at ${FOLD_FLOOR.toFixed(2)}`
      + " and names its place, so it was filed as it would have been without the flag.";
  }
  if (!foldable) {
    return `--new declined nothing to decline: ${nearest.issueId} would have qualified, and only a`
      + " filing marked `Size: fix.` riding no other issue folds, so this was always a filing.";
  }
  return `--new declined the fold: this filing is marked and ${nearest.issueId} is the nearest of the`
    + " neighbours naming its place, so it would have landed there as a finding rather than as an"
    + " issue of its own.";
};

/** Under every filing: the empty answer, the failed search and the folded one. `fresh` is `--new`,
 *  which closes the block on every outcome rather than only where it acted. */
export const suggestionLines = ({ suggestions, notes, place },
  { nearest = null, foldable = false, fresh = false } = {}) => {
  const out = suggestions.length
    ? [HEAD, ...suggestions.map(row), SHOWN]
    : [emptyLine(place, !notes.length)];
  for (const note of notes) out.push(`${note} — this filing was made as it would have been without it.`);
  if (fresh) out.push(declinedLine(nearest, foldable));
  return out;
};

/** The fold's reply: no filing happened, so a reader after its key is told where the body went. */
export const foldedInto = (joined) =>
  `${joined.issueId} is open, names the same place and is the nearest of the neighbours that do, at`
  + ` ${joined.score.toFixed(2)}; this filing is marked \`Size: fix.\`, so it lands there as a finding`
  + " under its own title rather than as a second issue. No issue was filed and no lease was taken;"
  + " `--new` files it separately, and the block below is everything it was measured against.";
