/* Where a relayed answer is a write something reads, asked before anything of the call is sent. */
import { refuse } from "../../refusal.mjs";
import { answersByComment } from "../earned/park-status.mjs";
import { SILENT, parkThatSet } from "./read.mjs";
import { blockedClearedBy } from "./blocked.mjs";

/* An answer is read only by the resume from a status a comment answers, or from `on_hold` under a
   blocked park no edge speaks for (./blocked.mjs), so one written anywhere else is an input
   nothing reads: every other `on_hold` is lifted by a person's set, by its blockers or by the
   landing's own capture, never by one. */
export const answerChecked = async (kind, reference, { documentId, body }, page) => {
  if (kind !== "answer" || answersByComment(body.status)) return;
  if (body.status === SILENT) {
    const { comments, cut } = await page();
    const { viewFrom } = await import("../earned.mjs");
    const view = viewFrom(documentId, body, comments, cut);
    const held = parkThatSet(view, SILENT);
    if (held?.record.fields.kind === "blocked" && blockedClearedBy(view, held) === "answer") return;
  }
  refuse(`record answer: ${reference} is ${body.status}, and an answer is read only where a park waits `
    + "on a person — waiting or needs_info, or on_hold under a blocked park no edge speaks for — so "
    + `nothing would read this one. Nothing was sent. What it does wait on:\n  forge advance ${reference} --owed`);
};
