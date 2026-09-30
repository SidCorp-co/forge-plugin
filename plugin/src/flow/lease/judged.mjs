/* The one record written past another run's lease: a verdict, sent by a run under an id it set for
   itself. The lease guards the writes that replace something — a field, a status, the lease itself —
   and a verdict replaces nothing, so a judge dispatched while its dispatcher holds the issue writes
   it without taking, renewing or waiting out that lease (ISS-1494). docs/cli/record.md. */
import { answersByComment } from "../earned/park-status.mjs";
import { ASKED, WORKTREE, sessionSourced } from "../../resolve/config.mjs";
import { thisCall } from "../../resolve/flags.mjs";
import { RUN_ID_VAR } from "../../resolve/session/run-id.mjs";
import { describe, leaseOf, stateOf } from "../lease.mjs";

const VERDICT = "verdict";

/* An id the caller named, in the variable or in the tree it stands in. The inherited one is the
   dispatching session's and the saved one the machine's, so a verdict under either says nothing
   about which run judged. */
const OWN = [ASKED, WORKTREE];

/* Another run's lease standing in the field: inside its duration, or past it with nothing proving
   the holder gone. A lease the record proves dead is taken by the write as any write takes one. */
const ANOTHERS = ["live", "expired"];

const standing = (context, held) => {
  const lease = leaseOf(context);
  return ANOTHERS.includes(stateOf(lease, held.id)) ? lease : null;
};

const whose = (held) => `${held.id ?? "no id"}${held.said ? `, read from ${held.said}` : ""}`;

const again = () => `${RUN_ID_VAR}=<an id of its own> ${thisCall() ?? "forge record verdict <ref> ..."}`;

/* A comment at those statuses is read by the tracker as the reply to the park and reopens the issue,
   a status moved by a write that may move none. */
const parkReopens = (ref, status, lease) =>
  `${ref} is ${status} under another run's lease, and at that status the tracker reads a comment `
  + `as the reply to its park and reopens the issue, so a judge's verdict would move a status a `
  + `judge's write may not. The park is the holder's to answer, ${lease.holder}'s`;

/** The lease a judge's write goes past, or null where the write is an ordinary one. Only a write
 *  of verdicts alone is a judge's: a verdict beside another kind rides that kind's lease, and meets
 *  its refusal. A verdict under an id the caller did not set is refused here rather than written
 *  under a name that proves nothing, and so are a run flag, which writes onto a lease this takes
 *  none of, and one at a park a comment answers. The id is asked first, being the one refusal
 *  whose way out is the caller's own. */
export const judgedPast = (ref, kinds, body, { flags = [], held = sessionSourced() } = {}) => {
  if (!kinds.length || kinds.some((kind) => kind !== VERDICT)) return null;
  const lease = standing(body?.sessionContext, held);
  if (!lease) return null;
  if (!OWN.includes(held.source)) {
    return {
      refused: `${ref} is held by another run: ${describe(lease)}. A verdict is the one record `
        + `written past another run's lease, and only under an id the caller set for itself, so the `
        + `verdict says which run judged. This call holds ${whose(held)}. Nothing was sent. Give it `
        + `an id of its own and send this again:\n  ${again()}`,
    };
  }
  if (flags.length) {
    return {
      refused: `record verdict: ${ref}'s lease is another run's, so this verdict is a judge's write `
        + `and takes no lease, and ${flags.join(", ")} writes onto the lease: nothing here would act `
        + `on it. Nothing was sent. Send the verdict without it.`,
    };
  }
  if (answersByComment(body?.status)) {
    return {
      refused: `record verdict: ${parkReopens(ref, body.status, lease)}. Nothing was sent. What the `
        + `park waits on:\n  forge advance ${ref} --owed`,
    };
  }
  return { lease, held };
};

/** Said once the verdict is up: whose lease stood, and under which id the verdict went. */
export const judgedSaid = (ref, { lease, held }) =>
  `The lease on ${ref} stands as it was, ${describe(lease)}: a verdict is the one record written `
  + `past another run's lease, and this one went up under ${whose(held)}, taking and renewing none.`;

/** Said in place of the move a judge's record earns: the status is a write the lease covers. */
export const moveHeld = (ref, next, { lease }) =>
  `${ref}'s record now earns ${next}, and the move is the holder's, ${lease.holder}: a judge's write `
  + `moves no status. The holder takes it with:\n  forge advance ${ref}`;

/** What `advance --owed` tells a caller that does not hold the lease standing on the issue, before
 *  it judges anything rather than at the write that would refuse it. */
export const judgeOwed = (ref, { sessionContext, status } = {}, held = sessionSourced()) => {
  const lease = standing(sessionContext, held);
  if (!lease) return null;
  if (OWN.includes(held.source) && answersByComment(status)) {
    return `A verdict from this call would be refused: ${parkReopens(ref, status, lease)}.`;
  }
  if (OWN.includes(held.source)) {
    return `A verdict from this call is a judge's write: ${ref}'s lease is ${lease.holder}'s, and `
      + `\`forge record verdict\` posts past it under ${held.id} without taking it. No other record `
      + `from this call is written while that lease stands.`;
  }
  return `A verdict from this call would be refused: ${ref}'s lease is ${lease.holder}'s, and this `
    + `call holds ${whose(held)}, an id it did not set for itself. Set one before judging:\n  `
    + `${RUN_ID_VAR}=<an id of its own> forge advance ${ref} --owed`;
};
