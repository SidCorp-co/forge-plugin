/* Paging, the browse projection and the reference-to-id lookup: docs/cli/the-projections.md. */
import { fail, slugIfAny } from "../resolve/settings.mjs";
import { didYouMean } from "../suggest.mjs";
import { scoped } from "./rpc.mjs";

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

export const listIssues = async (filters = {}, limit = DEFAULT_LIMIT, extra = {}) =>
  scoped("forge_issues", {
    action: "list",
    limit,
    ...(Object.keys(filters).length ? { filters } : {}),
    ...extra,
  });

const aged = (row) => Date.parse(row?.createdAt ?? "") || Infinity;

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

/* The filters the route does not narrow on, applied here because the walk holds the rows. */
const after = (row, key, at) => Date.parse(row?.[key] ?? "") >= Date.parse(at);

const LOCAL = {
  statusNot: (row, value) => row?.status !== value,
  complexity: (row, value) => row?.complexity === value,
  createdAfter: (row, value) => after(row, "createdAt", value),
  createdBefore: (row, value) => !after(row, "createdAt", value),
  updatedAfter: (row, value) => after(row, "updatedAt", value),
};

export const keeps = (row, filters = {}) =>
  Object.entries(filters).every(([name, value]) =>
    value === undefined || !LOCAL[name] || LOCAL[name](row, value));

/** One page at an offset; a walk ends on `hasMore` being false, never on a length or on silence. */
const window = async (held, offset) => {
  const payload = await listIssues(held.filters, MAX_LIMIT, offset ? { offset } : {});
  held.pages += 1;
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

const walkFor = (filters) => {
  if (!walks.has(keyFor(filters))) {
    walks.set(keyFor(filters), (async () => {
      const held = { filters, rows: new Map(), pages: 0, read: 0 };
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
});

/** Every row matching `filters`, paged to the end; `whole` false is a ceiling, not absence. */
export const everyIssue = async (filters = {}) => readOf(await walkFor(filters));

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
    + " did not — add filters until `hasMore` is false:\n  forge issues --status open");

/* The count the route measured, never the limit asked for, and a lookup that could not read the set
   reports its own ceiling rather than the issue's absence. */
const missing = (reference, total) =>
  `${reference} is not on this project's tracker; ${total} issue(s) were counted, which is the whole`
  + " backlog.\nThe keys it does hold are on `forge issues`, one per line.";

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

const rowAt = async (offset) => scoped("forge_issues", { action: "at", offset });

/** One request where nothing below the key was ever deleted, and a search of the offsets where
 *  something was: `wanted - 1` is the answer, or an upper bound on where the answer sits. */
export const documentIdOf = async (reference) => {
  if (UUID.test(reference)) return reference;
  if (!HUMAN_REF.test(reference)) fail(notAKey(reference));
  const wanted = Number(reference.replace(/\D+/gu, ""));
  const guess = await rowAt(Math.max(wanted - 1, 0));
  if (seqOf(guess.row) === wanted) return guess.row.documentId;
  let low = 0;
  let high = Math.min(guess.total - 1, Math.max(wanted - 2, 0));
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const held = mid === Math.max(wanted - 1, 0) ? guess : await rowAt(mid);
    const seq = seqOf(held.row);
    if (seq === wanted) return held.row.documentId;
    if (seq === null || seq > wanted) high = mid - 1;
    else low = mid + 1;
  }
  return fail(missing(reference, guess.total));
};
