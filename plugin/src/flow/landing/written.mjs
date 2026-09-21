/* The two checkpoints a claim composes rather than moves: the one a build leaves at its push, and
   the one written after the landing by a run that has no push left to leave it at. They sit apart
   from `claim.mjs` because each is the checkpoint's own shape and none of the lease's, and because
   a verb that both composes a record and walks a state table is two files' worth of one name.
   docs/cli/the-checkpoint.md, and docs/cli/the-reconstruction.md for the second. */
import { HAND_WRITTEN, REBUILT_FORM, RECOVER_THE_BUILDER, UNRECOVERABLE } from "./reconstruction.mjs";
import { LANDING_DONE, LANDING_READY } from "./checkpoint.mjs";
import { carriedByDefault } from "../worklog.mjs";
import { fail } from "../../resolve/settings.mjs";
import { shortSha } from "../../tracker/evidence.mjs";

/* Git licenses this write and the caller's word does not: the one fact it records, that the default
   branch carries the head, is read off refs already in this checkout. The builder is left unnamed
   because the run reaching for this is the one judging the change (ISS-1784). */
export const rebuiltCheckpoint = (ref, holder, head, { deployment, held, landing, holders }) => {
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
  /* Without it the write leaves a checkpoint the verdict gate refuses on its other half, which is
     the route ending where it began. The judge holds this value: it is what it judged against. */
  if (!deployment) {
    fail(`claim --rebuilt writes the checkpoint a verdict is judged against, and that asks a `
      + `deployment identity as well as a head — a checkpoint carrying neither builder nor `
      + `deployment earns a verdict nothing:\n  ${REBUILT_FORM(ref, shortSha(head))}`);
  }
  if (holders.length === 1) {
    fail(`claim --rebuilt declares the builder unrecoverable, and the claim history on ${ref} names `
      + `exactly one run that held it while the change was being built, \`${holders[0]}\`: a builder `
      + `the record answers for is derived and not declared, and a guessed builder is what this key `
      + `exists to stop. ${RECOVER_THE_BUILDER(holders[0])}`);
  }
  const read = carriedByDefault(head);
  if (!read.carries) {
    fail(`claim --rebuilt writes a checkpoint on a change the default branch already carries, and `
      + `this checkout cannot prove it carries ${shortSha(head)}: ${read.why}. The reading is made `
      + `off refs already here, a claim being one of the writes that may not wait on a remote — and `
      + `where the change is genuinely unlanded what is owed is the capture and not this write. `
      + `${read.route ? "Settle the reading, then ask again" : "Ask from a checkout that can read that history"}:\n`
      + (read.route ? `  ${read.route}\n` : "")
      + `  ${REBUILT_FORM(ref, shortSha(head))}`);
  }
  return {
    state: LANDING_DONE,
    head,
    deployment,
    files: [],
    [HAND_WRITTEN]: {
      by: holder,
      at: new Date().toISOString(),
      why: `written after the landing, off ${read.ref} at ${shortSha(read.tip)} carrying `
        + `${shortSha(head)}; the deployment identity is the caller's and not this checkout's reading`,
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
  if (landing && landing.state !== LANDING_READY) {
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
