/* The landing's last step, the rule that says how far a landed change's record carries its status.
   Here rather than in the landing's own status step because a records turn ends on the same rule:
   the turn it hands back to has nothing left in it but this walk, and a walk only a second landing
   call runs is a turn nobody runs (ISS-2690). What each outcome writes is the caller's.
   docs/cli/the-turn.md. */
import { Refusal, landingScope, refusing } from "../../resolve/settings.mjs";
import { Refused } from "../../refusal.mjs";
import { scoped } from "../../tracker/rest.mjs";
import { shortSha } from "../../tracker/evidence.mjs";
import { judgementOf, landingRoute, personOwedForRelease, releasePolicy } from "../../tracker/project-config.mjs";
import { advance } from "../advance.mjs";
import { CLOSES_AT, ORDER, atLeast, setForm } from "../earned.mjs";
import { CLOSES_FROM } from "../machine.mjs";
import { landingSaved, oweRelease } from "../lease.mjs";
import { INDEPENDENT } from "../qa/verdicts.mjs";
import {
  LANDING_DONE, LANDING_JUDGED, LANDING_QA_OWED, LANDING_RECORDS_OWED, landingLine, takeRoute,
} from "./checkpoint.mjs";

export const DEVELOPED = "developed";
const RUNGS = ORDER.slice(ORDER.indexOf(DEVELOPED) + 1);
export const [JUDGED] = RUNGS;
const BEFORE_MERGE = "before-merge";

/* How far a walk goes: through the close only where the release owes a person no act (ISS-1147). */
const walkedWhere = (owed) => (owed ? RUNGS.slice(0, RUNGS.indexOf(CLOSES_FROM) + 1) : RUNGS);

const direct = (run) => run();

const statusOf = async (documentId) =>
  (await scoped("forge_issues", { action: "get", documentId, fields: [] }))?.status ?? null;

/* Read for whether the status is there rather than for whether the move was tried: `done` written
   over a refusal would certify a status nothing earned. `ask` is how a caller's reads fail: the
   landing turns a tracker refusal into its own stop. */
export const moveTo = async (key, to, documentId, ask = direct) => {
  const status = await ask(() => statusOf(documentId));
  if (atLeast(status, to)) {
    console.log(`  ${key} is ${status} already`);
    return true;
  }
  try {
    await refusing(() => advance([key, "--to", to]));
  } catch (error) {
    if (!(error instanceof Refusal || error instanceof Refused)) throw error;
    console.error(`  ${key} stays ${status}: ${error.message}`);
    return false;
  }
  return atLeast(await ask(() => statusOf(documentId)), to);
};

/** Where the record takes a landed change, every rung it earns moved on the way: `done`; `qa-owed`
 *  with the deployment an independent judge is owed; or `records-owed` with the rung the record does
 *  not earn, which is the builder's to answer. `intended` is the release the landing pushed. */
export const walkEarned = async ({ key, documentId, landing, route, judgement, owed, intended, ask = direct }) => {
  const developed = await moveTo(key, DEVELOPED, documentId, ask);
  /* The other place the route puts that turn; the release is what says what is running. */
  if (judgement === INDEPENDENT && route !== BEFORE_MERGE && landing.state !== LANDING_JUDGED) {
    return { state: LANDING_QA_OWED, deployment: intended };
  }
  /* Above the walk, which would otherwise report the rung two above the one it is short of. */
  if (!developed) return { state: LANDING_RECORDS_OWED, rung: DEVELOPED };
  /* One rung at a time up the tail, a jump being refused, and `done` refused to every turn so it
     waits on the last of them: closed over a record that did not earn a rung, the issue would be
     reachable by no route at all. A rung the record does not earn stops the walk where it stands. */
  for (const rung of walkedWhere(owed)) {
    if (await moveTo(key, rung, documentId, ask)) continue;
    /* The one rung that is not the builder's: where a second judge is asked for, `judgeProblem`
       refuses a verdict carrying the builder's id, so that turn is one nobody can discharge. */
    if (rung === JUDGED && judgement === INDEPENDENT) {
      return { state: LANDING_QA_OWED, deployment: landing.deployment || intended };
    }
    return { state: LANDING_RECORDS_OWED, rung };
  }
  return { state: LANDING_DONE };
};

/* A commit on both routes, and the one a verdict cites: `judgeProblem` reads it again at the rung. */
export const OWED_TO_QA = (key, landing, what) =>
  `the checkpoint on ${key} reads \`${LANDING_QA_OWED}\`: ${what} at ${shortSha(landing.deployment)} is `
  + `what an independent judge is owed, and nothing of ${key} moves until the turn comes back.\n`
  + `    forge claim ${key} --take\n`
  + `    ... the verdicts, then: forge claim ${key} --judged`;

export const restsSaid = (key, owed) =>
  `  ${key} rests at \`${CLOSES_FROM}\`: ${owed}, so the close is theirs and not this landing's. `
  + `Once the release is out, set rather than advanced, that same policy being what \`closed\` is `
  + `entered on:\n    ${setForm(key, CLOSES_AT)}`;

/** The walk a records turn ends on, off the checkpoint the hand-back just wrote: the landing's own
 *  status step would run nothing else, so where the record earns every rung left the landing ends
 *  here, and where a judge is owed the turn goes to the judge. Returns the checkpoint it left. */
export const recordsWalked = async (documentId, ref, landing) => {
  const policy = await releasePolicy();
  const owed = personOwedForRelease(policy);
  const out = await walkEarned({
    key: ref, documentId, landing, owed, intended: landing.intended,
    route: landingRoute(policy, landingScope()).value, judgement: judgementOf(policy),
  });
  if (out.state === LANDING_QA_OWED) {
    const saved = await landingSaved(documentId, ref, { state: LANDING_QA_OWED, deployment: out.deployment });
    console.log(`${ref}  ${landingLine(saved)}`);
    console.log(OWED_TO_QA(ref, saved, "the release"));
    return saved;
  }
  if (out.state === LANDING_DONE) {
    if (owed) console.log(restsSaid(ref, owed));
    const saved = await landingSaved(documentId, ref, { state: LANDING_DONE });
    oweRelease(documentId, ref);
    console.log(`${ref}  ${landingLine(saved)}`);
    console.log(`The record earns every status this landing walks, so the checkpoint reads `
      + `\`${LANDING_DONE}\`: no turn of it is left and no landing call is owed. The lease goes back `
      + `as this call ends.`);
    return saved;
  }
  console.log(`The record does not earn \`${out.rung}\`, and what that rung is owed is above. The `
    + `checkpoint stays at \`${landing.state}\`, where the landing's status step takes it and hands `
    + `this turn back again while that rung is unearned:\n  ${takeRoute(ref)}`);
  return landing;
};

