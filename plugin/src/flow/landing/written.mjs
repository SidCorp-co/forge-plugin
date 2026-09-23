/* The two checkpoints a claim composes rather than moves: the one a build leaves at its push, and
   the one written after the landing by a run that has no push left to leave it at. They sit apart
   from `claim.mjs` because each is the checkpoint's own shape and none of the lease's, and because
   a verb that both composes a record and walks a state table is two files' worth of one name.
   docs/cli/the-checkpoint.md, and docs/cli/the-reconstruction.md for the second. */
import { DERIVED_BUILDER, HAND_WRITTEN, REBUILT_FORM, RECOVER_THE_BUILDER, UNRECOVERABLE }
  from "./reconstruction.mjs";
import { LANDING_DONE, LANDING_HEAD_OWED, LANDING_READY } from "./checkpoint.mjs";
import { carriedByLanding } from "../worklog.mjs";
import { fail } from "../../resolve/settings.mjs";
import { sameCommit, shortSha } from "../../tracker/evidence.mjs";

/* Git licenses this write and the caller's word does not: the one fact it records, that the branch
   this project lands changes on carries the head, is read off refs already in this checkout. Which
   branch that is comes in resolved, the reading being the landing route's own and this file holding
   no policy of its own (ISS-1802). The builder is left unnamed because the run reaching for this is
   the one judging the change (ISS-1784). */
export const rebuiltCheckpoint = (ref, holder, head,
  { deployment, undeployed, held, landing, holders, lands }) => {
  if (landing) {
    fail(`claim --rebuilt writes a landing checkpoint where there is none, and ${ref} already reads `
      + `\`${landing.state}\`: a reconstruction over a record somebody captured would replace what it `
      + `cannot recover with what it guessed. Read where the landing is:\n  forge resume ${ref}`);
  }
  /* The read above is what the rest of this file goes by, and it answers `null` for a stored block
     whose state it cannot place as well as for no block at all. Those are not one thing here: the
     second is the case this write is for and the first holds evidence a reconstruction would write
     over, having read none of it (ISS-1784). */
  if (held && typeof held === "object") {
    fail(`claim --rebuilt writes a landing checkpoint where there is none, and ${ref} holds one whose `
      + `state reads \`${held.state || "nothing at all"}\`, which is no state this version knows. A `
      + `reconstruction over it would replace ${Object.keys(held).sort().join(", ")} with what this `
      + `write could not recover. Read what is on it, and settle the state before asking again:\n`
      + `  forge resume ${ref}`);
  }
  /* One statement about the deployment is owed and the write refuses a silence rather than choosing
     for the caller. Whether a change reached a deployment is a fact about the world no checkout can
     read, and an omitted `--deployment` taken as `there is none` would switch off the citation the
     verdict gate spends at `testing` with nothing on the record saying so. The judge holds either
     value: an identity is what it judged against, and its absence is what it judged without
     (ISS-1993). */
  if (deployment && undeployed) {
    fail(`claim --rebuilt takes one statement about the deployment, and this call names an identity `
      + `and says the change reached none. Type whichever is true:\n`
      + `  ${REBUILT_FORM(ref, shortSha(head), "\n  ")}`);
  }
  if (!deployment && !undeployed) {
    fail(`claim --rebuilt writes the checkpoint a verdict is judged against, and a verdict cites the `
      + `identity it judged: name the deployment, or say the change reached none and the head is `
      + `what its verdicts answer to:\n  ${REBUILT_FORM(ref, shortSha(head), "\n  ")}`);
  }
  if (holders.length === 1) {
    fail(`claim --rebuilt declares the builder unrecoverable, and `
      + `${DERIVED_BUILDER(ref, holders[0])}, and a guessed builder is what this key exists to stop. `
      + `${RECOVER_THE_BUILDER(holders[0])}`);
  }
  const read = carriedByLanding(head, lands);
  if (!read.carries) {
    fail(`claim --rebuilt writes a checkpoint on a change the branch it lands on already carries, `
      + `and this checkout cannot prove it carries ${shortSha(head)}: ${read.why}.`
      + `${read.from ? ` That branch is ${read.from}.` : ""} The reading is made `
      + `off refs already here, a claim being one of the writes that may not wait on a remote — and `
      + `where the change is genuinely unlanded what is owed is the capture and not this write. `
      + `${read.route ? "Settle the reading, then ask again" : "Ask from a checkout that can read that history"}:\n`
      + (read.route ? `  ${read.route}\n` : "")
      + `  ${REBUILT_FORM(ref, shortSha(head), "\n  ")}`);
  }
  /* Absent and not present-and-empty: the write is compared with what the field reads back, and a
     key carrying `undefined` is one this side holds and the record does not (ISS-1993). */
  return {
    state: LANDING_DONE,
    head,
    ...(deployment ? { deployment } : {}),
    files: [],
    [HAND_WRITTEN]: {
      by: holder,
      at: new Date().toISOString(),
      why: `written after the landing, off ${read.ref} — ${read.from} — at ${shortSha(read.tip)} `
        + `carrying ${shortSha(head)}; ${deployment
          ? "the deployment identity is the caller's and not this checkout's reading"
          : "the caller says the change reached no deployment, so the head is the identity its "
            + "verdicts answer to"}`,
      builder: UNRECOVERABLE(holders),
      lost: ["builder", "branch", "base", "files", "at"],
    },
  };
};

