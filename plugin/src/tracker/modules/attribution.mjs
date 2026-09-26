/* The issues behind a module: the rank's primaries, a reading's counts and a removal's carriers,
   each one paged walk of the search route. */
import { scoped } from "../rest.mjs";
import { NO_LONGER_OWES } from "../../flow/earned/park-status.mjs";

/* The route's own page size, which is the most one ask may carry. */
const PAGE = 200;

/** An issue's primary module id off the attributions a search row carries, or null. */
export const primaryOf = (attributions) =>
  (attributions ?? []).find((one) => one?.isPrimary)?.labelId ?? null;

/* One walk of the search route, a page at a time, to the end or to where it stopped short. */
const walked = async (narrowing, each) => {
  let offset = 0;
  for (;;) {
    const page = await scoped("forge_issues", { action: "attributed", ...narrowing, limit: PAGE, offset });
    const rows = page?.issues ?? [];
    for (const row of rows) each(row);
    if (page?.hasMore !== true) return page?.hasMore === false;
    if (!rows.length) return false;
    offset += rows.length;
  }
};

/** Every issue at `statuses` and the id of its primary module, paged to the end; `whole` false where
 *  the walk stopped short, which the caller says rather than reading absence as no module. */
export const primaryModules = async (statuses) => {
  const found = new Map();
  const whole = await walked({ statuses }, (row) => found.set(row.issueId, primaryOf(row.modules)));
  return { found, whole };
};

/** The open issues — every status but the two that owe nothing more — counted in one walk: how many
 *  there are, how many carry no module at all, and how many carry each module as primary. One walk
 *  rather than the tracker's rollup, whose buckets cannot give the whole the share is taken over. */
export const openCounts = async () => {
  const counted = { open: 0, unassigned: 0, primary: new Map() };
  const whole = await walked({ statusNot: NO_LONGER_OWES }, (row) => {
    counted.open += 1;
    if (!(row.modules ?? []).length) counted.unassigned += 1;
    const primary = primaryOf(row.modules);
    if (primary) counted.primary.set(primary, (counted.primary.get(primary) ?? 0) + 1);
  });
  return { ...counted, whole };
};

/** The share `part` is of `whole`, as a whole percentage rounded to nearest. */
export const shareOf = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/** Every issue carrying module `id` at all, primary or not, whatever its status. */
export const carriersOf = async (id) => {
  const rows = [];
  const whole = await walked({ module: id }, (row) => rows.push(row));
  return { rows, whole };
};
