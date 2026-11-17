/* The columns core's search reads the term in, as its `matchedFields` names them: a row the term
   reached through any other key holds it in none of its own text. */
const SEARCHED_FIELDS = ["title", "description", "plan", "acceptanceCriteria"];
export const matchedIn = (row, wanted) =>
  SEARCHED_FIELDS.filter((field) => String(row?.[field] ?? "").toLowerCase().includes(wanted));

// cm:why core's search row carries none of the long text columns since forge ISS-1256: matchedFields says where the term was, and the issue read whole says what
const BODIES = ["description", "plan", "acceptanceCriteria"];
export const bodiless = (page) => ({ ...page, items: page.items.map((one) =>
  Object.fromEntries(Object.entries(one).filter(([name]) => !BODIES.includes(name)))) });

/** Rows as core's search answers them for `wanted`, `matchedIn` said on each. */
export const searchedRows = (rows, wanted) =>
  rows.map((one) => ({ ...one, matchedFields: matchedIn(one, String(wanted ?? "").toLowerCase()) }));
