/* Paging, the browse projection and the reference-to-id lookup: docs/cli/the-projections.md. */
import { fail, slugIfAny } from "../resolve/settings.mjs";
import { didYouMean } from "../suggest.mjs";
import { readsAsDate, scoped } from "./rest.mjs";

/* What the browse verb PRINTS; the wire ask is MAX_LIMIT, the route's own cap. the-projections.md. */
export const DEFAULT_LIMIT = 200;
export const MAX_LIMIT = 200;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const KEY = String.raw`ISS-\d+`;
const CITED = /^[A-Za-z]+(?:-\d+)+$/u;
export const HUMAN_REF = new RegExp(`^${KEY}$`, "iu");
export const keysIn = (text) => String(text ?? "").match(new RegExp(`\\b${KEY}\\b`, "giu")) ?? [];

export const rowsOf = (payload, key = "issues") =>
  payload?.[key] ?? payload?.data ?? (Array.isArray(payload) ? payload : []);

export const listIssues = async (filters = {}, limit = DEFAULT_LIMIT, extra = {}, held = {}) =>
  scoped("forge_issues", {
    action: "list",
    limit,
    ...(Object.keys(filters).length ? { filters } : {}),
    ...extra,
  }, Boolean(held.soft), held);

const instant = (given) => Date.parse(given ?? "");
const aged = (row) => instant(row?.createdAt) || Infinity;

/** The page in the order it is to be worked, a row with no date taking the back of its rank. */
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

/* The filters the route does not narrow on, applied here because the walk holds the rows. A date-shaped one is composed only by `dated`, which is what reads the two stamps and what marks the row, so the set below is read off this table and a fourth date filter has no unmarked composition to reach for (codex F1). The negated form rather than `<`: a row with no stamp reads NaN and loses every comparison, so it stands outside the after-window and inside the before-window, which is where it stood before this was factored (ISS-1081). */
const dated = (key, keep) =>
  Object.assign((row, value) => keep(instant(row?.[key]), instant(value)), { date: true });

const LOCAL = {
  statusNot: (row, value) => row?.status !== value,
  complexity: (row, value) => row?.complexity === value,
  createdAfter: dated("createdAt", (stamp, given) => stamp >= given),
  createdBefore: dated("createdAt", (stamp, given) => !(stamp >= given)),
  updatedAfter: dated("updatedAt", (stamp, given) => stamp >= given),
};

export const DATE_FILTERS = Object.keys(LOCAL).filter((name) => LOCAL[name].date);

/** The refusal owed before the walk reads a row, since NaN loses every comparison and a word nothing read narrows on nothing while answering the same for every row. Asked here and not per row: a row-by-row check fires on neither a page that came back empty nor a filter that short-circuited ahead of it (codex F1). */
const refuseUnjudgedDate = (filters) => {
  for (const name of DATE_FILTERS) {
    const at = filters[name];
    if (at === undefined || readsAsDate(at)) continue;
    fail(`A date filter reached the walk unjudged: --${name} is ${at}, which is no date. Spend `
      + "`refuseUnreadableDate` on it where the verb reads its arguments, as the `issue` block of "
      + "plugin/src/commands.mjs does for the three it takes.");
  }
};

export const keeps = (row, filters = {}) =>
  Object.entries(filters).every(([name, value]) =>
    value === undefined || !LOCAL[name] || LOCAL[name](row, value));

/** One page at an offset; a walk ends on `hasMore` being false, never on a length or on silence. */
const window = async (held, offset) => {
  const payload = await listIssues(held.filters, MAX_LIMIT, offset ? { offset } : {}, held.bound);
  held.pages += 1;
  /* Carried, not looped past: a walk the transport refused is not a walk that reached the end. */
  if (payload?.refused) {
    held.refused = payload.refused;
    return { rows: [], whole: false };
  }
  const page = rowsOf(payload);
  const rows = page.filter((row) => keeps(row, held.filters));
  for (const row of rows) {
    held.rows.set(row?.documentId ?? String(row?.issueId ?? "").toUpperCase(), row);
  }
  held.read += page.length;
  return { rows, whole: payload?.hasMore === false };
};

/* One walk per ask, sharing the promise the WHOLE walk resolves: the offset is the count already
   read, so two readers advancing one walk skip a page and still reach `whole` (codex F1, ISS-538). */
const walks = new Map();

const walkFor = (filters, bound) => {
  if (!walks.has(keyFor(filters))) {
    walks.set(keyFor(filters), (async () => {
      const held = { filters, bound, rows: new Map(), pages: 0, read: 0 };
      held.page = await window(held, 0);
      while (!held.page.whole) {
        const before = held.read;
        held.page = await window(held, held.read);
        if (held.read === before) break;
      }
      return held;
    })());
  }
  return walks.get(keyFor(filters));
};

