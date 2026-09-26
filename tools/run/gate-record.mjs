/* What a landing writes down about a gate it ran, off the record the gate itself wrote for the tree it
   judged: the verdict, and the seconds its steps ran rather than the wall time, which holds the wait
   for a place. Both landing verbs gate, so both note it here. docs/cli/stats-the-landing.md. */
import { realpathSync } from "node:fs";

import { runOf } from "../gates/verdict.mjs";
import { GATE_ERROR, GREEN, RED, DECLINED, gateRecorded } from "../../plugin/src/stats/marks/attempts.mjs";

/* The gate's own words for how a run ended, read as the landing's four. */
const READ_AS = { pass: GREEN, unproved: GREEN, failed: RED, declined: DECLINED, refused: GATE_ERROR };

/** The tree's own record, under the path the gate knows itself by: node resolves a link in the path
 *  before the gate reads where it stands, and the record is keyed on that. */
export const verdictIn = (tree) => {
  let real = tree;
  try {
    real = realpathSync(tree);
  } catch {
    /* A tree that cannot be resolved is read as named, and a missing record reads as no verdict. */
  }
  return runOf(real, null);
};

/* The newest record, where it was decided at or after `since`: an older one is another run's. */
const freshIn = (tree, since) => {
  const record = verdictIn(tree);
  return record && (Date.parse(record.at ?? "") || 0) >= since ? record : null;
};

/** Notes the gate over `candidate` that ran in `tree` from `since` and judged `members`, and returns
 *  the gate's own record of it with the verdict noted. `exited` is what its exit said where the caller knows it; without it,
 *  or where the record says otherwise, the record's own verdict is taken, and no record is a gate that
 *  could not run. */
export const gateNoted = ({ root, tree, candidate, members, since, exited = null }) => {
  const record = freshIn(tree, since);
  const verdict = READ_AS[record?.verdict] === GATE_ERROR ? GATE_ERROR : exited ?? READ_AS[record?.verdict] ?? GATE_ERROR;
  gateRecorded({ root, candidate, members, verdict, seconds: verdict === GREEN || verdict === RED ? record?.seconds ?? null : null });
  return { record, verdict };
};
