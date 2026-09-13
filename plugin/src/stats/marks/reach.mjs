/* How deep this project's corpus is against the readings held for it — docs/cli/stats-the-eval.md. */
import { RELEASES, RUNS, marksOf, stamped } from "./marks.mjs";

const at = (ms) => stamped(new Date(ms).toISOString());

/* The corpus floor a reading carries, or its window's where it carries none: a window on a deep
   corpus begins long after the corpus does (consult c5d393 F1). */
const reachedBy = (one) => one.comparability?.reach?.from ?? one.now?.profile?.from;

export const earlierReach = (root, from) => {
  const held = [...marksOf(RUNS, root), ...marksOf(RELEASES, root)]
    .map((one) => ({ one, at: reachedBy(one) }))
    .filter((row) => Number.isFinite(row.at) && row.at < from);
  if (!held.length) return null;
  const deepest = held.reduce((deep, row) => (row.at < deep.at ? row : deep));
  return {
    from: deepest.at,
    by: deepest.one.kind === RELEASES ? `release ${deepest.one.version}` : `mark ${deepest.one.mark}`,
  };
};

export const reachOf = (root, from) =>
  (Number.isFinite(from) ? { from, earlier: earlierReach(root, from) } : null);

export const reachSaid = (reach) =>
  `the corpus reaches back to ${at(reach.from)}; `
  + (reach.earlier
    ? `${reach.earlier.by}'s reading reached back to ${at(reach.earlier.from)}, `
      + "so depth this project once read is no longer here"
    : "no reading held for this project records an earlier reach, which is not to say the corpus was "
      + "never deeper — a mark is a snapshot and not a history");
