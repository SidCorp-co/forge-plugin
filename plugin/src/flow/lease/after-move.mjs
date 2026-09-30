/* What a status move leaves holding the issue, said as the last line of the call that moved it. A
   move reads as a handoff and changes nothing about the lease, and the write before it renewed that
   lease, so a run that stopped reading at the move line reported an issue handed over while a judge
   waited out its clock for hours (ISS-2004). Read back rather than assumed, and after any release the
   call owed, because only the field as the call leaves it says whether anything still holds it. */
import { sessionOf } from "../../resolve/config.mjs";
import { describe, leaseOf, readContext, stateOf } from "../lease.mjs";
import { embeddedRun, keepOnFailure } from "../../refusal.mjs";

/* Process state for the reason `oweRelease` gives: the move is known where it lands, and whether a
   lease outlives it only once the verb has finished, which is `plugin/src/cli.mjs`. Keyed on the
   issue so a landing's walk up several rungs says it once, on the stream its last move spoke on. */
const MOVED = new Map();

/* One line each, so the tail of the output carries the whole of it. A lease the record proves gone,
   or one past its clock, is no hold another run waits on, so only a live one is named. */
const heldSaid = (ref, lease, mine) => (mine
  ? `${ref} is still held by this run after the move: ${describe(lease)}. Until then no other run `
    + `may claim it. Where this run's turn on it is over, shorten it: forge claim ${ref} --minutes 1`
  : `${ref} is held by another run after the move: ${describe(lease)}. Until then no other run may `
    + `claim it.`);

const unreadSaid = (ref, why) =>
  `whether ${ref} is still held after the move could not be read: ${why} `
  + `Read it: forge issue ${ref} --fields sessionContext`;

const heldLine = async (documentId, ref) => {
  try {
    const context = await readContext(documentId, true);
    if (context?.refused) return unreadSaid(ref, context.refused);
    const lease = leaseOf(context);
    const state = stateOf(lease, sessionOf());
    return state === "mine" || state === "live" ? heldSaid(ref, lease, state === "mine") : null;
  } catch (error) {
    return unreadSaid(ref, error?.message ?? error);
  }
};

/* Read once as the move lands as well, and kept for a failure: a call that fails past its move exits
   through `fail`, which reaches no end-of-call read and gives no lease back, so the line as it stood
   at the move is the one that exit prints last, on the move line's stream. A call that completes
   drops it for the read below. */
export const movedHere = async (documentId, ref, say) => {
  MOVED.get(documentId)?.dropped();
  /* Embedded, `fail` throws to the script that embeds the move rather than exiting, so nothing kept
     is printed there and a line kept anyway would outlive the refusal into whatever that script
     fails on next. The end-of-call read below still reaches the move. */
  const line = embeddedRun() ? null : await heldLine(documentId, ref);
  MOVED.set(documentId, { ref, say, dropped: line ? keepOnFailure(line, say) : () => {} });
};

export const heldAfterMoves = async () => {
  const moved = [...MOVED.entries()];
  MOVED.clear();
  for (const [documentId, { ref, say, dropped }] of moved) {
    dropped();
    const line = await heldLine(documentId, ref);
    if (line) say(line);
  }
};
