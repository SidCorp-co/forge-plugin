/* A verdict whose writer the judging rung never counts, refused before it is sent rather than stored
   over one that counts: docs/cli/record-the-judge.md. */
import { INHERITED } from "../../../resolve/config.mjs";
import { thisCall } from "../../../resolve/flags.mjs";
import { RUN_ID_VAR } from "../../../resolve/session/run-id.mjs";
import { refuse } from "../../../refusal.mjs";
import { releasePolicy } from "../../../tracker/project-config.mjs";
import { writtenBy } from "../../lease.mjs";
import { JUDGE_FROM, SHAPES } from "../../machine.mjs";
import { asksIndependent, writerRefusal } from "../../qa/verdicts.mjs";

const VERDICT = "verdict";

/* An inherited id is answered by the caller's own, sent with the same flags; the builder's is not
   answered by any id this caller could set, the judgement being another run's. */
const routeFor = (ref, held) => (held[JUDGE_FROM] === INHERITED
  ? `Send it again under an id of its own:\n  ${RUN_ID_VAR}=<an id of its own> ${thisCall() ?? `forge record verdict ${ref} ...`}`
  : `The judgement is another run's. What the judging rung is waiting on:\n  forge advance ${ref} --owed`);

/** Refuses the call where it carries a verdict this project's judging rung would never count, for who
 *  is writing it. Silent where the call carries none, and on a project that asks for no second judge,
 *  whose policy read is the one call this costs there. */
export const writerChecked = async (ref, kinds, { documentId, body }, page) => {
  if (!kinds.includes(VERDICT)) return;
  const release = await releasePolicy();
  if (!asksIndependent(release)) return;
  const { viewFrom } = await import("../../earned.mjs");
  const read = await page();
  const held = writtenBy(SHAPES[VERDICT]);
  const why = writerRefusal(viewFrom(documentId, body, read.comments, read.cut, release), held);
  if (!why) return;
  refuse(`record verdict: this verdict ${why}. ${ref}'s project asks for a judge other than the run `
    + `that built the change, so the judging rung counts no verdict written under this id, and the page `
    + `keeps the latest verdict on a criterion: this one would take the place of any that stands there. `
    + `Nothing was sent. ${routeFor(ref, held)}`);
};