const keyFor = (filters) => JSON.stringify([slugIfAny() ?? "", filters]);

const readOf = (held) => ({
  rows: [...held.rows.values()],
  whole: held.page.whole,
  pages: held.pages,
  ...(held.refused ? { refused: held.refused } : {}),
});

/** Every row matching `filters`, paged to the end; `whole` false is a ceiling, not absence. */
export const everyIssue = async (filters = {}, bound = {}) => {
  refuseUnjudgedDate(filters);
  return readOf(await walkFor(filters, bound));
};

/** The names a body projects to are its own keys and the ones the tracker declares, read off each
 *  answer and never listed here; a declared name the answer left out is empty. */
export const projectedTo = (body, names, declared = []) => {
  const held = body ?? {};
  const out = { documentId: held.documentId, issueId: held.issueId };
  const taken = [...new Set([...Object.keys(held), ...declared])];
  for (const name of names) {
    if (!taken.includes(name)) {
      fail(didYouMean("field", name, taken,
        `\`forge issue ${out.issueId ?? out.documentId} --full\` prints the body these are the keys of.`));
    }
    out[name] = Object.hasOwn(held, name) ? held[name] : null;
  }
  return out;
};

export const readSaid = (read) => `${read.rows.length} issue(s) over ${read.pages} page(s)`;

/** What an incomplete reading owes its reader, null where it was whole; the route says nothing
 *  about a cut, so the count and the way out are all of it. */
export const shortOf = (read, what) => (read.whole ? null
  : `${what} reached ${readSaid(read)} and the reading is incomplete: a page still reported rows`
    + " behind it and the next offset returned none.\nA narrower ask comes back whole where this one"
    + " did not — add filters until `hasMore` is false:\n  forge issue --status open");

/* The count the route measured, never the limit asked for, and a lookup that could not read the set
   reports its own ceiling rather than the issue's absence. */
const missing = (reference, total) =>
  `${reference} is not on this project's tracker; ${total} issue(s) were counted, which is the whole`
  + " backlog.\nThe keys it does hold are on `forge issue`, one per line.";

/* Refused before the first call: rejecting a citation cost the whole backlog, and routed nowhere. */
const notAKey = (reference) =>
  `\`${reference}\` is neither an issue uuid nor an issue key: this tracker keys issues ISS and`
  + ` digits, as in ISS-45.`
  + (CITED.test(reference)
    ? `\n\`${reference}\` reads as a requirements citation instead, which is not a key and is not`
      + ` looked for on the tracker at all: \`forge spec ${reference}\` reads that clause off disk.`
    : "");

export const isReference = (value) => typeof value === "string" && (UUID.test(value) || HUMAN_REF.test(value));

export const notAReference = (reference) => (isReference(reference) ? null : notAKey(reference));

/* The key's number rises with the row's age, so the set ordered oldest first is sorted by it and an
   offset can be searched. Read off the key the row prints: the browse projection carries no other. */
const seqOf = (row) => Number(String(row?.issueId ?? "").replace(/\D+/gu, "")) || null;

/** One request where nothing below the key was ever deleted, else a search of the offsets. Soft, and
 *  every offset carrying the request option, for a caller a `fail()` cannot be allowed to exit past. */
export const documentIdIfAny = async (reference, { soft = false, ...held } = {}) => {
  if (UUID.test(reference)) return { id: reference };
  if (!HUMAN_REF.test(reference)) return { refused: notAKey(reference) };
  const at = (offset) => scoped("forge_issues", { action: "at", offset }, soft, held);
  const wanted = Number(reference.replace(/\D+/gu, ""));
  const guess = await at(Math.max(wanted - 1, 0));
  if (guess?.refused) return guess;
  if (seqOf(guess.row) === wanted) return { id: guess.row.documentId };
  let low = 0;
  let high = Math.min(guess.total - 1, Math.max(wanted - 2, 0));
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const row = mid === Math.max(wanted - 1, 0) ? guess : await at(mid);
    if (row?.refused) return row;
    const seq = seqOf(row.row);
    if (seq === wanted) return { id: row.row.documentId };
    if (seq === null || seq > wanted) high = mid - 1;
    else low = mid + 1;
  }
  return { refused: missing(reference, guess.total) };
};

export const documentIdOf = async (reference) => {
  const held = await documentIdIfAny(reference);
  return held.refused ? fail(held.refused) : held.id;
};
