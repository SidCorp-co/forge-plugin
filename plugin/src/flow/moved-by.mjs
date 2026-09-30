/* What a move nobody typed a status for says moved it. A reply reading `<from> -> <to>` and nothing
   else looks the same whether the record earned the move or the verb went past a person, and a run
   that did not already distrust the verb had nothing to notice (ISS-1750). Said by the call that
   moved it rather than written as a comment: the tracker announces every transition on the page
   itself, and the reader who needed the sentence is the caller holding the reply. */
import { CITED } from "../guides/phases.mjs";
import { releaseAnswer } from "../tracker/project-config.mjs";
import { CLOSES_AT } from "./earned.mjs";

const listed = (kinds) =>
  (kinds.length < 2 ? kinds.join("") : `${kinds.slice(0, -1).join(", ")} and ${kinds.at(-1)}`);

/** The line under an earned move: the kinds its rung is entered on, and at the close, which cites
 *  none, the release policy's own reading that nobody owes the release an act. Null where the rung
 *  names nothing to cite. */
export const movedBySaid = (view, status) => {
  const opens = "  moved by its record, and by no person";
  if (status === CLOSES_AT) {
    return `${opens}: nothing is owed at any rung, and the release policy reads: ${releaseAnswer(view.release)}`;
  }
  const kinds = CITED[status];
  if (!kinds?.length) return null;
  return `${opens}: ${listed(kinds)} ${kinds.length === 1 ? "is" : "are"} what ${status} is entered on`;
};
