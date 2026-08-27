/* The issue primitives every verb needs: paging, the browse projection, and turning the reference
   a human cites into the id the API takes.

   These used to live in `commands.mjs`, which imports `deps` and `doctor` — so neither could reach
   them and both grew their own copy. `deps` lost the full-page guard on the way, and a truncated
   dependency graph reported itself as complete. */
import { fail } from "./settings.mjs";
import { scoped } from "./rpc.mjs";

/* The server's own default page is 25 and its schema caps `limit` at 500 with no offset or cursor
   beside it, so a full page is the only signal that anything was left behind. */
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

/* One list per process, not one per reference: `dep <a> <b>` fetched the same 41 KB twice, and a
   `call` payload naming two issues did it sequentially. An issue's documentId never changes. */
let index = null;
const referenceIndex = async () => {
  if (index) return index;
  const rows = rowsOf(await listIssues({}, MAX_LIMIT));
  index = new Map(rows.map((issue) => [(issue.issueId ?? "").toUpperCase(), issue.documentId]));
  return index;
};

/* `issues` prints `ISS-45` in its first column, so that is the reference a reader copies — and the
   API takes the uuid. Resolving it here costs one list, and only when asked. */
export const documentIdOf = async (reference) => {
  if (UUID.test(reference)) return reference;
  if (!HUMAN_REF.test(reference)) {
    fail(`\`${reference}\` is neither an issue uuid nor a reference like ISS-45.`);
  }
  const found = (await referenceIndex()).get(reference.toUpperCase());
  if (!found) fail(`No issue is referenced ${reference} in the newest ${MAX_LIMIT}.`);
  return found;
};
