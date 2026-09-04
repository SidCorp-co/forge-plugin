/* Paging, the browse projection and the reference-to-id lookup: docs/cli/the-projections.md. */
import { fail, slugIfAny } from "../resolve/settings.mjs";
import { scoped } from "./rpc.mjs";

/* What the browse verb PRINTS, out of the whole set the walk below reads. The wire ask is always
   MAX_LIMIT and neither number is the cap that bites: docs/cli/the-projections.md. */
export const DEFAULT_LIMIT = 200;
export const MAX_LIMIT = 500;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const KEY = String.raw`ISS-\d+`;
const CITED = /^[A-Za-z]+(?:-\d+)+$/u;
export const HUMAN_REF = new RegExp(`^${KEY}$`, "iu");
export const keysIn = (text) => String(text ?? "").match(new RegExp(`\\b${KEY}\\b`, "giu")) ?? [];

export const rowsOf = (payload, key = "issues") =>
  payload?.[key] ?? payload?.data ?? (Array.isArray(payload) ? payload : []);

export const listIssues = async (filters = {}, limit = DEFAULT_LIMIT, extra = {}) =>
  scoped("forge_issues", {
    action: "list",
    limit,
    ...(Object.keys(filters).length ? { filters } : {}),
    ...extra,
  });

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

export const cut = (payload, rows, limit) =>
  payload?.hasMore === true || payload?.truncated === true
  || Boolean(payload?.truncatedBy) || rows.length >= limit;

const EPOCH = 0;

const iso = (ms) => new Date(ms).toISOString();

/* The caller's own bound is the walk's ceiling or floor: a frontier subdivides that interval and
   may never widen past either end of it. */
const stampIn = (filters, key, absent) => {
  const at = Date.parse(String(filters?.[key] ?? ""));
  return Number.isFinite(at) ? at : absent;
};

/** One window, absorbed into `held`. `createdBefore` is exclusive and `createdAfter` inclusive, so
 *  `[after, before)` tiles cleanly, and the caller's own bounds ride every one of them. */
const window = async (held, before, after) => {
  const payload = await listIssues({
    ...held.filters,
    ...(before === null ? {} : { createdBefore: iso(before) }),
    ...(after === null ? {} : { createdAfter: iso(after) }),
  }, MAX_LIMIT);
  held.pages += 1;
  const rows = rowsOf(payload);
  for (const row of rows) {
    const key = String(row?.issueId ?? "").toUpperCase();
    if (key) held.index.set(key, row.documentId);
    held.rows.set(row?.documentId ?? key, row);
  }
  held.notice = payload?.notice ? String(payload.notice) : held.notice;
  return { rows, whole: !cut(payload, rows, MAX_LIMIT) };
};

const stamps = (rows) =>
  [...new Set(rows.map((row) => Date.parse(row?.createdAt ?? "")).filter(Number.isFinite))]
    .sort((one, other) => other - one);

/** The newest whole window under the frontier: the stamps open the search, the interval is what
 *  narrows, and only a millisecond is indivisible. Why: docs/cli/the-projections.md. */
const narrowed = async (held) => {
  const marks = stamps(held.page.rows);
  const top = held.frontier ?? held.ceiling ?? Date.now();
  let lower = marks.length ? marks[Math.floor(marks.length / 2)] : held.floor;
  for (;;) {
    const tile = await window(held, held.frontier, lower);
    if (tile.whole) return lower;
    if (top - lower <= 1) return null;
    lower += Math.ceil((top - lower) / 2);
  }
};

const stepped = async (held) => {
  const lower = await narrowed(held);
  if (lower === null) return false;
  held.frontier = lower;
  held.page = await window(held, lower, null);
  return true;
};

/* One walk per process per ask, and the PROMISE is shared: `dep <a> <b>` resolves two references at
   once, and a memo assigned after the await lets each fetch the same 41 KB. Keyed by project too,
   `forge feedback` aiming a later call at another one. */
const walks = new Map();

const walkFor = (filters) => {
  const key = JSON.stringify([slugIfAny() ?? "", filters]);
  if (!walks.has(key)) {
    walks.set(key, (async () => {
      const held = {
        filters,
        ceiling: stampIn(filters, "createdBefore", null),
        floor: stampIn(filters, "createdAfter", EPOCH),
        index: new Map(),
        rows: new Map(),
        notice: null,
        frontier: null,
        stuck: false,
        pages: 0,
        walking: Promise.resolve(),
      };
      held.page = await window(held, null, null);
      return held;
    })());
  }
  return walks.get(key);
};

/* Concurrent readers share it: the second waits for the step the first took, then looks. */
const walked = async (held, done) => {
  while (!done() && !held.page.whole && !held.stuck) {
    held.walking = held.walking.then(async () => {
      if (done() || held.page.whole || held.stuck) return;
      if (!(await stepped(held))) held.stuck = true;
    });
    await held.walking;
  }
};

const readOf = (held) => ({
  rows: [...held.rows.values()],
  whole: held.page.whole,
  pages: held.pages,
  notice: held.notice,
});

/** Every row matching `filters`, walked until a window with no lower bound came back whole, which is
 *  the only reading on this transport that licenses a count. `whole` false is a ceiling, not absence. */
export const everyIssue = async (filters = {}) => {
  const held = await walkFor(filters);
  await walked(held, () => false);
  return readOf(held);
};

export const readSaid = (read) => `${read.rows.length} issue(s) over ${read.pages} page(s)`;

/** What an incomplete reading owes its reader, and null where it was whole. The tracker's own notice
 *  rides along: it is the sentence that knows which cap bit, and paraphrasing it invents advice. */
export const shortOf = (read, what) => (read.whole ? null
  : `${what} reached ${readSaid(read)} and the reading is incomplete: a window one millisecond wide`
    + ` still came back cut by the tracker's response-size cap.${read.notice ? ` The tracker said:`
      + ` ${read.notice}` : ""}\nA narrower ask comes back whole where this one did not — add filters`
    + " until `hasMore` is false:\n  forge issues --status open");

/* The set as measured, never the limit asked for, and a cut reading is not absence. */
const missing = (reference, read) => (read.whole
  ? `${reference} is not on this project's tracker; ${readSaid(read)} read, which is the whole backlog.\n`
    + "The keys it does hold are on `forge issues`, one per line."
  : `${reference} is not among the rows this lookup could reach, which is the lookup's ceiling and not`
    + ` the issue's absence.\n${shortOf(read, "The walk")}\nEach row a narrower ask returns carries`
    + " the key and the uuid every verb here also takes.");

/* Refused before the first call: rejecting a citation cost the whole backlog, and routed nowhere. */
const notAKey = (reference) =>
  `\`${reference}\` is neither an issue uuid nor an issue key: this tracker keys issues ISS and`
  + ` digits, as in ISS-45.`
  + (CITED.test(reference)
    ? `\n\`${reference}\` reads as a requirements citation instead, which is not a key and is not`
      + ` looked for on the tracker at all: \`forge spec ${reference}\` reads that clause off disk.`
    : "");

/* Walked no further than the key: a lookup owes the whole backlog only where the key is not in it. */
export const documentIdOf = async (reference) => {
  if (UUID.test(reference)) return reference;
  if (!HUMAN_REF.test(reference)) fail(notAKey(reference));
  const wanted = reference.toUpperCase();
  const held = await walkFor({});
  await walked(held, () => held.index.has(wanted));
  const found = held.index.get(wanted);
  if (!found) fail(missing(reference, readOf(held)));
  return found;
};
