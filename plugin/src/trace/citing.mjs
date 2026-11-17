/* Which issues cite one clause. Why a search narrowed, and why per clause: docs/cli/spec-the-status.md. */
import { scoped } from "../tracker/rest.mjs";
import { MAX_LIMIT, cappedSaid, readSaid, rowsOf, searchCapped } from "../tracker/issues.mjs";
import { CITED_FIELDS } from "../spec/checked.mjs";
import { identifiersIn } from "../spec/parse.mjs";
import { namesClause } from "../spec/citation.mjs";
import { commentPage, cutIn } from "../tracker/comments.mjs";
import { viewFrom } from "../flow/earned.mjs";
import { specTreeIfAny } from "../spec/tree.mjs";
import { lookup, withDescendants } from "../spec/index.mjs";
import { clauseStatus, couldProve, lowestOf } from "./status.mjs";
import { pooled } from "../wire/pooled.mjs";

/* Soft: a report exiting on a refusal would take the clause read down and word no cut. */
const pageAt = async (id, offset, held) => scoped("forge_issues", {
  action: "citing",
  limit: MAX_LIMIT,
  ...(offset ? { offset } : {}),
  filters: { search: id },
}, held.soft !== false, held);

/** Every citation of `id` in a row, by the rule `approved` counts one by, with its revision. */
const citedIn = (row, index, id) => CITED_FIELDS
  .flatMap(({ field }) => identifiersIn(row?.[field]).map((one) => ({ id: one.id, rev: one.rev, field })))
  .filter((one) => {
    const { clause } = one.id === id ? lookup(index, one.id) : {};
    return Boolean(clause) && namesClause(clause, one);
  });

/* Ends on `hasMore`: one stopping on a short page reports what it read as the whole answer. */
const walk = async (id, held) => {
  const rows = [];
  let read = 0;
  let pages = 0;
  for (;;) {
    const payload = await pageAt(id, read, held);
    pages += 1;
    if (payload?.refused) return { rows, pages, whole: false, refused: payload.refused };
    const page = rowsOf(payload, "issues");
    read += page.length;
    rows.push(...page);
    if (searchCapped({ search: id }, payload, read - page.length)) return { rows, pages, whole: false, capped: true };
    if (payload?.hasMore === false) return { rows, pages, whole: true };
    if (!page.length) return { rows, pages, whole: false };
  }
};

// cm:why since forge ISS-1256 a search row carries none of CITED_FIELDS, so a citation is read off the issue whole; a row whose matchedFields core answered empty holds the term in none of its text
const candidate = (row) => !Array.isArray(row?.matchedFields) || row.matchedFields.length > 0;

// cm:guard one read per issue however many clauses found it, a bounded few at a time
const wholeOf = async (reads, held) => {
  const wanted = [...new Map(reads.flatMap((read) => read.rows).filter(candidate)
    .map((row) => [row.documentId, row])).values()];
  const records = await pooled(wanted, (row) =>
    scoped("forge_issues", { action: "get", documentId: row.documentId, fields: [] }, held.soft !== false, held));
  return new Map(wanted.map((row, at) => [row.documentId, records[at]]));
};

// cm:guard a candidate whose record could not be read is unknown, never uncited: it costs the clause its rung
const resolved = (read, id, index, records) => {
  const rows = [];
  const unread = [];
  for (const row of read.rows.filter(candidate)) {
    const record = records.get(row.documentId);
    if (!record || record.refused) {
      unread.push(`${row.issueId ?? row.documentId}: ${record?.refused ?? "no record came back"}`);
      continue;
    }
    const whole = { ...row, ...record };
    const cited = citedIn(whole, index, id);
    if (cited.length) rows.push({ ...whole, cited });
  }
  return { ...read, rows, unread };
};

const NOTHING = "\nNo status is derived from a set that may be short.";

/** The count and the way out for a citing set the route did not finish; status.mjs rules on it. */
const cutSaid = (read, id) => {
  if (read.capped) return `${cappedSaid(read, `The issues citing ${id}`)}${NOTHING}`;
  if (!read.whole) {
    return `The issues citing ${id} reached ${readSaid(read)} and the reading is incomplete: `
      + (read.refused
        ? `the tracker refused it — ${read.refused}.`
        : "a page reported rows behind it and the next offset returned none.")
      + NOTHING;
  }
  if (!read.unread.length) return null;
  return `The issues citing ${id}: ${read.unread.length} the search found could not be read whole, `
    + `so whether they cite it is unknown —\n${read.unread.map((one) => `  ${one}`).join("\n")}${NOTHING}`;
};

/* One comment read per issue that could prove the clause, and none for the rest; a thread the walk
   could not finish is carried out rather than read as the record. */
const threadShort = (row, page) => {
  if (page?.refused) return `${row.issueId}: the record could not be read — ${page.refused}`;
  const said = cutIn(page);
  return said ? `${row.issueId}: ${said}` : null;
};

const viewsFor = async (rows, id) => {
  const wanted = rows.filter((row) => couldProve(row, id));
  const pages = await Promise.all(wanted.map((row) => commentPage(row.documentId, true)));
  return {
    views: new Map(wanted.map((row, at) =>
      [row.documentId, viewFrom(row.documentId, row, pages[at]?.comments ?? [])])),
    short: wanted.map((row, at) => threadShort(row, pages[at])).filter(Boolean),
  };
};

/* The criteria under what was asked, or the clause itself where it has none: a rung is a claim about
   criteria, and a requirement's is its criteria's. */
const judged = (index, id) => {
  const held = withDescendants(index, id);
  const criteria = held.filter((one) => one.prefix === "AC");
  return (criteria.length ? criteria : held.filter((one) => one.id === id)).map((one) => one.id);
};

/** Every clause under `id` with its rung, and the rung `id` itself stands at. */
export const statusOf = async (id, index = specTreeIfAny(), held = {}) => {
  if (!index) return null;
  const ids = judged(index, id);
  const found = await Promise.all(ids.map((one) => walk(one, held)));
  const records = await wholeOf(found, held);
  const reads = found.map((read, at) => {
    const whole = resolved(read, ids[at], index, records);
    return { id: ids[at], ...whole, cut: cutSaid(whole, ids[at]) };
  });
  const clauses = await Promise.all(reads.map(async (read, at) => {
    if (read.cut) return clauseStatus(ids[at], read);
    const { views, short } = await viewsFor(read.rows, ids[at]);
    return clauseStatus(ids[at], read, views, short);
  }));
  return { id, clauses, rung: lowestOf(clauses) };
};
