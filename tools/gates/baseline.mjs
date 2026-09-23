/* `--baseline`: the one command a run types for its Phase 0 baseline in this repository, so that
   none of them re-decides it from `--owed`'s output and reaches `--full` (ISS-2291). Which of the
   two a head is owed, the citation or a measurement, is `citeForm`'s and the clean head is
   `headNow`'s, both asked here and neither copied. Loaded only when the flag is given, so a gate
   run without it pays nothing for the flow modules this reaches. */
import { freshForm } from "../../plugin/src/flow/earned/baseline.mjs";
import { citeForm } from "../../plugin/src/flow/earned/published.mjs";
import { headNow } from "../../plugin/src/flow/route.mjs";
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

export const REFUSED = "a baseline stamps a clean head, and this tree has uncommitted paths or is no "
  + "checkout at all: it is taken before the first edit, so commit or move that work first.";

export const citedSaid = (head, cite) => `A ship published a whole-tree result for ${head}, so no `
  + `step is spent: the baseline is this one write.\n  ${cite}`;

export const freshSaid = (head, fresh) => `Nothing is published for ${head}, so the gate measures `
  + "it now, reading the record as `npm run check` does and never as --full, which trusts none of "
  + `it. Record what it reports, at this head:\n  ${fresh}`;
