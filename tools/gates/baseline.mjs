/* `--baseline`: the one command a run types for its Phase 0 baseline in this repository, so that
   none of them re-decides it from `--owed`'s output and reaches `--full` (ISS-2291). Which of the
   two a head is owed, the citation or a measurement, is `citeForm`'s and the clean head is
   `headNow`'s, both asked here and neither copied. Loaded only when the flag is given, so a gate
   run without it pays nothing for the flow modules this reaches. */
import { freshForm } from "../../plugin/src/flow/earned/baseline.mjs";
import { citeForm } from "../../plugin/src/flow/earned/published.mjs";
import { headNow } from "../../plugin/src/flow/worklog.mjs";
import { slugIfAny } from "../../plugin/src/resolve/settings.mjs";

const GATE = "npm run check";

/** What the head in hand is owed: `refused` where it cannot be stamped at all, `cite` where a ship
 *  published a whole-tree result for it, `fresh` where the gate has to measure it. */
export const baselineRoute = (ref) => {
  const head = headNow();
  if (!head) return { refused: true };
  const cite = citeForm(ref, slugIfAny(), head);
  return cite ? { cite, head } : { fresh: freshForm(ref, GATE).replace("<sha>", head), head };
};

const REFUSED = "a baseline stamps a clean head, and this tree has uncommitted paths or is no "
  + "checkout at all: it is taken before the first edit, so commit or move that work first.";

const citedSaid = (head, cite) => `A ship published a whole-tree result for ${head}, so no `
  + `step is spent: the baseline is this one write.\n  ${cite}`;

const freshSaid = (head, fresh) => `Nothing is published for ${head}, so the gate measures `
  + "it now, reading the record as `npm run check` does and never as --full, which trusts none of "
  + `it. Record what it reports, at this head:\n  ${fresh}`;

const WHY = {
  "--full": "--full trusts no record, so a head a ship already measured is spent whole again",
  "--wait": "--wait reads a verdict and measures nothing",
  "--anyway": "a baseline stamps a clean head, and --anyway gates a dirty one",
};

/** The refusal for a flag beside `--baseline` that no baseline takes, naming the one that is. */
export const besideSaid = (other, key) => `--baseline is the baseline and ${other} is not part of one: `
  + `${WHY[other]}.\nTake the baseline: node tools/gates.mjs --baseline ${key ?? "<ISS-nn>"}`;

/** Says what the head in hand is owed and returns the exit code, or null where the gate goes on to
 *  measure it the way a bare call does. */
export const takeBaseline = (key) => {
  const route = baselineRoute(key ?? "<ISS-nn>");
  if (route.refused) {
    console.error(REFUSED);
    return 1;
  }
  if (route.cite) {
    console.log(citedSaid(route.head, route.cite));
    return 0;
  }
  console.log(freshSaid(route.head, route.fresh));
  return null;
};
