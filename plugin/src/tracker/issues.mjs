/* Paging, the browse projection and the reference-to-id lookup: docs/FORGE-CLI.md. */
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
