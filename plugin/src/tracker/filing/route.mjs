/* The one route from a body to an issue: every verb that files calls it, and what stays a route's
   is its flags and the lines it prints. Nothing here prints and nothing here exits: docs/cli/filing.md. */
import { foldFiling, neighboursOf } from "./neighbours.mjs";
import { filingRefusal, liveTitles, rankOf, shapeOf, shapeRefusal, trackerFields, withMark }
  from "../issue-shape.mjs";
import { markedIn } from "../../ladder.mjs";
import { write } from "../rpc.mjs";
import { notAReference } from "../issues.mjs";

const withSections = (body, sections) => {
  const written = String(body ?? "").replace(/\s*$/u, "");
  const filled = sections.map((one) => String(one).replace(/\s*$/u, "")).filter(Boolean);
  return filled.length ? `${written}\n\n${filled.join("\n\n")}\n` : written;
};

/** Why a filing did not become an issue, as a value a caller branches on rather than text it
 *  matches: `collided` is the key it duplicates, `mine` a body no backlog would take. */
const refusalOf = (refused) => {
  if (!refused) return null;
  const { text, duplicate = null, shaped = true } = typeof refused === "string" ? { text: refused } : refused;
  return { text, collided: duplicate, mine: !duplicate && shaped };
};

/** The rank, for a route wanting it before it reads a body: refused after, an invalid one has
 *  already consumed a stdin nothing can send twice. */
export const rankFor = async (priority) => {
  const ranked = await rankOf(priority);
  return ranked.refusal ? { refusal: refusalOf(ranked.refusal) } : { ranked };
};

export const bodyOf = ({ title, body, kind = null, sections = [], size = undefined, everySection = false }) => {
  const written = withSections(body, sections);
  const description = size ? withMark(written, size) : written;
  const shape = shapeOf({ title, body: description, kind }, { everySection });
  return { description, shape, rung: markedIn(description), refusal: refusalOf(shapeRefusal(shape)) };
};

export const RELATIONS_MAX = 20;

/** An edge asked for and not carried, absent in silence, reads as one nobody wanted; so say it. */
export const edgesLeft = ({ unknown = [], dropped = 0 } = {}) => [
  dropped ? `${dropped} over the ${RELATIONS_MAX} one create carries` : null,
  unknown.length ? `${unknown.join(", ")} names no issue on this project` : null,
].filter(Boolean).join("; ") || null;

/** `--with`, read the same way by both verbs: a list, refused empty and refused above what one
 *  create carries, so no key a call named is written and no key it named is dropped. */
export const keysFrom = (given) => {
  if (given === undefined) return { keys: [] };
  const keys = String(given).split(",").map((one) => one.trim()).filter(Boolean);
  if (!keys.length) {
    return { keys, refusal: "--with takes an issue key, or several separated by commas, and this "
      + "named none: --with ISS-45 or --with ISS-45,ISS-46." };
  }
  const wrong = keys.map((one) => notAReference(one)).find(Boolean);
  if (wrong) return { keys, refusal: wrong };
  if (keys.length > RELATIONS_MAX) {
    return { keys, refusal: `--with names ${keys.length} issues and one create carries `
      + `${RELATIONS_MAX} relations. Name ${RELATIONS_MAX} or fewer here; the same field is written `
      + "by an update, so the rest go on in a second write once this filing has a key." };
  }
  return { keys };
};

/** Edges from keys, against every row of the reading already made — a batch reading's issues are
 *  closed by the time it files. A key it does not hold comes back unresolved rather than guessed. */
export const relatedTo = (keys, rows) => {
  const held = new Map(rows
    .filter((one) => one?.documentId && one?.issueId)
    .map((one) => [String(one.issueId).toUpperCase(), one.documentId]));
  const wanted = [...new Set(keys.map((one) => String(one).toUpperCase()))];
  return {
    relations: wanted.filter((one) => held.has(one))
      .map((one) => ({ kind: "relates", blocksId: held.get(one) })),
    unknown: wanted.filter((one) => !held.has(one)),
  };
};

const readFiling = async (filing, read,
  { routed = false, everySection = false, duplicates = true, shape: known = null } = {}) => {
  const shape = known ?? shapeOf(filing, { everySection });
  const refused = duplicates
    ? await filingRefusal(filing, shape, { routed, page: read })
    : shapeRefusal(shape);
  if (refused) return { refusal: refusalOf(refused), shape, beside: null };
  return { refusal: null, shape, beside: await neighboursOf(shape, read.live) };
};

/** One filing, from what a route knows to an issue or a reason there is none. `routed` rides another
 *  issue's branch and owes no fold, `fresh` is `--new` declining one, `everySection` is a route with
 *  no lighter path, `duplicates` off the finder's route, where a refusal loses the finding.
 *  `relations` are edges the caller resolved itself and `relateKeys` ones this resolves softly. */
export const fileIssue = async ({
  title,
  body,
  kind = null,
  priority = undefined,
  sections = [],
  size = undefined,
  routed = false,
  fresh = false,
  everySection = false,
  duplicates = true,
  relations = null,
  relateKeys = [],
  fields = {},
  page = null,
  ranked: asked = null,
  soft = false,
}) => {
  const ranked = asked ?? await rankOf(priority);
  if (ranked.refusal) return { refusal: refusalOf(ranked.refusal), description: null, shape: null };
  const { description, shape: known, rung } = bodyOf({ title, body, kind, sections, size, everySection });
  const seen = page ?? await liveTitles();
  const { refusal, shape, beside } = await readFiling({ title, body: description, kind }, seen,
    { routed, everySection, duplicates, shape: known });
  if (refusal) return { refusal, description, shape };
  const { joined, answer: comment, said } =
    await foldFiling(beside, { title, body: description, routed, fresh, soft });
  if (joined) return { refusal: null, description, shape, beside, said, joined, answer: comment, ranked };
  const found = relateKeys.length ? relatedTo(relateKeys, seen.read.rows) : { relations: [], unknown: [] };
  const wanted = [...(relations ?? []), ...found.relations];
  const edges = wanted.slice(0, RELATIONS_MAX);
  const related = { unknown: found.unknown, dropped: wanted.length - edges.length };
  /* After `fields`: a route's flag naming a field decided here may not overwrite it. */
  const data = {
    title,
    description,
    status: "open",
    ...fields,
    priority: ranked.value,
    ...trackerFields({ kind, rung }),
    ...(edges.length ? { relations: edges } : {}),
  };
  const answer = await write("forge_issues", { action: "create", data }, undefined, soft);
  return { refusal: null, description, shape, beside, said, joined: null, answer, ranked, related };
};
