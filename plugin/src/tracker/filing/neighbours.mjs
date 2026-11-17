/* What is already filed beside a filing, open or settled, asked of the tracker's one find door from inside the create path. Every decision below is docs/cli/beside.md's for the reading — the two queries, the door's own judgement of a match, the term each is asked on — and docs/cli/the-fold.md's for the act. */
import { mustBeShown, postComment } from "../comments.mjs";
import { owesCause } from "../issue-shape.mjs";
import { foldedBody, handleIn } from "../../flow/earned/findings.mjs";
import { tried } from "../rest.mjs";
import { firstLine } from "../../resolve/flags.mjs";
import { settledLines, withReasons } from "./settled.mjs";

export const SEARCH_ROUTE = "forge_find.issues";
export const TOP_K = 10;
/** The place net's own width, and not a display budget: how many issues naming this place may be eligible to take a finding, where the block below still prints `TOP_K` of them. Fifty because the deepest place rank at which the fold's own destination sat, measured 2026-09-14 over 24 open issues, was 34; it is also the most the find door answers. docs/cli/beside.md carries the measurement. */
export const PLACE_K = 50;
/** The most text the find door takes as one query. */
const QUERY_MAX = 200;
const NO_RANK = "  — ";
const KEY = 8;

/** How a filing's neighbour is said: its place in the door's own order for the filing, which ranks and measures nothing. */
export const rankSaid = (rank) => (rank === null ? NO_RANK : `#${String(rank).padEnd(3)}`);

/* `limit` is an ask, so the bound is applied here, against the ask that was made: the two queries want different widths and neither may read the other's surplus. */
const hitsOf = (answer, want) => (Array.isArray(answer?.hits) ? answer.hits : []).slice(0, want);

const ask = async (query, what, want) => {
  const text = String(query ?? "").trim();
  /* A `note` means a query that COULD not run, so one with no subject leaves none. */
  if (!text) return { hits: [], note: null };
  const answer = await tried(SEARCH_ROUTE, { q: text.slice(0, QUERY_MAX), limit: want });
  if (answer?.refused) {
    return { hits: [], note: `the ${what} query could not run: ${firstLine(answer.refused)}` };
  }
  /* The door answering by its keyword arms alone answers a meaning query with near nothing, which reads as a backlog holding nothing like this. */
  const note = answer?.degraded ? `the ${what} query ran without its meaning arms, the find door having no embedding to ask with` : null;
  return { hits: hitsOf(answer, want), note };
};

/* The door's keyword arms find an issue by the words it holds, so a hit one of them found names the place; a hit only its meaning arm found is near the place in sense and names it nowhere. */
const namingPlace = (hits) => hits.filter((one) => (one.arms ?? []).includes("keyword"));

const cutInBand = (hits) => hits.length >= TOP_K;

/* A settled row the meaning query reached, as the open rows are: nearness is what makes it the same subject, and a settled row that only names the place is machinery nobody has to decide about. */
const settledNear = (hits, settled, samePlace) => {
  const held = new Map(settled.map((one) => [one.documentId, one]));
  const near = new Map();
  hits.forEach((hit, at) => {
    const row = held.get(hit.documentId);
    if (!row || near.has(hit.documentId)) return;
    near.set(hit.documentId, { ...row, rank: at + 1, samePlace: samePlace.has(hit.documentId) });
  });
  const found = [...near.values()];
  return { dropped: found.filter((one) => one.status === "dropped"), closed: found.filter((one) => one.status === "closed") };
};

/** Every open issue either query reached, and beside them the settled ones `settledNear` keeps. Every hit the door answers is one it judged a match, by its own floor; `rank` is its place in the door's order for the filing, null for a row only the place query reached. The key, the title and the status are the projection's — `live` for the open rows, `settled` for the rest, both off the walk already made — so the resolve costs no call of its own. A caller passing no `settled` measures open against open, as the sweep and the ranking do. */
export const neighboursOf = async ({ seed, place }, live, settled = []) => {
  const open = new Map(live.filter((one) => one.documentId).map((one) => [one.documentId, one]));
  const [near, named] = await Promise.all([ask(seed, "meaning", TOP_K), ask(place, "place", PLACE_K)]);
  const inPlace = namingPlace(named.hits);
  const samePlace = new Set(inPlace.map((one) => one.documentId));
  const found = new Map();
  const add = (ref, rank) => {
    const row = open.get(ref);
    if (!row || found.has(ref)) return;
    found.set(ref, { issueId: row.issueId, documentId: ref, title: row.title, rank, samePlace: samePlace.has(ref) });
  };
  near.hits.forEach((hit, at) => add(hit.documentId, at + 1));
  for (const hit of inPlace.slice(0, TOP_K)) add(hit.documentId, null);
  const { dropped, closed } = settledNear(near.hits, settled, samePlace);
  return {
    dropped: await withReasons(dropped),
    closed,
    place,
    notes: [near.note, named.note].filter(Boolean),
    inBand: near.hits.length,
    cut: cutInBand(near.hits),
    /* The door's order first, the place-only rows after it, so `foldOnto` reads the nearest off the front. */
    suggestions: [...found.values()],
  };
};

