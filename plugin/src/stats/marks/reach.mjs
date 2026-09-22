/* How deep this project's corpus is against the readings held for it — docs/cli/stats-the-eval.md. */
import { RELEASES, RUNS, marksOf, stamped } from "./marks.mjs";

const at = (ms) => stamped(new Date(ms).toISOString());

/* The corpus floor a reading carries, or its window's where it carries none: a window on a deep
   corpus begins long after the corpus does (consult c5d393 F1). */
const reachedBy = (one) => one.comparability?.reach?.from ?? one.now?.profile?.from;

const earlierReach = (scope, from) => {
  const held = [...marksOf(RUNS, scope), ...marksOf(RELEASES, scope)]
    .map((one) => ({ one, at: reachedBy(one) }))
    .filter((row) => Number.isFinite(row.at) && row.at < from);
  if (!held.length) return null;
  const deepest = held.reduce((deep, row) => (row.at < deep.at ? row : deep));
  return {
    from: deepest.at,
    by: deepest.one.kind === RELEASES ? `release ${deepest.one.version}` : `mark ${deepest.one.mark}`,
  };
};

export const reachOf = (scope, from) =>
  (Number.isFinite(from) ? { from, earlier: earlierReach(scope, from) } : null);

/* What a reader told only that depth is gone cannot work out: which of the places the corpus was read from the system sweeps, and so whether the loss is the host's or this reading's (ISS-1578). */
const sweptSaid = (sources) => {
  const swept = sources.filter((one) => one.temporary).map((one) => one.path);
  if (!swept.length) return "";
  return `. ${swept.join(", ")} is a temporary filesystem, so a run whose entry there is gone is `
    + "readable only where the host's own store still holds it";
};

export const reachSaid = (reach, sources = []) =>
  `the corpus reaches back to ${at(reach.from)}; `
  + (reach.earlier
    ? `${reach.earlier.by}'s reading reached back to ${at(reach.earlier.from)}, `
      + `so depth this project once read is no longer here${sweptSaid(sources)}`
    : "no reading held for this project records an earlier reach, which is not to say the corpus was "
      + "never deeper — a mark is a snapshot and not a history");
