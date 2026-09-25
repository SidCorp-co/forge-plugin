/* What is already filed beside a filing, open or settled, asked of the tracker's own memory search from inside the create path. Every decision below is docs/cli/beside.md's for the reading — the two queries, both floors, the term each is asked on — and docs/cli/the-fold.md's for the act. */
import { mustBeShown, postComment } from "../comments.mjs";
import { owesCause } from "../issue-shape.mjs";
import { foldedBody, handleIn } from "../../flow/earned/findings.mjs";
import { tried } from "../rest.mjs";
import { firstLine } from "../../resolve/flags.mjs";
import { settledLines, withReasons } from "./settled.mjs";

export const SEARCH_ROUTE = "forge_memory.search";
const SOURCE = ["issue"];
export const TOP_K = 10;
/** The place net's own width, and not a display budget: how many issues naming this place may be eligible to take a finding, where the block below still prints `TOP_K` of them. Fifty because the deepest place rank at which the fold's own destination sat, measured 2026-09-14 over 24 open issues, was 34 — a ceiling and not an exhaustion point, the scored answer for a place as broad as a common verb running past any ask. Where the net ends is that score rather than this number: over six terms every hit the tracker scored above zero held the place term verbatim in the text it embedded, and none of the forty it scored zero did. docs/cli/beside.md carries both measurements. */
export const PLACE_K = 50;
const QUERY_MAX = 4000;
const NO_SCORE = "  —  ";
const KEY = 8;

/** Measured, 2026-09-04: two thresholds, because showing costs a glance and folding costs a comment nothing can take back. */
export const FLOOR = 0.7;
export const FOLD_FLOOR = 0.78;

/* `topK` is an ask this tracker answers past, so the bound is applied here, against the ask that was made rather than against one constant: the two queries want different widths and neither may read the other's surplus. Every count below is off what this reader kept, and a reading that filled the bound with nothing under the floor is the one that may be short. docs/cli/alike.md carries the measurement and the two readings that are not short. */
const hitsOf = (answer, want) => (Array.isArray(answer?.hits) ? answer.hits : []).slice(0, want);

const ask = async (query, strategy, want) => {
  const text = String(query ?? "").trim();
  /* A `note` means a query that COULD not run, so one with no subject leaves none. */
  if (!text) return { hits: [], note: null };
  const answer = await tried(SEARCH_ROUTE, {
    query: text.slice(0, QUERY_MAX),
    topK: want,
    strategy,
    sourceFilter: SOURCE,
  });
  if (answer?.refused) {
    return { hits: [], note: `the ${strategy} query could not run: ${firstLine(answer.refused)}` };
  }
  return { hits: hitsOf(answer, want), note: null };
};

const namingPlace = (hits) => hits.filter((one) => Number(one.score) > 0);

const cutInBand = (hits, inBand) => hits.length >= TOP_K && inBand >= hits.length;

/* A settled row the semantic query ranked at the floor, as the open rows are: nearness is what makes it the same subject, and a settled row that only names the place is machinery nobody has to decide about. */
const settledNear = (hits, settled, samePlace) => {
  const held = new Map(settled.map((one) => [one.documentId, one]));
  const near = new Map();
  for (const hit of hits) {
    const row = held.get(hit.sourceRef);
    if (!row || Number(hit.score) < FLOOR || near.has(hit.sourceRef)) continue;
    near.set(hit.sourceRef, { ...row, score: Number(hit.score), samePlace: samePlace.has(hit.sourceRef) });
  }
  const found = [...near.values()].sort((one, two) => two.score - one.score);
  return { dropped: found.filter((one) => one.status === "dropped"), closed: found.filter((one) => one.status === "closed") };
};

/** Every open issue either query reached, and beside them the settled ones the semantic query reached. The key, the title and the status are the projection's — `live` for the open rows, `settled` for the rest, both off the walk already made — so the resolve costs no call of its own. A caller passing no `settled` measures open against open, as the sweep and the ranking do. */
export const neighboursOf = async ({ seed, place }, live, settled = []) => {
  const open = new Map(live.filter((one) => one.documentId).map((one) => [one.documentId, one]));
  const [near, named] = await Promise.all([ask(seed, "semantic", TOP_K), ask(place, "keyword", PLACE_K)]);
  const inPlace = namingPlace(named.hits);
  const samePlace = new Set(inPlace.map((one) => one.sourceRef));
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
  const inBand = near.hits.filter((one) => Number(one.score) >= FLOOR).length;
  for (const hit of near.hits) if (Number(hit.score) >= FLOOR) add(hit.sourceRef, Number(hit.score));
  for (const hit of inPlace.slice(0, TOP_K)) add(hit.sourceRef, null);
  const { dropped, closed } = settledNear(near.hits, settled, samePlace);
  return {
    dropped: await withReasons(dropped),
    closed,
    place,
    notes: [near.note, named.note].filter(Boolean),
    inBand,
    cut: cutInBand(near.hits, inBand),
    /* Scored first and descending, so `foldOnto` reads the nearest off the front. */
    suggestions: [...found.values()].sort((one, two) => (two.score ?? 0) - (one.score ?? 0)),
  };
};

/** The issue a filing below the top rung joins: the nearest of those the place query found too, at the fold's own threshold. Nearest among THOSE, and no line here calls it nearest of all. */
export const foldOnto = (suggestions) =>
  suggestions.find((one) => one.samePlace && one.score !== null && one.score >= FOLD_FLOOR) ?? null;

