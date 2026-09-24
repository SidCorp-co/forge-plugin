/* How deep a corpus is against the readings held for it — docs/cli/stats-the-eval.md. */
import { RELEASES, RUNS, marksOf, stamped } from "./marks.mjs";

const at = (ms) => stamped(new Date(ms).toISOString());

/* The runs side's kinds: a count mark is written only at a multiple of the window, so between two
   crossings the release marks are the only readings there are. */
const PROJECT_KINDS = [RUNS, RELEASES];

/* The corpus floor a reading carries, or its window's where it carries none: a window on a deep
   corpus begins long after the corpus does (consult c5d393 F1). A consult window says its floor as
   the moment its first consult was logged rather than as a clock reading. */
const reachedBy = (one) => one.comparability?.reach?.from ?? one.now?.profile?.from ?? Date.parse(one.now?.from);

const earlierReach = (scope, from, kinds) => {
  const held = kinds.flatMap((kind) => marksOf(kind, scope))
    .map((one) => ({ one, at: reachedBy(one) }))
    .filter((row) => Number.isFinite(row.at) && row.at < from);
  if (!held.length) return null;
  const deepest = held.reduce((deep, row) => (row.at < deep.at ? row : deep));
  return {
    from: deepest.at,
    by: deepest.one.kind === RELEASES ? `release ${deepest.one.version}` : `mark ${deepest.one.mark}`,
  };
};

/** `scope` and each of `kinds` are what `marksOf` takes. */
export const reachOf = (scope, from, kinds = PROJECT_KINDS) =>
  (Number.isFinite(from) ? { from, earlier: earlierReach(scope, from, kinds) } : null);

/** What a corpus is called and whose depth a reading once saw, in the words of the harness asking. */
const PROJECT_REACH = { corpus: "corpus", whose: "this project", held: "held for this project" };
export const DEVICE_REACH = { corpus: "log", whose: "this device", held: "held on this device" };

/* What a reader told only that depth is gone cannot work out: which of the places the corpus was read from the system sweeps, and so whether the loss is the host's or this reading's (ISS-1578). */
const sweptSaid = (sources) => {
  const swept = sources.filter((one) => one.temporary).map((one) => one.path);
  if (!swept.length) return "";
  return `. ${swept.join(", ")} is a temporary filesystem, so a run whose entry there is gone is `
    + "readable only where the host's own store still holds it";
};

export const reachSaid = (reach, sources = [], terms = PROJECT_REACH) =>
  `the ${terms.corpus} reaches back to ${at(reach.from)}; `
  + (reach.earlier
    ? `${reach.earlier.by}'s reading reached back to ${at(reach.earlier.from)}, `
      + `so depth ${terms.whose} once read is no longer here${sweptSaid(sources)}`
    : `no reading ${terms.held} records an earlier reach, which is not to say the ${terms.corpus} was `
      + "never deeper — a mark is a snapshot and not a history");
