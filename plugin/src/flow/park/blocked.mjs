/* What clears a `blocked` park, asked by the resume that reads it and by the answer write that may
   supply it, so the two cannot disagree about which park an answer is read on. The edges speak for
   the blocker where the tracker holds any; where it holds none — a blocker in another project, an
   edge never recorded or since removed — nothing on the record stands for the blocker but a
   person's word that it cleared, and an edgeless park read as spent at its own write is what put an
   issue back in the pool with nothing to build (ISS-2675). */
import { gatesDispatch } from "../earned/blockers.mjs";
import { isConflictPark } from "../landing/conflict-park.mjs";

/** `lifted` — the capture's lift of the conflict park it already proved the landing's own, which by
 *  then names a head the park does not; `landing` — that park still standing over the head the
 *  checkpoint names, handed back to the builder, whose own step takes it up; `edges` — the gating
 *  edges the tracker holds; `answer` — none of those, so a person's answer clears it. */
export const blockedClearedBy = (view, held) => {
  if (view.lifts && view.lifts === (held.comment.documentId ?? held.comment.id)) return "lifted";
  if (isConflictPark(held.record.fields, view.landing?.head)) return "landing";
  if ((view.issue.relations?.blockedBy ?? []).some(gatesDispatch)) return "edges";
  return "answer";
};
