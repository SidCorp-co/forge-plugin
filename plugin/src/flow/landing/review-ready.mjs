/* Whether the review on the record answers for the head a `--ready` capture hands over. The landing
   gates the candidate first and reads the records after, so a review of another head let ISS-3181's
   landing spend a 457s gate only to stop at `records-owed`: the capture is refused before the
   checkpoint is written instead. An issue landing outside git hands over no head to compare. */
import { payloadOwed } from "../earned.mjs";
import { landsOutsideGit } from "../record/judged/landing.mjs";
import { sameCommit, shortSha } from "../../tracker/evidence.mjs";
import { unconfiguredTool } from "../../tools/services/tool-config.mjs";

const CONSULT = 'echo "<what this change does>" | forge codex consult --diff --only blocker,major';

/* A payload absent, rewritten or short is `payloadOwed`'s to name, so the two readings word it alike. */
const unanswered = (ref, head, view, record) => {
  const owed = payloadOwed(view, "review", `${ref} carries no review`, record);
  if (owed.length) return owed[0].what;
  const held = view.latest.review.record.fields;
  const judged = shortSha(held.commit ?? held.landing);
  if (held.outcome !== "approved") return `the latest review on ${ref} judged ${judged} and says ${held.outcome}`;
  return held.commit && sameCommit(held.commit, head) ? null : `the latest review on ${ref} judged ${judged}, not ${shortSha(head)}`;
};

/** The refusal a `--ready` capture of `head` owes, or null; `view` is `viewFrom`'s. Where this machine
 *  has no reviewer configured, the route names where one is configured rather than a consult that
 *  cannot run. */
export const reviewReadyRefusal = (ref, head, view, { unconfigured = unconfiguredTool("codex") } = {}) => {
  if (landsOutsideGit(view.issue)) return null;
  const record = `forge record review ${ref} --reviewer codex --commit ${shortSha(head)} --outcome approved --finding "F1 accepted"`;
  const what = unanswered(ref, head, view, record);
  if (!what) return null;
  const consult = unconfigured
    ? "forge doctor   # no reviewer is configured on this machine: it names what the codex gateway lacks and the call that sets it"
    : CONSULT;
  return `claim --ready captures ${shortSha(head)}, and ${what}: the landing gates the head this write names `
    + "and reads its review after, so a review of any other head stops it at `records-owed` once the gate is spent. "
    + `Review ${shortSha(head)}, then ask again:\n  ${consult}\n  ${record}\n  forge claim ${ref} --pushed --ready`;
};