/** The issue a filing below the top rung joins: the nearest, in the door's order, of those the place query found too. Nearest among THOSE, and no line here calls it nearest of all. */
export const foldOnto = (suggestions) =>
  suggestions.find((one) => one.samePlace && one.rank !== null) ?? null;

/** Whether a filing lands on its destination as a finding. Off until the find door answers a
 *  similarity per hit again: the comment cannot be taken back, and the door's own floor sits under
 *  the band where neighbours share machinery rather than subject, so the place alone is too thin a
 *  bar for it. docs/cli/the-fold.md. */
const FOLDS = false;

/** Why a filing that would have folded did not, by name. */
const FOLD_OFF = "the find door returns no similarity to fold on; ISS-1256";

const row = (one) =>
  `  ${one.issueId.padEnd(KEY)} ${rankSaid(one.rank)}  `
  + `${one.samePlace ? "same place  " : "            "}${one.title}`;

const HEAD = "Open beside this filing, by the tracker's find door — key, its place in the door's order"
  + " for this filing, and whether it names the same place:";
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
    return "--new declined nothing: no open issue both reads like this filing by the find door's judgement"
      + " and names its place, so it was filed as it would have been without the flag.";
  }
  if (!foldable) return neverFoldable(nearest, routed);
  return `--new declined the fold: ${nearest.issueId} is the nearest of the neighbours naming the place`
    + " this filing's cause names, and it reads like it, so it would have landed there as a finding"
    + " rather than as an issue of its own.";
};

/* What a filing that would have folded is told instead: where it would have gone, why it did not,
   and the route that puts it there by hand. */
const heldBackLine = (nearest) =>
  `Not folded onto ${nearest.issueId}, the nearest open issue naming the place this filing's cause`
  + ` names: ${FOLD_OFF}. It is filed as an issue of its own; \`forge comment ${nearest.issueId} <body>\``
  + " lands it there by hand.";

/* The hold `--new` declined is a second thing it did, so a fold it had nothing to decline goes
   unsaid beside it rather than reading as the flag having done nothing. */
const heldLine = ({ where, key, title, score }) =>
  `--new declined the duplicate hold: ${where} of this filing reads like ${key} \`${title}\` at`
  + ` ${score.toFixed(2)}, so it files as an issue of its own rather than as a comment there.`;

/** Under every filing: the empty answer, the failed search and the folded one. `fresh` is `--new`,
 *  which closes the block on every outcome rather than only where it acted; `declined` is
 *  `filingRefusal`'s. */
export const suggestionLines = ({ suggestions, notes, place, dropped = [], closed = [] },
  { nearest = null, foldable = false, routed = false, fresh = false, declined = null } = {}) => {
  const settled = settledLines({ dropped, closed }, rankSaid);
  const out = [
    ...(suggestions.length ? [HEAD, ...suggestions.map(row), SHOWN] : [emptyLine(place, !notes.length, settled.length > 0)]),
    ...settled,
  ];
  for (const note of notes) out.push(`${note} — this filing was made as it would have been without it.`);
  if (declined) out.push(heldLine(declined));
  const heldBack = !FOLDS && nearest && foldable;
  if (heldBack) out.push(heldBackLine(nearest));
  else if (fresh && (!declined || (nearest && foldable))) out.push(declinedLine(nearest, foldable, routed));
  return out;
};

/* The handle is what a run working that issue answers the finding by, so the filer is told it too. */
const namedAs = (answer) => {
  const handle = handleIn(answer);
  return handle ? ` There it is finding ${handle}, which that issue's run carries in a criterion or declines.` : "";
};

/** The fold's reply: no filing happened, so a reader after its key is told where the body went,
 *  `ref` being that key as the caller names it to a reader standing in another project. */
export const foldedInto = (joined, answer = null, ref = joined.issueId) =>
  `${ref} is open, names the same place and is the nearest of the neighbours that do, ${rankSaid(joined.rank).trim()}`
  + " in the find door's order; this filing says where its subject comes from, so it lands there as a finding"
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
  if (!FOLDS || !foldable || fresh || !nearest) return { joined: null, answer: null };
  await mustBeShown([{ ref: nearest.issueId, documentId: nearest.documentId }]);
  const answer = await postComment(nearest.documentId, foldedBody(title, body), null, soft);
  return { joined: nearest, answer };
};
