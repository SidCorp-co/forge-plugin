/* `claim --landed`, apart from `claim.mjs` because out of `head-owed` it reads a head of its own
   and asks the records the capture out of that state asks. docs/cli/the-checkpoint.md. */
import { spawnSync } from "node:child_process";

import { fail } from "../../resolve/settings.mjs";
import { asksIndependent, landsOn, releasePolicy } from "../../tracker/project-config.mjs";
import { commentPage } from "../../tracker/comments.mjs";
import { sameCommit, shortSha } from "../../tracker/evidence.mjs";
import { commitCarries } from "../../git/carries.mjs";
import { viewFrom } from "../earned.mjs";
import { carriedByLanding } from "../worklog.mjs";
import { landingSaved } from "../lease.mjs";
import {
  LANDING_DONE, LANDING_HEAD_OWED, LANDING_READY, MERGE_RECORD, RECAPTURE, landingLine, landingOf,
} from "./checkpoint.mjs";
import { SECOND_LANDING, recaptureRefusal } from "./written.mjs";
import { REBUILT_FORM } from "./reconstruction.mjs";
import { commandAt } from "../machine.mjs";
import { landsAgain } from "../route.mjs";
import { judgedHead, markedCommit, reviewedHead, undoForm } from "../record/merged.mjs";
import { gitMarkForm } from "../record/judged/merged-clauses.mjs";

/* The same overlay switches the ancestry reading is made under, so the tip it asks about and the
   ancestry it proves are read off one history (8faf61 F1). */
const PROVEN = { GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_GRAFT_FILE: "/dev/null" };

const git = (args) => {
  const run = spawnSync("git", args, { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, ...PROVEN } });
  return run.status === 0 ? (run.stdout ?? "").trim() : null;
};

/* Read as `tipOf` in worklog.mjs reads the landing branch, and for its reason. */
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

/* Out of each state this write does not end (ISS-2526): none at all is a landing nobody captured,
   recorded by the late write (ISS-2608); `done` gives way to a second landing; the rest are under way. */
const outOf = (ref, landing) => {
  if (!landing) {
    return `. There is no checkpoint to end: where the change is already on the branch it lands on, the `
      + `record of that landing is written after it:\n  ${commandAt(REBUILT_FORM(ref, "<the sha the branch carries>"), "  ")}\n`
      + `Otherwise read where the issue is:\n  forge resume ${ref}`;
  }
  if (landing.state === LANDING_DONE) {
    return `. That landing has ended. ${SECOND_LANDING(ref, `\n  forge claim ${ref} --landed`)}`;
  }
  return `, every later one being a landing under way whose remaining steps are its own. Read where `
    + `the landing is:\n  forge resume ${ref}`;
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
  /* The landing that ended is not the one a rebuilt issue lands, and the second one has no
     checkpoint to end until its own capture writes it (ISS-2073). */
  if (landing?.state === LANDING_DONE && landsAgain(issue.status)) {
    fail(`claim --landed ends a landing the default branch already carries, and the landing `
      + `checkpoint on ${ref} reads \`${LANDING_DONE}\`: that landing has ended, and ${ref} stands at `
      + `\`${issue.status}\`, being built again. The second landing begins with its own capture, `
      + `which this write then ends once the branch it lands on carries that head:\n`
      + `  forge claim ${ref} --pushed --ready\n  forge claim ${ref} --landed`);
  }
  if (landing?.state !== LANDING_READY && landing?.state !== LANDING_HEAD_OWED) {
    const said = `claim --landed ends a landing the default branch already carries, and the landing `
      + `checkpoint on ${ref} reads \`${landing?.state ?? "nothing at all"}\`: it is ended from `
      + `\`${LANDING_READY}\` and \`${LANDING_HEAD_OWED}\` and from no other state`;
    fail(`${said}${outOf(ref, landing)}`);
  }
  const owed = landing.state === LANDING_HEAD_OWED;
  const policy = await releasePolicy();
  const lands = landsOn(policy);
  const head = owed ? answeredHead(ref, landing) : landing.head;
  const page = once(() => commentPage(documentId));
  const read = carriedByLanding(head, lands);
  const marked = read.carries ? null : await markProof(ref, issue, head, { read, lands, page });
  if (!read.carries && !marked) fail(unlanded(ref, landing, head, read));
  if (owed) {
    const view = viewFrom(documentId, issue, (await page()).comments ?? []);
    const refused = recaptureRefusal(ref, head, view, asksIndependent(policy), LANDED_SAID(ref, head));
    if (refused) fail(refused);
  }
  const patch = { state: LANDING_DONE, head, ...(marked ? { [MERGE_RECORD]: marked.commit } : {}) };
  const saved = await landingSaved(documentId, ref, patch, { was: landing });
  console.log(`${ref}  landed: ${landingLine(saved)}`);
  if (marked) return console.log(markedSaid(ref, head, marked));
  return console.log(`${read.ref}, which is ${read.from}, stands at ${shortSha(read.tip)} and carries `
    + `${shortSha(head)}, so this change is on the branch it lands on already and no release `
    + `is owed to put it there. No turn of this landing is left for anybody to take.`);
};

