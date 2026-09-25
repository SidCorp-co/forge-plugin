/* Reading one issue and posting one record onto it, which every verb that writes a record does: the
   record verb, and the flow verbs that post beside a move. Apart from `record.mjs` because that file is
   the record verb's own, and a verb taking a helper out of another verb's module loads that verb's
   whole tree on its own path. docs/cli/record.md. */
import { translateTo } from "../../../resolve/settings.mjs";
import { mustBeShown, postComment } from "../../../tracker/comments.mjs";
import { documentIdOf } from "../../../tracker/issues.mjs";
import { scoped } from "../../../tracker/rest.mjs";
import { refuseIfGated } from "../../../resolve/visibility.mjs";
import { finderSaid, renew } from "../../lease.mjs";

export const issueOf = async (reference) => {
  const documentId = await documentIdOf(reference);
  const body = await scoped("forge_issues", { action: "get", documentId });
  return { documentId, body };
};

/* What the stored copy will be, said where the write is made: the payload block is the record and
   travels as written, and everything a rewrite reaches is prose around it. */
const REWRITTEN = {
  record: "the payload block is stored as written; the heading above it is rewritten",
  criteria: "the criteria are rewritten, and the numbers a verdict names are what survives",
  plan: "the plan is rewritten, and the three declaration lines a later reader takes a value off are what have to survive it",
  note: "the user-facing half is rewritten and the technical half is stored as written",
};

export const sayStored = (which, language = translateTo()) => {
  if (!language) return null;
  const said = `prose ${language}: ${REWRITTEN[which]}.`;
  console.error(said);
  return said;
};

/* `renewed` is the caller whose write a moment ago renewed the lease, which a second lease write would only repeat; `soft` hands the tracker's refusal back rather than exiting, for the caller with something to say about it. */
export const post = async (documentId, body, { ref = documentId, next = undefined, patch = null, soft = false, renewed = false, finder = false } = {}) => {
  refuseIfGated("forge_comments");
  sayStored("record");
  /* A finder's write renews the caller's own lease and touches no other, as `forge comment` does, and
     so makes the thread's read check itself: a renewal that takes no lease makes none. */
  if (finder) {
    await mustBeShown([{ ref, documentId }]);
    console.error(finderSaid(ref, await renew(documentId, ref, undefined, null, { finder: true })));
  } else if (!renewed) await renew(documentId, ref, next, patch);
  const answer = await postComment(documentId, body, null, soft);
  /* Asked softly by a caller that has something to say about the failure: the tracker's own refusal
     exits the process, and the body would be lost with it. */
  if (answer?.refused) return answer;
  console.log(body);
  return answer;
};