export const readyCheckpoint = (ref, holder, patch, landing) => {
  if (!patch?.head || !patch.base || !patch.touched) {
    fail(`claim --ready writes the checkpoint off the capture --pushed makes, and this one captured `
      + `no change — the line above says why. Capture at the push, before the merge:\n`
      + `  forge claim ${ref} --pushed --ready`);
  }
  if (landing && landing.state !== LANDING_READY && landing.state !== LANDING_HEAD_OWED) {
    fail(`the landing checkpoint on ${ref} reads \`${landing.state}\`, which is past the build, so `
      + `--ready would write the landing's own reading away. Read where it is:\n  forge resume ${ref}`);
  }
  return {
    state: LANDING_READY,
    builder: holder,
    branch: patch.branch,
    head: patch.head,
    base: patch.base,
    files: String(patch.touched ?? "").split(", ").filter(Boolean),
    at: patch.at,
  };
};

/* What the capture says of itself in the refusal below; `--landed` out of the same state says its own. */
const CAPTURE_SAID = (ref, head) => ({
  out: `claim --ready out of \`${LANDING_HEAD_OWED}\` captures ${shortSha(head)}`,
  why: "the landing merges the head this write names, so it takes a head a review approved and no other",
  again: `forge claim ${ref} --pushed --ready`,
});

/** What refuses the capture out of `head-owed`, or null: the head it takes is one the records judged.
 *  The latest review has to be an approved one of that head, and where the builder is this project's
 *  judge every criterion's latest verdict has to judge that head and not fail — a verdict at the head
 *  the landing handed back describes the commit whose gate went red, and carried to the new one it
 *  would read as a judgement nobody made. Under an independent judge the verdicts are that judge's,
 *  written against a candidate after this capture, so none is asked for here. `view` is `viewFrom`'s. */
export const recaptureRefusal = (ref, head, { latest, verdicts, criteria }, independent, said = CAPTURE_SAID(ref, head)) => {
  const review = latest.review?.record.fields ?? null;
  const ask = `forge record review ${ref} --reviewer codex --commit ${shortSha(head)} --outcome approved`;
  const { out, why, again } = said;
  if (!review?.commit || !sameCommit(review.commit, head) || review.outcome !== "approved") {
    const held = review?.commit
      ? `the latest review on ${ref} judged ${shortSha(review.commit)} and says ${review.outcome ?? "nothing"}`
      : `${ref} carries no review`;
    return `${out}, and ${held}: ${why}. Review ${shortSha(head)}, then ask again:\n  ${ask}\n`
      + `  ${again}`;
  }
  if (independent) return null;
  const unjudged = criteria.map((one) => one.number).filter((number) => {
    const held = verdicts.get(number)?.record.fields;
    return !held?.commit || !sameCommit(held.commit, head) || held.verdict === "fail";
  });
  if (!unjudged.length) return null;
  const at = unjudged.map((number) => {
    const held = verdicts.get(number)?.record.fields;
    return held?.commit ? `${number} at ${shortSha(held.commit)} (${held.verdict})` : `${number} unjudged`;
  });
  return `${out}, and this project's judge is the run that built it, whose verdicts on criterion `
    + `${at.join(", ")} do not pass that head. Judge ${shortSha(head)}, then ask again:\n`
    + `  forge record verdict ${ref} --commit ${shortSha(head)} --evidence <attachment|url|sha>`
    + unjudged.map((number) => ` --criterion ${number} --verdict pass`).join("")
    + `\n  ${again}`;
};