const once = (take) => {
  let held = null;
  return () => (held ??= take());
};

/* The route out of a mark that does not prove this landing: down, then up at the commit that landed. */
const REMARK = (ref, where = "Where this capture's work did land") => `${where}, take the mark down `
  + `and mark the commit that landed it:\n  ${undoForm(ref)}\n  ${gitMarkForm(ref)}\n  forge claim ${ref} --landed`;

/* The second proof, read only where git proved the branch does not reach the head: a squash or a
   rebase merge puts the work on the branch as a commit of its own, so the head is never reached and
   the merged mark is what names the landing (ISS-3146). The mark is tied to this checkpoint by the
   head its note says was reviewed or judged, a mark of an earlier landing naming that one's own. */
const markProof = async (ref, issue, head, { read, lands, page }) => {
  const commit = issue.mergedCommitSha ? String(issue.mergedCommitSha) : null;
  if (!commit || !read.tip || commitCarries(head, read.tip).carries !== false) return null;
  const reached = carriedByLanding(commit, lands);
  const lead = `claim --landed writes \`${LANDING_DONE}\` on a change the branch it lands on carries, `
    + `and ${read.ref} does not reach ${shortSha(head)}, the head this checkpoint names. ${ref}'s merged `
    + `mark names ${shortSha(commit)}, the commit it landed at`;
  if (!reached.carries) {
    fail(`${lead}, and that proves nothing either: ${reached.why}. Where it is genuinely unlanded, what `
      + `is owed is the landing and not this write. ${settle(reached)}  forge claim ${ref} --landed\n`
      + `${REMARK(ref, "Where the mark names the wrong commit")}`);
  }
  const comments = (await page()).comments ?? [];
  const at = markedCommit(comments);
  if (!sameCommit(at, commit)) {
    fail(`${lead}, and the standing mark's note names ${at ? shortSha(at) : "no commit"} at its \`at\` `
      + `clause, so which commit landed is not one answer and neither proves this landing. ${REMARK(ref)}`);
  }
  const heads = [...new Set([reviewedHead(comments), judgedHead(comments)].filter(Boolean).map(shortSha))];
  if (!heads.some((one) => sameCommit(one, head))) {
    fail(`${lead}, and its note names ${heads.join(" and ") || "no head"} as what was reviewed and `
      + `judged, not ${shortSha(head)}: it is the mark of another landing of ${ref}, and `
      + `proves nothing about this one. Where this capture is genuinely unlanded, what is owed is the `
      + `landing and not this write. ${REMARK(ref)}`);
  }
  return { commit, read: reached };
};

const markedSaid = (ref, head, { commit, read }) => `${read.ref}, which is ${read.from}, stands at `
  + `${shortSha(read.tip)} and does not reach ${shortSha(head)}, the head this checkpoint names, which `
  + `is what a squash or a rebase merge leaves. It carries ${shortSha(commit)}, the commit ${ref}'s `
  + `merged mark names as landing that head, so the merge record proved this landing and the branch reaching `
  + `the head did not; the checkpoint says so. No turn of this landing is left for anybody to take.`;