const row = (one) =>
  `  ${one.issueId.padEnd(KEY)} ${one.score === null ? NO_SCORE : one.score.toFixed(2)}  `
  + `${one.samePlace ? "same place  " : "            "}${one.title}`;

const HEAD = "Open beside this filing, by the tracker's own memory — key, how near it reads, and "
  + "whether it names the same place:";
const SHOWN = "Nothing above is a refusal: a duplicate filed anyway is one the filer was shown.";

const named = (place) => (place ? ` or names \`${place}\`` : "");

/* An empty answer, a settled one and an unmeasured one are what this tells apart, so one line is not two of them: nothing filed before is not the same news as filed before and settled. */
const emptyLine = (place, measured, settled) => {
  if (!measured) {
    return `Nothing open that was measured reads like this filing${named(place)}, and the check did not`
      + " run whole:";
  }
  if (settled) return `Nothing open reads like this filing${named(place)} — but it was filed before, and settled:`;
  const naming = place ? `, and nothing open names \`${place}\`` : "";
  return `Nothing filed before reads like this filing, open or settled${naming} — the check ran and found none.`;
};

/* Qualifying and being foldable are two questions; one answer has `--new` reporting a fiction. And
   the two ways of not being foldable are two answers: a filer told the wrong one looks for a mark. */
const neverFoldable = (nearest, routed) =>
  `--new declined nothing to decline: ${nearest.issueId} would have qualified, and ${routed
    ? "this filing rides another issue's branch, which folds onto nothing"
    : "this filing is of a kind whose body names no cause, so there is no place to land it by"}, so`
  + " this was always a filing.";

const declinedLine = (nearest, foldable, routed) => {
  if (!nearest) {
    return `--new declined nothing: no open issue both reads like this filing at ${FOLD_FLOOR.toFixed(2)}`
      + " and names its place, so it was filed as it would have been without the flag.";
  }
  if (!foldable) return neverFoldable(nearest, routed);
  return `--new declined the fold: ${nearest.issueId} is the nearest of the neighbours naming the place`
    + " this filing's cause names, and it reads like it, so it would have landed there as a finding"
    + " rather than as an issue of its own.";
};

/* The hold `--new` declined is a second thing it did, so a fold it had nothing to decline goes
   unsaid beside it rather than reading as the flag having done nothing. */
const heldLine = ({ where, key, title, score }) =>
  `--new declined the duplicate hold: ${where} of this filing reads like ${key} \`${title}\` at`
  + ` ${score.toFixed(2)}, so it files as an issue of its own rather than as a comment there.`;

/** Under every filing: the empty answer, the failed search and the folded one. `fresh` is `--new`,
 *  which closes the block on every outcome rather than only where it acted, and `declined` the
 *  duplicate it waved through. */
export const suggestionLines = ({ suggestions, notes, place, dropped = [], closed = [] },
  { nearest = null, foldable = false, routed = false, fresh = false, declined = null } = {}) => {
  const settled = settledLines({ dropped, closed }, NO_SCORE);
  const out = [
    ...(suggestions.length ? [HEAD, ...suggestions.map(row), SHOWN] : [emptyLine(place, !notes.length, settled.length > 0)]),
    ...settled,
  ];
  for (const note of notes) out.push(`${note} — this filing was made as it would have been without it.`);
  if (declined) out.push(heldLine(declined));
  if (fresh && (!declined || (nearest && foldable))) out.push(declinedLine(nearest, foldable, routed));
  return out;
};

/* The handle is what a run working that issue answers the finding by, so the filer is told it too. */
const namedAs = (answer) => {
  const handle = handleIn(answer);
  return handle ? ` There it is finding ${handle}, which that issue's run carries in a criterion or declines.` : "";
};

/** The fold's reply: no filing happened, so a reader after its key is told where the body went. */
export const foldedInto = (joined, answer = null) =>
  `${joined.issueId} is open, names the same place and is the nearest of the neighbours that do, at`
  + ` ${joined.score.toFixed(2)}; this filing says where its subject comes from, so it lands there as a finding`
  + " under its own title rather than as a second issue. No issue was filed and no lease was taken;"
  + " `--new` files it separately, and the block above is everything it was measured against."
  + namedAs(answer);

/** The fold, decided and done here so a rule whose act nothing takes back is not enforced twice. `onBeside` is called between the decision and the act, and on every outcome: the read this owes its destination ends in a refusal that exits, so a block printed after it is one a held fold never prints. */
export const foldFiling = async (beside,
  { title, body, kind = null, routed = false, fresh = false, declined = null, soft = false, onBeside = null }) => {
  const nearest = foldOnto(beside.suggestions);
  const foldable = !routed && owesCause(kind);
  /* Handed to the callback and nowhere else: printing off a return value is the double print ISS-628 removed, so the decision leaves by the one seam that has a reader. */
  onBeside?.(beside, { nearest, foldable, routed, fresh: Boolean(fresh), declined });
  if (!foldable || fresh || !nearest) return { joined: null, answer: null };
  await mustBeShown([{ ref: nearest.issueId, documentId: nearest.documentId }]);
  const answer = await postComment(nearest.documentId, foldedBody(title, body), null, soft);
  return { joined: nearest, answer };
};
