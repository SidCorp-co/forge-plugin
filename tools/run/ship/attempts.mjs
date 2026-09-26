/* A ship's own landing attempt, one per issue its tree was started for: opened at its gate where the
   same pass goes on to push, and ended landed the moment its push is taken, or back with the cause of
   the stop that ended it. A ship re-runs its gate on every resume, so one pass is one attempt. What
   the records are and who reads them: docs/cli/stats-the-landing.md. */
import { gitOut, remoteRef, Stop } from "../../checkout.mjs";
import { DECLINED as DECLINED_STATUS } from "../../gates/machine.mjs";
import { remoteHeadOf } from "../install.mjs";
import { gateNoted } from "../gate-record.mjs";
import { keysHere } from "./checkpoint.mjs";
import {
  BACK, BRANCH, DECLINED, GATE_ERROR, GREEN, LANDED, MOVED_BASE, RED, attemptEnded, attemptOpened,
} from "../../../plugin/src/stats/marks/attempts.mjs";

const VERB = "ship";

/** The pass's side of it: `armed` once the caller knows the pass reaches both the gate and the push. */
export const shipAttempt = () => ({ armed: false, candidate: null, handles: [] });

const endAll = (attempt, outcome, cause = null) => {
  for (const handle of attempt.handles) attemptEnded(handle, { outcome, cause, candidate: attempt.candidate });
  attempt.handles = [];
};

/* What a gate that did not pass stops its attempts for. */
const CAUSE_OF = { [RED]: BRANCH, [DECLINED]: DECLINED };

/* How the gate exited, off the run itself: a gate that wrote no record of its own still exited somehow. */
const exitedAs = (run) => {
  if (!run || run.error) return GATE_ERROR;
  if (run.status === 0) return GREEN;
  return run.status === DECLINED_STATUS ? DECLINED : RED;
};

/** The gate step: each issue's attempt opened at the head the gate judges, the gate run, and noted. */
export const gatedShip = (attempt, tree, run) => {
  attempt.candidate = gitOut(["rev-parse", "HEAD"], tree);
  const members = keysHere(tree);
  if (attempt.armed) {
    attempt.handles = members.map((issue) => attemptOpened({ root: tree, issue, verb: VERB, candidate: attempt.candidate }))
      .filter(Boolean);
  }
  const since = Date.now();
  let heard = null;
  try {
    run((one) => {
      heard = one;
    });
  } finally {
    const { verdict } = gateNoted({ root: tree, tree, candidate: attempt.candidate, members, since, exited: exitedAs(heard) });
    if (verdict !== GREEN) endAll(attempt, BACK, CAUSE_OF[verdict] ?? null);
  }
};

/** The git push itself: landed once it is taken; refused, a moved base where the remote no longer
 *  reads the head this tree rebased onto, and no cause the landing can name otherwise. */
export const pushedShip = (attempt, tree, base, run) => {
  try {
    run();
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    const now = remoteHeadOf(tree, base);
    endAll(attempt, BACK, now && now !== gitOut(["rev-parse", remoteRef(base)], tree) ? MOVED_BASE : null);
    throw error;
  }
  endAll(attempt, LANDED);
};

/** Whatever the pass left open, ended with no cause: it stopped at a step no cause of the set names. */
export const shipLeft = (attempt) => endAll(attempt, BACK);
