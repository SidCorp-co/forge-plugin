/* The one route from a body to an issue: every verb that files calls it, and what stays a route's
   is its flags and the lines it prints. Nothing here prints and nothing here exits: docs/cli/filing.md. */
import { fail } from "../resolve/settings.mjs";
import { foldFiling, neighboursOf } from "./neighbours.mjs";
import { filingRefusal, liveTitles, rankOf, shapeOf, shapeRefusal, trackerFields, withMark }
  from "./issue-shape.mjs";
import { write } from "./rpc.mjs";

export const withSections = (body, sections) => {
  const written = String(body ?? "").replace(/\s*$/u, "");
  const filled = sections.map((one) => String(one).replace(/\s*$/u, "")).filter(Boolean);
  return filled.length ? `${written}\n\n${filled.join("\n\n")}\n` : written;
};

/** Why a filing did not become an issue, as a value a caller branches on rather than text it
 *  matches: `collided` is the key it duplicates, `mine` a body no backlog would take. */
export const refusalOf = (refused) => {
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
  const description = size ? withMark(written) : written;
  const shape = shapeOf({ title, body: description, kind }, { everySection });
  return { description, refusal: refusalOf(shapeRefusal(shape)) };
};

export const readFiling = async (filing,
  { routed = false, everySection = false, duplicates = true, page = null } = {}) => {
  const shape = shapeOf(filing, { everySection });
  const read = page ?? await liveTitles();
  const refused = duplicates
    ? await filingRefusal(filing, shape, { routed, page: read })
    : shapeRefusal(shape);
  if (refused) return { refusal: refusalOf(refused), shape, beside: null };
  return { refusal: null, shape, beside: await neighboursOf(shape, read.live) };
};

/** One filing, from what a route knows to an issue or a reason there is none. `routed` rides another
 *  issue's branch and owes no fold, `fresh` is `--new` declining one, `everySection` is a route with
 *  no lighter path, `duplicates` off a route that routes on its own title. */
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
  fields = {},
  page = null,
  ranked: asked = null,
  soft = false,
}) => {
  const ranked = asked ?? await rankOf(priority);
  if (ranked.refusal) return { refusal: refusalOf(ranked.refusal), description: null, shape: null };
  const { description } = bodyOf({ title, body, kind, sections, size, everySection });
  const { refusal, shape, beside } =
    await readFiling({ title, body: description, kind }, { routed, everySection, duplicates, page });
  if (refusal) return { refusal, description, shape };
  const { joined, answer: comment, said } =
    await foldFiling(beside, { title, body: description, routed, fresh, soft });
  if (joined) return { refusal: null, description, shape, beside, said, joined, answer: comment, ranked };
  /* After `fields`: a route's flag naming a field decided here may not overwrite it. */
  const data = {
    title,
    description,
    status: "open",
    ...fields,
    priority: ranked.value,
    ...trackerFields({ kind }),
    ...(relations ? { relations } : {}),
  };
  const answer = await write("forge_issues", { action: "create", data }, undefined, soft);
  return { refusal: null, description, shape, beside, said, joined: null, answer, ranked };
};

/** For a route whose refusal has nowhere to go but the exit. */
export const filedOrFail = async (asked) => {
  const filed = await fileIssue(asked);
  if (filed.refusal) fail(filed.refusal.text);
  return filed;
};
