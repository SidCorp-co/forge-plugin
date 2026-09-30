/* What a status move leaves holding the issue, said as the last line of the call that moved it. A
   move reads as a handoff and changes nothing about the lease, and the write before it renewed that
   lease, so a run that stopped reading at the move line reported an issue handed over while a judge
   waited out its clock for hours (ISS-2004). Read back rather than assumed, and after any release the
   call owed, because only the field as the call leaves it says whether anything still holds it. */
import { sessionOf } from "../../resolve/config.mjs";
import { describe, leaseOf, readContext, stateOf } from "../lease.mjs";

/* Process state for the reason `oweRelease` gives: the move is known where it lands, and whether a
   lease outlives it only once the verb has finished, which is `plugin/src/cli.mjs`. Keyed on the
   issue so a landing's walk up several rungs says it once, on the stream its last move spoke on. */
const MOVED = new Map();

export const movedHere = (documentId, ref, say) => MOVED.set(documentId, { ref, say });

/* One line each, so the tail of the output carries the whole of it. A lease the record proves gone,
   or one past its clock, is no hold another run waits on, so only a live one is named. */
const heldSaid = (ref, lease, mine) => (mine
  ? `${ref} is still held by this run after the move: ${describe(lease)}. Until then no other run `
    + `may claim it. Where this run's turn on it is over, shorten it: forge claim ${ref} --minutes 1`
  : `${ref} is held by another run after the move: ${describe(lease)}. Until then no other run may `
    + `claim it.`);

export const heldAfterMoves = async () => {
  const moved = [...MOVED.entries()];
  MOVED.clear();
  for (const [documentId, { ref, say }] of moved) {
    try {
      const context = await readContext(documentId, true);
      if (context?.refused) {
        say(`whether ${ref} is still held after the move could not be read: ${context.refused} `
          + `Read it: forge issue ${ref} --fields sessionContext`);
        continue;
      }
      const lease = leaseOf(context);
      const state = stateOf(lease, sessionOf());
      if (state === "mine" || state === "live") say(heldSaid(ref, lease, state === "mine"));
    } catch (error) {
      say(`whether ${ref} is still held after the move could not be read: ${error?.message ?? error} `
        + `Read it: forge issue ${ref} --fields sessionContext`);
    }
  }
};
