/* Which issues cite one clause. Why a search narrowed, and why per clause: docs/cli/spec-the-status.md. */
import { scoped } from "../tracker/rest.mjs";
import { MAX_LIMIT, readSaid, rowsOf } from "../tracker/issues.mjs";
import { CITED_FIELDS } from "../spec/checked.mjs";
import { citationsIn } from "../spec/parse.mjs";
import { commentPage, cutIn } from "../tracker/comments.mjs";
import { viewFrom } from "../flow/earned.mjs";
import { specTreeIfAny } from "../spec/tree.mjs";
import { lookup, withDescendants } from "../spec/index.mjs";
import { clauseStatus, couldProve, lowestOf } from "./status.mjs";

/* Soft: a report exiting on a refusal would take the clause read down and word no cut. */
const pageAt = async (id, offset, held) => scoped("forge_issues", {
  action: "citing",
  limit: MAX_LIMIT,
  ...(offset ? { offset } : {}),
  filters: { search: id },
}, held.soft !== false, held);

/** Every citation of `id` in a row, through the reader the write side spends, with its revision. */
export const citedIn = (row, index, id) => CITED_FIELDS
  .flatMap(({ field }) => citationsIn(row?.[field]).map((one) => ({ ...one, field })))
  .filter((one) => one.id === id && lookup(index, one.id).clause);

/* Ends on `hasMore`: one stopping on a short page reports what it read as the whole answer. */
const walk = async (id, index, held) => {
  const rows = [];
  let read = 0;
  let pages = 0;
  for (;;) {
    const payload = await pageAt(id, read, held);
    pages += 1;
    if (payload?.refused) return { rows, pages, whole: false, refused: payload.refused };
    const page = rowsOf(payload, "issues");
    read += page.length;
    for (const row of page) {
      const cited = citedIn(row, index, id);
      if (cited.length) rows.push({ ...row, cited });
    }
    if (payload?.hasMore === false) return { rows, pages, whole: true };
    if (!page.length) return { rows, pages, whole: false };
  }
};

/** The count and the way out for a citing set the route did not finish; status.mjs rules on it. */
export const cutSaid = (read, id) => (read.whole ? null
  : `The issues citing ${id} reached ${readSaid(read)} and the reading is incomplete: `
    + (read.refused
      ? `the tracker refused it — ${read.refused}.`
      : "a page reported rows behind it and the next offset returned none.")
    + "\nNo status is derived from a set that may be short.");

/** The issues citing this clause; `null` is a project with no tree, saying nothing rather than none. */
export const issuesCiting = async (id, index = specTreeIfAny(), held = {}) => {
  if (!index) return null;
  const read = await walk(id, index, held);
  return { id, ...read, cut: cutSaid(read, id) };
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
  const reads = await Promise.all(ids.map((one) => issuesCiting(one, index, held)));
  const clauses = await Promise.all(reads.map(async (read, at) => {
    if (read.cut) return clauseStatus(ids[at], read);
    const { views, short } = await viewsFor(read.rows, ids[at]);
    return clauseStatus(ids[at], read, views, short);
  }));
  return { id, clauses, rung: lowestOf(clauses) };
};
