/* Paging, the browse projection and the reference-to-id lookup: docs/cli/the-projections.md. */
import { fail } from "../resolve/settings.mjs";
import { scoped } from "./rpc.mjs";

/* No offset or cursor exists, and this number is not the cap that bites: docs/cli/the-projections.md. */
export const DEFAULT_LIMIT = 200;
export const MAX_LIMIT = 500;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const HUMAN_REF = /^[A-Za-z]+-\d+$/u;

export const rowsOf = (payload, key = "issues") =>
  payload?.[key] ?? payload?.data ?? (Array.isArray(payload) ? payload : []);

export const listIssues = async (filters = {}, limit = DEFAULT_LIMIT, extra = {}) =>
  scoped("forge_issues", {
    action: "list",
    limit,
    ...(Object.keys(filters).length ? { filters } : {}),
    ...extra,
  });

export const truncated = (rows, limit) => rows.length === limit;

const aged = (row) => Date.parse(row?.createdAt ?? "") || Infinity;

/** The page in the order it is to be worked, `order` being the tracker's own ranking and a row with
 *  no date taking the back of its rank. Why the verb sorts: docs/cli/the-projections.md. */
export const queued = (rows, order = []) => {
  if (!order.length) return rows;
  const rank = (row) => {
    const at = order.indexOf(row?.priority);
    return at < 0 ? order.length : at;
  };
  return rows
    .map((row, arrived) => ({ row, arrived }))
    .sort((one, other) =>
      rank(one.row) - rank(other.row) || aged(one.row) - aged(other.row) || one.arrived - other.arrived)
    .map((held) => held.row);
};

/* The cut is by response bytes, so only the envelope reports it; an answer carrying none is whole. */
export const cut = (payload, rows) =>
  payload?.hasMore === true || payload?.truncated === true || rows.length >= MAX_LIMIT;

/* The floor of the interval a first window is bisected from, no row predating the clock's own. */
const EPOCH = 0;

const iso = (ms) => new Date(ms).toISOString();

/** One window, absorbed into `index`, and whether the answer covered what it asked for.
 *  `createdBefore` is exclusive and `createdAfter` inclusive, so `[after, before)` tiles cleanly. */
const window = async (index, before, after) => {
  const payload = await listIssues({
    ...(before === null ? {} : { createdBefore: iso(before) }),
    ...(after === null ? {} : { createdAfter: iso(after) }),
  }, MAX_LIMIT);
  const rows = rowsOf(payload);
  for (const row of rows) {
    const key = String(row?.issueId ?? "").toUpperCase();
    if (key) index.set(key, row.documentId);
  }
  return { rows, whole: !cut(payload, rows) };
};

const stamps = (rows) =>
  [...new Set(rows.map((row) => Date.parse(row?.createdAt ?? "")).filter(Number.isFinite))]
    .sort((one, other) => other - one);

/** The newest whole window under `held.frontier`: the stamps a cut page returned open the search
 *  and no more, and what narrows is the interval. Why: docs/cli/the-projections.md. */
const narrowed = async (held) => {
  const marks = stamps(held.page.rows);
  const top = held.frontier ?? Date.now();
  let lower = marks.length ? marks[Math.floor(marks.length / 2)] : EPOCH;
  for (;;) {
    const tile = await window(held.index, held.frontier, lower);
    held.pages += 1;
    if (tile.whole) return lower;
    if (top - lower <= 1) return null;
    lower += Math.ceil((top - lower) / 2);
  }
};

/* One tile off the newest end of what is owed. `held.page` is always the answer for everything
   older than `held.frontier`, so the walk is done when that page comes back whole. */
const stepped = async (held) => {
  const lower = await narrowed(held);
  if (lower === null) return false;
  held.frontier = lower;
  held.page = await window(held.index, lower, null);
  held.pages += 1;
  return true;
};

/* One index per process, and the PROMISE is what is shared: `dep <a> <b>` resolves two references
   at once, so a memo assigned after the await lets each of them fetch the same 41 KB. */
let pending = null;
const referenceIndex = () =>
  (pending ??= (async () => {
    const index = new Map();
    const page = await window(index, null, null);
    return { index, page, frontier: null, stuck: false, pages: 1 };
  })());

/* Concurrent misses share the walk: the second waits for the step the first took, then looks. */
let walking = Promise.resolve();
const reach = async (held, wanted) => {
  while (!held.index.has(wanted) && !held.page.whole && !held.stuck) {
    walking = walking.then(async () => {
      if (held.index.has(wanted) || held.page.whole || held.stuck) return;
      if (!(await stepped(held))) held.stuck = true;
    });
    await walking;
  }
};

/* The set as measured, never the limit asked for, and a cut reading is not absence. */
const missing = (reference, held) => {
  const read = `${held.index.size} issue(s) over ${held.pages} page(s)`;
  return held.page.whole
    ? `${reference} is not on this project's tracker; ${read} read, which is the whole backlog.\n`
      + `The keys it does hold are on \`forge issues\`, one per line; \`--status\` reaches past a cut page.`
    : `${reference} is not among the ${read} this lookup could reach, and the reading is incomplete:`
      + ` a window one millisecond wide still came back cut by the tracker's response-size cap. So`
      + ` this is the lookup's ceiling and not the issue's absence.\nA narrower set comes back whole`
      + ` where this one did not — add filters until \`hasMore\` is false:\n  forge call forge_issues`
      + ` '{"action":"list","filters":{"status":"open"}}'\nEach row carries the key and`
      + ` the uuid every verb here also takes.`;
};

export const documentIdOf = async (reference) => {
  if (UUID.test(reference)) return reference;
  if (!HUMAN_REF.test(reference)) {
    fail(`\`${reference}\` is neither an issue uuid nor a reference like ISS-45.`);
  }
  const wanted = reference.toUpperCase();
  const held = await referenceIndex();
  if (!held.index.has(wanted)) await reach(held, wanted);
  const found = held.index.get(wanted);
  if (!found) fail(missing(reference, held));
  return found;
};
