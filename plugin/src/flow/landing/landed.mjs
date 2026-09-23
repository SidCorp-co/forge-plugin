/* The landing ended on the one thing that settles it: the branch a change lands on already carries
   the head. Apart from `claim.mjs` because it is two readings of that one fact, one per state it is
   taken from, and the second of them is a record check the capture out of `head-owed` owns too.
   docs/cli/the-checkpoint.md. */
import { spawnSync } from "node:child_process";

import { fail } from "../../resolve/settings.mjs";
import { judgementOf, landsOn, releasePolicy } from "../../tracker/project-config.mjs";
import { commentPage } from "../../tracker/comments.mjs";
import { shortSha } from "../../tracker/evidence.mjs";
import { INDEPENDENT } from "../qa/verdicts.mjs";
import { viewFrom } from "../earned.mjs";
import { carriedByLanding } from "../worklog.mjs";
import { landingSaved } from "../lease.mjs";
import { LANDING_DONE, LANDING_HEAD_OWED, LANDING_READY, RECAPTURE, landingLine, landingOf } from "./checkpoint.mjs";
import { recaptureRefusal } from "./written.mjs";

/* The same overlay switches the ancestry reading is made under, so the tip it asks about and the
   ancestry it proves are read off one history (8faf61 F1). */
const PROVEN = { GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_GRAFT_FILE: "/dev/null" };

const git = (args) => {
  const run = spawnSync("git", args, { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, ...PROVEN } });
  return run.status === 0 ? (run.stdout ?? "").trim() : null;
};

/* That exact ref or nothing: `rev-parse` would resolve the name through a local branch of the same
   spelling, and what rests on this answer ends a landing. */
const branchTip = (branch) => {
  const hash = git(["show-ref", "--verify", "--hash", `refs/remotes/origin/${branch}`]);
  return hash ? git(["rev-parse", "--verify", `${hash}^{commit}`]) : null;
};

/* At `head-owed` the checkpoint's own head is the one the landing refused, so the head that landed
   is whatever the builder pushed in answer: the branch's tip as this checkout last fetched it. */
const answeredHead = (ref, landing) => {
  const tip = landing.branch ? branchTip(landing.branch) : null;
  if (tip) return tip;
  return fail(`claim --landed out of \`${LANDING_HEAD_OWED}\` ends the landing at the head the builder `
    + `pushed in answer, the tip of ${landing.branch || "the checkpoint's branch"}, and this checkout `
    + `holds no ref of origin/${landing.branch || "<branch>"} to read it off. Fetch it, then ask again:\n`
    + `  git fetch origin ${landing.branch || "<branch>"}\n  forge claim ${ref} --landed`);
};

const settle = (read) => `${read.route
  ? "Settle the reading, then ask again"
  : "Ask from a checkout that can read that history"}:\n${read.route ? `  ${read.route}\n` : ""}`;

const unlanded = (ref, landing, head, read) => {
  const lead = `claim --landed writes \`${LANDING_DONE}\` on the branch a change lands on already carrying `
    + `${shortSha(head)}, `;
  const reading = `and this checkout cannot prove it does: ${read.why}.`
    + `${read.from ? ` That branch is ${read.from}.` : ""} The reading is made off refs already here, a `
    + "claim being one of the writes that may not wait on a remote — ";
  if (landing.state === LANDING_HEAD_OWED) {
    return `${lead}the tip of ${landing.branch} the builder pushed out of \`${LANDING_HEAD_OWED}\`, ${reading}`
      + `and where that head is genuinely unlanded it is the landing's to take, off the capture. `
      + `${settle(read)}  forge claim ${ref} --landed\nOr capture it for the landing:\n${RECAPTURE(ref)}`;
  }
  return `${lead}the head ${landing.branch || "this checkpoint"} was written at, ${reading}and where that `
    + `branch is genuinely unlanded what is owed is the landing and not this write. `
    + `${settle(read)}  forge claim ${ref} --landed`;
};

const LANDED_SAID = (ref, head) => ({
  out: `claim --landed out of \`${LANDING_HEAD_OWED}\` ends the landing at ${shortSha(head)}`,
  why: "what ends a landing with nothing left to merge is a head the records judged, and no other",
  again: `forge claim ${ref} --landed`,
});

/* The fourth route out, and the one that ends a landing rather than handing a turn back: the state a
   release leaves where the workspace that made it is gone before anybody reads the checkpoint, and
   the state a landing handed back where the builder's answer reached the branch by another route.
   Git's reading licenses the write and not the caller's word, so none of the independence the three
   hand-backs ask is asked here, and the lease `landingSaved` checks holds a second run off. Out of
   `head-owed` the records are read too, being what the capture out of it would have asked. */
export const finishLanded = async (documentId, ref, issue, context) => {
  const landing = landingOf(context);
  if (landing?.state !== LANDING_READY && landing?.state !== LANDING_HEAD_OWED) {
    fail(`claim --landed ends a landing the default branch already carries, and the landing `
      + `checkpoint on ${ref} reads \`${landing?.state ?? "nothing at all"}\`: it is ended from `
      + `\`${LANDING_READY}\` and \`${LANDING_HEAD_OWED}\` and from no other state, every later one `
      + `being a landing under way whose remaining steps are its own. Read where the landing is:\n`
      + `  forge resume ${ref}`);
  }
  const owed = landing.state === LANDING_HEAD_OWED;
  const policy = await releasePolicy();
  const head = owed ? answeredHead(ref, landing) : landing.head;
  const read = carriedByLanding(head, landsOn(policy));
  if (!read.carries) fail(unlanded(ref, landing, head, read));
  if (owed) {
    const view = viewFrom(documentId, issue, (await commentPage(documentId)).comments ?? []);
    const refused = recaptureRefusal(ref, head, view, judgementOf(policy) === INDEPENDENT, LANDED_SAID(ref, head));
    if (refused) fail(refused);
  }
  const saved = await landingSaved(documentId, ref, { state: LANDING_DONE, head }, { was: landing });
  console.log(`${ref}  landed: ${landingLine(saved)}`);
  return console.log(`${read.ref}, which is ${read.from}, stands at ${shortSha(read.tip)} and carries `
    + `${shortSha(head)}, so this change is on the branch it lands on already and no release `
    + `is owed to put it there. No turn of this landing is left for anybody to take.`);
};
