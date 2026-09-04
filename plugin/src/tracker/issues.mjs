/* Paging, the browse projection and the reference-to-id lookup: docs/cli/the-projections.md. */
import { fail } from "../resolve/settings.mjs";
import { scoped } from "./rpc.mjs";

/* No offset or cursor exists, so a full page is the only signal that rows were left behind. */
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

/* One list per process, and the PROMISE is what is shared: `dep <a> <b>` resolves two references
   at once, so a memo assigned after the await lets each of them fetch the same 41 KB. */
let pending = null;
const referenceIndex = () =>
  (pending ??= listIssues({}, MAX_LIMIT).then(
    (payload) =>
      new Map(rowsOf(payload).map((issue) => [(issue.issueId ?? "").toUpperCase(), issue.documentId])),
  ));

export const documentIdOf = async (reference) => {
  if (UUID.test(reference)) return reference;
  if (!HUMAN_REF.test(reference)) {
    fail(`\`${reference}\` is neither an issue uuid nor a reference like ISS-45.`);
  }
  const found = (await referenceIndex()).get(reference.toUpperCase());
  if (!found) fail(`No issue is referenced ${reference} in the newest ${MAX_LIMIT}.`);
  return found;
};
