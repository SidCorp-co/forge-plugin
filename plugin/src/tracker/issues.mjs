/* Paging and the reference-to-id lookup: docs/cli/reading-a-whole-set.md. The browse projection:
   docs/cli/the-projections.md. */
import { AIMED_FROM, aimSaid, fail, projectTarget, slugIfAny } from "../resolve/settings.mjs";
import { didYouMean } from "../suggest.mjs";
import { movedUnderClaim } from "../resolve/project/claimed.mjs";
import { readsAsDate, scoped } from "./rest.mjs";
import { statusOfPlace } from "./declared/issue-machine.mjs";

/* What the browse verb PRINTS; the wire ask is MAX_LIMIT, the route's own cap. reading-a-whole-set.md. */
export const DEFAULT_LIMIT = 200;
export const MAX_LIMIT = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const KEY = String.raw`ISS-\d+`;
const CITED = /^[A-Za-z]+(?:-\d+)+$/u;
export const HUMAN_REF = new RegExp(`^${KEY}$`, "iu");
/* In the tracker's spelling whatever the text's: a session id and the claim typed from it are lowercase,
   and a key returned as found joins no row (ISS-2161: 58 of a corpus's 585 runs). */
export const keysIn = (text) => (String(text ?? "").match(new RegExp(`\\b${KEY}\\b`, "giu")) ?? []).map((one) => one.toUpperCase());
/* Beside `keysIn` rather than with its filing caller: a hook on the stop clock reaches this module and no heavier one. */
export const distinctKeysIn = (text) => [...new Set(keysIn(text))];

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
  /* The route narrows on the status core holds, so a place that is a work step is kept here, and a
     status names every place inside it. */
  status: (row, value) => row?.status === value || statusOfPlace(row?.status) === value,
  statusNot: (row, value) => row?.status !== value && statusOfPlace(row?.status) !== value,
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

/** Every row matching `filters`, paged to the end; `whole` false is a ceiling, not absence. `again`
 *  walks afresh, for a caller whose own write since the last walk is the question it asks. */
export const everyIssue = async (filters = {}, bound = {}, { again = false } = {}) => {
  refuseUnjudgedDate(filters);
  if (again) walks.delete(keyFor(filters));
  return readOf(await walkFor(filters, bound));
};

/** The names a body projects to are its own keys and the ones the tracker declares, read off each
 *  answer and never listed here; a declared name the answer left out is empty. `hint` is the route
 *  out for a caller whose body is narrower than the full read. */
export const projectedTo = (body, names, { declared = [], hint } = {}) => {
  const held = body ?? {};
  const out = { documentId: held.documentId, issueId: held.issueId };
  const taken = [...new Set([...Object.keys(held), ...declared])];
  for (const name of names) {
    if (!taken.includes(name)) {
      fail(didYouMean("field", name, taken, hint
        ?? `\`forge issue ${out.issueId ?? out.documentId} --full\` prints the body these are the keys of.`));
    }
    out[name] = Object.hasOwn(held, name) ? held[name] : null;
  }
  return out;
};

const columnOf = (value) =>
  (value === null || value === undefined ? "" : String(value).replaceAll(/\s/gu, " "));

const listHint = (row) =>
  `A listed row carries ${Object.keys(row ?? {}).join(", ")}, which is the browse projection; `
  + "`forge issue ISS-45 --fields <name>` reads one issue's wider set.";

/** One listed row as the names asked for, in the order asked and tab-separated: the columns are the
 *  caller's own ask, and whitespace inside a value travels as a space so none of it splits one. */
export const rowLine = (row, names) => {
  const held = projectedTo(row, names, { hint: listHint(row) });
  return names.map((name) => columnOf(held[name])).join("\t");
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
const missing = (reference, total) => {
  const { value, from } = projectTarget();
  const flagged = from === AIMED_FROM;
  return `${reference} is not on the tracker of ${aimSaid()}; ${total} issue(s) were counted, which is`
    + ` the whole backlog.\nThe keys it does hold are on \`forge issue${flagged ? ` --project ${value}` : ""}\`,`
    + " one per line."
    + (flagged ? ""
      : `\nA key on another project is read with \`forge issue ${reference} --project <slug>\`, which saves nothing.`);
};

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

/** The key's document, read off the tracker's own exact key filter: one request, and no assumption
 *  that the key's number is the row's age-rank — a batch creates keys out of createdAt order, which
 *  the offset bisect this took read the wrong row for (ISS-16). On a miss the backlog's own count is
 *  read for the message, the key filter's own total being 0 when nothing matched. */
const resolvedKey = async (reference, soft, held) => {
  const found = await scoped("forge_issues", { action: "by_key", key: reference.toUpperCase() }, soft, held);
  if (found?.refused) return found;
  if (found.row?.documentId) return { id: found.row.documentId };
  const all = await scoped("forge_issues", { action: "at", offset: 0 }, soft, held);
  return all?.refused ? all : { refused: missing(reference, all.total ?? 0) };
};

/** A key's document, refused where this run claimed the key on another document. Soft, and every
 *  offset carrying the request option, for a caller a `fail()` cannot be allowed to exit past. */
export const documentIdIfAny = async (reference, { soft = false, ...held } = {}) => {
  if (UUID.test(reference)) return { id: reference };
  if (!HUMAN_REF.test(reference)) return { refused: notAKey(reference) };
  const found = await resolvedKey(reference, soft, held);
  const moved = found.id ? movedUnderClaim(reference, found.id) : null;
  return moved ? { refused: moved } : found;
};

export const documentIdOf = async (reference) => {
  const held = await documentIdIfAny(reference);
  return held.refused ? fail(held.refused) : held.id;
};
