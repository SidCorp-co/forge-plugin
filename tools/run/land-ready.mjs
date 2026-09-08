/* The landing, one ready branch at a time, from the tree the fold works in: a checkpoint and a pushed
   branch in, a merge onto a pinned base that moved nothing of the change out. It repairs no conflict
   and re-judges nothing — both go back to the run that built it. docs/cli/the-checkpoint.md. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { git, gitOut, lines, loud, REMOTE, stop, Stop } from "../checkout.mjs";
import { INSTALLS, LANDS, PUSHES, runLanding, waitMs } from "./land.mjs";
import { follows, installs, LINKED, remoteHeadOf, shortly } from "./install.mjs";
import { above, forgetBump, versionAbove } from "./version.mjs";
import { versionAt } from "./landing.mjs";
import { Refusal, refusing } from "../../plugin/src/resolve/settings.mjs";
import { Refused } from "../../plugin/src/refusal.mjs";
import { sessionOf } from "../../plugin/src/resolve/config.mjs";
import { documentIdOf } from "../../plugin/src/tracker/issues.mjs";
import { commentPage } from "../../plugin/src/tracker/comments.mjs";
import { scoped } from "../../plugin/src/tracker/rpc.mjs";
import { pluginCopy } from "../../plugin/src/tools/plugin-copy.mjs";
import { advance, parkAs } from "../../plugin/src/flow/advance.mjs";
import { atLeast, viewFrom } from "../../plugin/src/flow/earned.mjs";
import { markMerged, markNote, markedCommit, namedFor } from "../../plugin/src/flow/record/merged.mjs";
import {
  LANDING_CANDIDATE, LANDING_DONE, LANDING_JUDGED, LANDING_QA_OWED, LANDING_READY,
  landingOf, landingSaved, landingVoided, takeLease,
} from "../../plugin/src/flow/lease.mjs";
import { INDEPENDENT, judgedAt } from "../../plugin/src/flow/qa/verdicts.mjs";
import { judgementOf, landingRoute, releasePolicy } from "../../plugin/src/tracker/project-config.mjs";
import { landingScope } from "../../plugin/src/resolve/settings.mjs";

/* The route this task branches on, off the project's record. docs/cli/the-checkpoint.md. */
const BEFORE_MERGE = "before-merge";
const AFTER_MERGE = "after-merge";
const DEVELOPED = "developed";
const TESTED = "tested";

/* Rebuilt twice with the base moving under each pin is a fold racing something else, and a third
   pass would spend another whole gate to say so. */
const TRIES = 2;

/* The steps by name rather than by number, because the resume table below points at them and a
   reordering that shifted an index would resume into the wrong step and say nothing. */
const ORDER = ["pin", "merge", "candidate", "gate", "version", "judge", "push", "install", "mark", "status"];

/* Where a second run picks up, per state, the step it starts at reading whether the write it guards
   already landed: `push` asks the remote for the intended sha, `install` asks the install record,
   `mark` asks the issue for its mark, `status` asks the status. `owedAt` reads the one state this
   table cannot answer alone; a state whose turn is not the lander's never reaches here. */
const OWED = {
  ready: "pin",
  candidate: "pin",
  reconciled: "pin",
  judged: "pin",
  promoting: "push",
  promoted: "install",
  installed: "mark",
  marked: "status",
};

/* `judged` sits either side of a promotion, told apart by the sha only `pushStep` writes and a void clears: the-checkpoint.md. */
const owedAt = (landing) =>
  (landing.state === LANDING_JUDGED && landing.intended ? "status" : OWED[landing.state] ?? "");

/* `fail` in the CLI's own modules exits, dropping the lock and leaving a branch promoted in silence. */
const asked = async (run) => {
  try {
    return await refusing(run);
  } catch (error) {
    if (error instanceof Refusal || error instanceof Refused) return stop(error.message);
    throw error;
  }
};

const remoteHead = (tree, base) => {
  const held = remoteHeadOf(tree, base);
  if (!held) {
    stop(`${REMOTE} named nothing for ${base}. A landing pins the base head before it builds `
      + `anything, and an unreachable remote and a branch that is gone read alike here.`);
  }
  return held;
};

/* Both sections of one answer: the tree the merge wrote, then the paths it could not merge, then a
   blank line and git's own prose about them. Split by hand rather than through `lines`, which drops
   the blank that separates the two — and with it the boundary between a path and a sentence. */
const mergedTree = (tree, pin, head) => {
  const run = spawnSync("git", ["merge-tree", "--write-tree", "--name-only", pin, head],
    { cwd: tree, encoding: "utf8" });
  if (run.error) stop(`git could not be run: ${run.error.message}.`);
  const said = String(run.stdout ?? "").split("\n");
  if (run.status === 0) return { tree: said[0], conflicts: [] };
  const at = said.indexOf("", 1);
  return { tree: said[0], conflicts: said.slice(1, at < 0 ? said.length : at).filter(Boolean) };
};

/* Fixed dates and a fixed message, so the same merge of the same two commits is the same commit
   whoever builds it: a reconciliation is recorded against a candidate's sha, and a candidate that
   changed sha between two runs would void the reading the builder just wrote. The encoding is fixed
   for the same reason — configured otherwise, git writes a header into the object and the sha moves. */
const candidateOf = (tree, treeSha, pin, head) => {
  const [when, name, mail] = (gitOut(["show", "--no-patch", "--format=%cI%n%cn%n%ce", head], tree) ?? "").split("\n");
  const run = spawnSync("git", ["-c", "i18n.commitEncoding=UTF-8",
    "commit-tree", treeSha, "-p", pin, "-p", head,
    "-m", `candidate: ${shortly(head)} onto ${shortly(pin)}`], {
    cwd: tree,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when,
      GIT_AUTHOR_NAME: name, GIT_COMMITTER_NAME: name,
      GIT_AUTHOR_EMAIL: mail, GIT_COMMITTER_EMAIL: mail,
    },
  });
  if (run.status !== 0) stop(`the candidate commit could not be made: ${run.stderr ?? "git said nothing"}`);
  return (run.stdout ?? "").trim();
};

const movedBy = (tree, judged, candidate, files) =>
  (files.length ? lines(gitOut(["diff", "--name-only", judged, candidate, "--", ...files], tree)) : []);

const roomFor = (root, candidate) => {
  const path = mkdtempSync(join(tmpdir(), "forge-landing-"));
  loud("git", ["worktree", "add", "--detach", path, candidate], root,
    "The candidate is gated in a tree of the landing's own, never in the one that built it.");
  for (const one of LINKED) {
    if (existsSync(join(root, one))) symlinkSync(join(root, one), join(path, one));
  }
  return path;
};

const dropRoom = (root, path) => {
  if (!path) return;
  spawnSync("git", ["worktree", "remove", "--force", path], { cwd: root, encoding: "utf8" });
  rmSync(path, { recursive: true, force: true });
};

/* Whether the release is on the branch, ancestry included: a landing that died before its `promoted`
   save may find the base past its own release, and the fetch is what makes that head readable at all.
   `known` is the third answer and the reason this is no boolean: a head pushed between the fetch and
   the read is a commit this repository does not hold, which `--is-ancestor` cannot tell from a head
   that does not carry the release — read as `false`, it would release the same change twice. */
const landedAlready = (tree, base, intended) => {
  loud("git", ["fetch", REMOTE, base], tree, "Check the remote is reachable.");
  const now = remoteHead(tree, base);
  if (!intended) return { now, landed: false, known: true };
  const readable = [now, intended].every((one) => gitOut(["rev-parse", "--verify", `${one}^{commit}`], tree));
  if (!readable) return { now, landed: false, known: false };
  const reaches = git(["merge-base", "--is-ancestor", intended, now], tree).status === 0;
  return { now, landed: now === intended || reaches, known: true };
};

const NOT_KNOWN = (key, base, now, intended) =>
  `${base} is at ${shortly(now)} and this checkout cannot read that commit or the release this `
  + `landing made at ${shortly(intended)}, even after fetching, so whether ${key} landed cannot be `
  + `read here. Nothing is voided and nothing is pushed on a reading this uncertain: fetch that `
  + `branch by hand, see what carries what, and run this landing again.`;

/* By sha from the checkout, never `HEAD` from the tree that built it: a second run resuming the push
   has no such tree, and the commit is in this repository's objects either way. */
const pushed = (tree, base, pin, what) => {
  const run = spawnSync("git", ["push", `--force-with-lease=refs/heads/${base}:${pin}`,
    REMOTE, `${what}:refs/heads/${base}`], { cwd: tree, encoding: "utf8", stdio: "inherit" });
  if (run.error) stop(`git could not be run: ${run.error.message}. Check the remote is reachable.`);
  return run.status === 0;
};

/* The whole record, policy and all, for the steps that need one rather than a field or the page. */
const viewOf = async (documentId) => {
  const [issue, page, release] = await Promise.all([
    scoped("forge_issues", { action: "get", documentId }), commentPage(documentId), releasePolicy(),
  ]);
  return viewFrom(documentId, issue, page.comments ?? [], null, release);
};

/* The verdicts a moved base or head takes away, named rather than described. Empty where the project
   asks for no independent judge: a builder's verdicts are the review at the landed head's business. */
const voidSaid = async (documentId, landing) => {
  if (!landing.deployment) return "";
  const view = await asked(() => viewOf(documentId));
  const numbers = judgedAt(landing, view.verdicts, view.release);
  return numbers.length
    ? ` The QA verdict(s) on criterion ${numbers.join(", ")} judged ${shortly(landing.deployment)} and `
      + `are void with it.`
    : "";
};

const statusOf = async (documentId) =>
  (await scoped("forge_issues", { action: "get", documentId, fields: ["status"] }))?.status ?? null;

const notReconciled = (key, landing, candidate, moved = []) =>
  `the checkpoint on ${key} reads \`${landing.state}\` and its reconciliation names `
  + `${shortly(landing.reconciled) || "no candidate"}, not the candidate this landing built at `
  + `${shortly(candidate)}${moved.length ? `, which moved ${moved.join(", ")}` : ""}. Nothing is `
  + `promoted against a reading of another candidate${moved.length
    ? `: the branch is the builder's again.\n    forge claim ${key} --take` : "."}`;

/* Every step reads where it is off the checkpoint rather than trusting what the step before it left
   in memory, because a second process resumes into four of them. `one` is that reading: the issue,
   the checkpoint as last written, and what this attempt has built so far. */
const pinStep = async (one) => {
  const { key, documentId, at, ctx: { base, root } } = one;
  const branch = at.landing.branch;
  if (!branch) stop(`the checkpoint on ${key} names no branch, so there is nothing to land.`);
  loud("git", ["fetch", REMOTE, branch, base], root, "Check the remote is reachable.");
  at.pin = remoteHead(root, base);
  if (!gitOut(["rev-parse", "--verify", `${at.landing.head}^{commit}`], root)) {
    stop(`${key} was judged at ${shortly(at.landing.head)}, a commit this checkout cannot read even after `
      + `fetching ${branch}. The build's own tree holds it — push that branch again.`);
  }
  console.log(`  ${base} is pinned at ${shortly(at.pin)}; ${branch} was judged at ${shortly(at.landing.head)}`);
  if (at.landing.state === LANDING_READY) {
    at.landing = await asked(() => landingSaved(documentId, key, { state: LANDING_CANDIDATE, pinned: at.pin }));
    return;
  }
  if (at.landing.pinned === at.pin) {
    console.log("  the pin this landing held is still the branch head");
    return;
  }
  /* A state the table offers before a promotion is reachable after one too, on the reading `owedAt` makes, so the release is asked about before anything is voided: rebuilt from a fresh pin, a checkpoint past its push would land the same change a second time. */
  const on = at.landing.intended ? landedAlready(root, base, at.landing.intended) : null;
  if (on && !on.known) stop(NOT_KNOWN(key, base, on.now, at.landing.intended));
  if (on?.landed) {
    stop(`${key} holds the release ${shortly(at.landing.intended)}, which ${base} carries at `
      + `${shortly(on.now)}: this checkpoint reads \`${at.landing.state}\` and is past its own push, so `
      + `there is no candidate to rebuild and nothing here to land again. What is left of it is the `
      + `reading of that release:\n    forge resume ${key}`);
  }
  const said = await voidSaid(documentId, at.landing);
  console.log(`  the pin this landing held was ${shortly(at.landing.pinned)} and ${base} is now `
    + `${shortly(at.pin)}, so the candidate and every reading taken at it are void.${said}`);
  at.landing = await asked(() => landingSaved(documentId, key, landingVoided(at.pin)));
};

const mergeStep = async (one) => {
  const { key, documentId, at, ctx: { base, root } } = one;
  /* Kept on the attempt: the candidate step reads the same merge rather than writing it twice. */
  at.merged = mergedTree(root, at.pin, at.landing.head);
  const { conflicts } = at.merged;
  if (!conflicts.length) {
    console.log(`  merges clean onto ${shortly(at.pin)}`);
    return;
  }
  const why = `${at.landing.branch} does not merge onto ${base} at ${shortly(at.pin)}: `
    + `${conflicts.join(", ")} conflict. The landing repairs no conflict — the run that built `
    + `the branch rebases it, re-reviews the rebased head and writes the checkpoint again.`;
  const view = await asked(() => viewOf(documentId));
  await asked(() => parkAs(view, key, "blocked", why, conflicts));
  stop(`${key} is parked as blocked and nothing of it was edited, pushed or installed.`);
};

/* The reconciliation the landing can make itself, and the one it cannot: a merge that left the
   change's own paths alone is reconciled here, and one that moved any of them is the builder's. */
const candidateStep = async (one) => {
  const { key, documentId, at, ctx: { root } } = one;
  const merged = at.merged ?? mergedTree(root, at.pin, at.landing.head);
  at.candidate = candidateOf(root, merged.tree, at.pin, at.landing.head);
  const moved = movedBy(root, at.landing.head, at.candidate, at.landing.files);
  console.log(`  candidate ${shortly(at.candidate)} over ${at.landing.files.length} file(s) of the change`);
  if (moved.length) {
    if (at.landing.reconciled === at.candidate) {
      console.log(`  the landing moved ${moved.join(", ")}, reconciled at ${shortly(at.candidate)}`);
      return;
    }
    /* Past `candidate` already, and reconciled against something else: the handoff has happened
       once and what came back does not answer for this candidate, so nothing here writes over it. */
    if (at.landing.state !== LANDING_CANDIDATE) stop(notReconciled(key, at.landing, at.candidate, moved));
    at.landing = await asked(() => landingSaved(documentId, key,
      { state: "builder-owed", candidate: at.candidate, moved: moved.join(", ") }));
    stop(`the landing moved ${moved.join(", ")}, so this change's own paths are not what was judged `
      + `and the branch goes back to the run that built it. Nothing of ${key} is pushed, deployed or `
      + `installed until the checkpoint reads \`reconciled\` at ${shortly(at.candidate)}:\n`
      + `    forge claim ${key} --take`);
  }
  console.log("  landing moved nothing of the change");
  if (at.landing.state === LANDING_CANDIDATE) {
    at.landing = await asked(() => landingSaved(documentId, key,
      { state: "reconciled", candidate: at.candidate, reconciled: at.candidate }));
  }
  if (at.landing.reconciled !== at.candidate) stop(notReconciled(key, at.landing, at.candidate));
};

/* A commit on both routes, and the one a verdict cites: `judgeProblem` reads it again at `tested`. */
const OWED_TO_QA = (key, landing, what) =>
  `the checkpoint on ${key} reads \`${LANDING_QA_OWED}\`: ${what} at ${shortly(landing.deployment)} is `
  + `what an independent judge is owed, and nothing of ${key} moves until the turn comes back.\n`
  + `    forge claim ${key} --take\n`
  + `    ... the verdicts, then: forge claim ${key} --judged`;

/* Held back rather than refused: the candidate the steps above built, gated and versioned is the
   commit that would land, and what waits on the judgement is only the push. */
const judgeStep = async (one) => {
  const { key, documentId, at, ctx: { route, judgement } } = one;
  if (judgement !== INDEPENDENT || route !== BEFORE_MERGE) {
    return console.log(`  no judge's turn sits here: this project lands ${route} and its judgement `
      + `between developed and tested is ${judgement}`);
  }
  if (at.landing.state === LANDING_JUDGED) {
    if (at.landing.deployment === at.candidate) {
      return console.log(`  judged at ${shortly(at.candidate)}, the candidate this landing built`);
    }
    const said = await voidSaid(documentId, at.landing);
    const held = at.landing;
    at.landing = await asked(() => landingSaved(documentId, key, landingVoided(at.pin)));
    at.rebuild = true;
    return stop(`the turn came back judged at ${shortly(held.deployment)} and this landing built `
      + `${shortly(at.candidate)}, so what was judged is not what would be promoted.${said} The `
      + `candidate is rebuilt and the judgement asked for again.`);
  }
  at.landing = await asked(() => landingSaved(documentId, key,
    { state: LANDING_QA_OWED, deployment: at.candidate }));
  return stop(OWED_TO_QA(key, at.landing, "the candidate"));
};

const pushStep = async (one) => {
  const { key, documentId, at, ctx: { base, root } } = one;
  if (at.landing.state !== "promoting") {
    at.landing = await asked(() => landingSaved(documentId, key,
      { state: "promoting", intended: at.intended, release: at.release }));
  }
  /* Asked of the remote, never of the tracking ref: a resume aimed at this step fetched nothing,
     and the ref it would read can name a head another landing pushed past. */
  const pin = at.pin ?? at.landing.pinned;
  const rebuilt = async (now, why) => {
    at.landing = await asked(() => landingSaved(documentId, key, landingVoided(now)));
    at.rebuild = true;
    stop(why);
  };
  const first = landedAlready(root, base, at.landing.intended);
  if (!first.known) stop(NOT_KNOWN(key, base, first.now, at.landing.intended));
  if (first.landed) {
    console.log(`  ${base} is at ${shortly(first.now)} and carries ${shortly(at.landing.intended)}: this `
      + `release landed and the save after it did not`);
  } else if (first.now !== pin) {
    await rebuilt(first.now, `${base} is at ${shortly(first.now)} and this landing pinned ${shortly(pin)}: `
      + `another landing pushed while this one built. The candidate is rebuilt from the new head, and `
      + `the review and QA readings taken at the old one are void.`);
  } else if (!pushed(root, base, pin, at.landing.intended)) {
    /* Asked again rather than assumed: a push the remote took and the client did not hear about
       reads as a rejection here, and voiding then would release the same change twice. */
    const again = landedAlready(root, base, at.landing.intended);
    if (!again.known) stop(NOT_KNOWN(key, base, again.now, at.landing.intended));
    if (!again.landed) {
      await rebuilt(again.now, `the push was rejected against the pin ${shortly(pin)}, so ${base} moved `
        + `between the read a moment ago and the push itself. The candidate is rebuilt from the new head.`);
    }
    console.log(`  the push reported a failure and ${base} carries ${shortly(at.landing.intended)} anyway, `
      + `so it landed and nothing is pushed again`);
  }
  if (at.room) forgetBump(at.room);
  at.landing = await asked(() => landingSaved(documentId, key, { state: "promoted" }));
  console.log(`  ${base} is at ${shortly(at.landing.intended)}, release ${at.landing.release}`);
};

const installStep = async (one) => {
  const { key, documentId, at, ctx: { base, root, self, market, plugin } } = one;
  const on = landedAlready(root, base, at.landing.intended);
  if (!on.known) stop(NOT_KNOWN(key, base, on.now, at.landing.intended));
  if (!on.landed) {
    stop(`${key} is past its push and ${base} is at ${shortly(on.now)}, which does not carry `
      + `${shortly(at.landing.intended)}. This release is not on the branch, so nothing of it is `
      + `installed: read what moved that branch before anything here runs again.`);
  }
  /* The branch is past this release, so installing this tree would put a copy in the cache below the
     branch — the one thing an install may not do. That is a reason to skip it and no reason to call
     it done: the record is what says a copy carrying this release is installed, and the branch's own
     ancestry says nothing about it. A plain `land` moves that branch and installs nothing. */
  if (on.now !== at.landing.intended) {
    const copy = pluginCopy(join(root, "plugin"));
    if (!copy?.installed || above(at.landing.release, copy.installed)) {
      stop(`${base} is at ${shortly(on.now)}, past this release at ${shortly(at.landing.intended)}, and `
        + `the newest install record holds ${copy?.installed ?? "nothing for this plugin"} — below `
        + `the ${at.landing.release} this landing made. Installing this tree would put an older copy in `
        + `the cache and saying it is installed would certify a copy nobody has. Install the branch `
        + `head, then run this landing again for the mark and the statuses it still owes.`);
    }
    console.log(`  ${base} is at ${shortly(on.now)}, past this release at ${shortly(at.landing.intended)}, `
      + `and ${copy.name} ${copy.installed} is installed over it: the install is not owed and what is `
      + `left of this landing is`);
  } else {
    at.room ??= roomFor(root, at.landing.intended);
    follows(root, base, at.room);
    const copy = pluginCopy(join(at.room, "plugin"));
    if (copy && copy.installed === at.landing.release && !copy.stale) {
      console.log(`  ${copy.name} ${copy.installed} is installed already, so this install is owed nothing`);
    } else {
      /* One cache is what every release on this machine installs into, and this span moves the marketplace registration through the candidate's own worktree, so where it is entered and not left the branch after this one is not landed: the refusal says what to put back, and a landing that shipped over it would bury the reading of it. */
      at.installing = true;
      installs({ tree: at.room, root, base, market, plugin, self });
      at.installing = false;
    }
  }
  at.landing = await asked(() => landingSaved(documentId, key, { state: "installed" }));
};

const markStep = async (one) => {
  const { key, documentId, at, ctx: { base } } = one;
  const { comments } = await asked(() => commentPage(documentId));
  const landed = at.landing.intended;
  if (markedCommit(comments ?? []) === landed) {
    console.log(`  the mark at ${shortly(landed)} is up already`);
  } else {
    const judged = at.landing.moved ? at.landing.candidate : at.landing.head;
    const named = await asked(() => namedFor(documentId, comments ?? []));
    /* Through `asked` because the composer refuses: a note it cannot fit under the tracker's cap is a correction this issue owes, and the run reads it as this step's own stop with the resume line under it rather than as an exception thrown past a landing that has already pushed. */
    const note = await asked(() => markNote({
      branch: base,
      at: landed,
      reviewed: judged,
      judged,
      moved: at.landing.moved ? at.landing.moved.split(", ") : [],
      wrote: at.landing.files,
      named,
      ref: key,
    }));
    await asked(() => markMerged(documentId, key, note));
    console.log(`  ${key} is marked merged at ${shortly(landed)}`);
  }
  at.landing = await asked(() => landingSaved(documentId, key, { state: "marked" }));
};

/* Driven through `advance`, so the flow table and the entry criteria stay where they live: a move
   the records have not earned is said and moves nothing, which is what this task owes it. */
/* Whether the status is there, never whether the move was tried: an advance refused says so and
   moves nothing, and `done` written over that would certify a status nothing earned. */
const moveTo = async (key, to, documentId) => {
  const status = await asked(() => statusOf(documentId));
  if (atLeast(status, to)) {
    console.log(`  ${key} is ${status} already`);
    return true;
  }
  try {
    await refusing(() => advance([key, "--to", to]));
  } catch (error) {
    if (!(error instanceof Refusal || error instanceof Refused)) throw error;
    console.error(`  ${key} stays ${status}: ${error.message}`);
    return false;
  }
  return atLeast(await asked(() => statusOf(documentId)), to);
};

const statusStep = async (one) => {
  const { key, documentId, at, ctx: { route, judgement } } = one;
  await moveTo(key, DEVELOPED, documentId);
  /* The other place the route puts that turn; the release is what says what is running. */
  if (judgement === INDEPENDENT && route !== BEFORE_MERGE && at.landing.state !== LANDING_JUDGED) {
    at.landing = await asked(() => landingSaved(documentId, key,
      { state: LANDING_QA_OWED, deployment: at.landing.intended }));
    return stop(OWED_TO_QA(key, at.landing, "the release"));
  }
  /* `done` is refused to every turn, so it waits on the status: closed over a record that did not
     earn `tested`, the issue would be reachable by no route at all. */
  if (!await moveTo(key, TESTED, documentId)) {
    return console.log(`  the checkpoint stays \`${at.landing.state}\`: what \`${TESTED}\` is owed is `
      + `above, and the landing is run again once the record carries it`);
  }
  at.landing = await asked(() => landingSaved(documentId, key, { state: LANDING_DONE }));
  return console.log(`  the checkpoint reads \`${LANDING_DONE}\`: no turn of this landing is left`);
};

/* The table the resume points into, one row per name in ORDER. */
const landingSteps = (one) => {
  const { base, market, plugin } = one.ctx;
  return [
    [`pin ${REMOTE}/${base} and the branch head`, () => pinStep(one), LANDS],
    [`merge ${one.at.landing.branch} onto the pin`, () => mergeStep(one)],
    ["the candidate, and what the landing moved", () => candidateStep(one)],
    ["the gate over the candidate", () => {
      one.at.room = roomFor(one.ctx.root, one.at.candidate);
      loud("npm", ["run", "check"], one.at.room, "The candidate is the merge, so a failure here is "
        + "the branch against what landed since. It goes back to the run that built it, rebased.");
    }],
    ["a version above the pin", () => {
      versionAbove(one.at.room, base, null, one.at.pin);
      one.at.release = versionAt(one.at.room, "HEAD");
      one.at.intended = gitOut(["rev-parse", "HEAD"], one.at.room);
    }],
    ["the judge's turn, where the project judges before the merge", () => judgeStep(one)],
    [`push to ${REMOTE}/${base}, the pin its expected old value`, () => pushStep(one), PUSHES],
    [`install ${plugin}@${market} from the tree that shipped`, () => installStep(one), INSTALLS],
    ["the merged mark", () => markStep(one)],
    ["the statuses the record earns", () => statusStep(one)],
  ];
};

/* The reads and the take, before any step and outside the lock: every refusal here is one branch's own, nothing of the machine or the tree having moved yet, which is what lets the run go on to the key after it. From the first step onwards a refusal may be the whole run's. */
const taken = async (key) => {
  const documentId = await asked(() => documentIdOf(key));
  const issue = await asked(() => scoped("forge_issues",
    { action: "get", documentId, fields: ["sessionContext", "status"] }));
  const context = issue?.sessionContext ?? null;
  const landing = landingOf(context);
  if (!landing) {
    stop(`${key} carries no landing checkpoint, so there is no ready branch to land. A build writes `
      + `one where it ends:\n    forge claim ${key} --pushed --ready`);
  }
  /* Before the take, not after it: a take is a write, and a state this task cannot carry is one it
     has no business holding the lease for — least of all `builder-owed`, whose turn is a run this
     task is not and whose live lease the take may replace. */
  const from = ORDER.indexOf(owedAt(landing));
  if (from < 0) {
    stop(`the landing checkpoint on ${key} reads \`${landing.state}\`, which is not a step this task `
      + `owes: read where it is, and land it when the state names the lander's turn.\n`
      + `    forge resume ${key}`);
  }
  await asked(() => takeLease(documentId, key, context, {
    holder: sessionOf(),
    line: `landing ${landing.branch}`,
    status: issue?.status ?? null,
  }));
  return { documentId, landing, from };
};

/* One branch, and the rebuild a moved base earns it. The lock is the ship's, taken at the pin and
   dropped after the install, so a `ship` or a `land` on this checkout waits for the whole span. */
const landOne = async (key, ctx, { documentId, landing, from }) => {
  let held = landing;
  for (let attempt = 1; attempt <= TRIES; attempt += 1) {
    const at = { landing: held, pin: null, room: null };
    const steps = landingSteps({ key, documentId, at, ctx });
    const order = [...steps.keys()].filter((one) => one >= (attempt > 1 ? 0 : from));
    try {
      const whole = await runLanding(steps, order, ctx.root, {
        ms: ctx.ms,
        held: (one) => Boolean(steps[one][2]),
        again: () => `The checkpoint says where this landing is, so no step number is owed: `
          + `${ctx.self} land-ready ${key}`,
      });
      if (whole) return console.log(`\n${key} landed as ${at.landing.release}.`);
      if (at.installing) {
        stop(`the install of ${key} was entered and not finished, so what the plugin cache and the `
          + `marketplace registration hold is what that refusal says. Read it and put back what it `
          + `names before any other branch lands: this run stops here rather than shipping over it.`);
      }
      if (!at.rebuild) return;
      held = at.landing;
    } finally {
      dropRoom(ctx.root, at.room);
    }
  }
  stop(`${key} was rebuilt ${TRIES} times and ${ctx.base} moved under each pin. Something else is `
    + `landing on this branch — land it again once that has stopped: ${ctx.self} land-ready ${key}`);
};

/** The verb: one finite task, the branches in the order they were named. A parked or handed-back
 *  branch is not the end of the run, because the branch after it is somebody else's release. */
export const landReady = async ({ flags, words }, ctx) => {
  if (!words.length) {
    stop(`land-ready takes the issues whose branches are ready, in the order they land:\n`
      + `    ${ctx.self} land-ready ISS-45`);
  }
  const tree = process.cwd();
  if (resolve(tree) !== resolve(ctx.root)) {
    stop(`land-ready is the checkout's verb and this is ${tree}, a worktree of ${ctx.root}. It builds `
      + `each candidate in a tree of its own and touches no run's: land from ${ctx.root}.`);
  }
  const ms = waitMs(flags);
  /* Read once and carried: a project answering neither line is said, never defaulted. A null is not refused — it is both a failed read and a project holding no config, and the second must still land, so a failed read downgrades an independent judge to the builder (ISS-699 owns that conflation). */
  const policy = await asked(() => releasePolicy());
  const route = landingRoute(policy, landingScope()).value;
  const judgement = judgementOf(policy);
  if (judgement === INDEPENDENT && route !== BEFORE_MERGE && route !== AFTER_MERGE) {
    stop(`this project asks for an independent judge between developed and tested and says nothing `
      + `about where the merge sits, so nothing here knows whether the judgement comes before the `
      + `push or after it. Set the branches on the project's record, or the \`landing\` key in `
      + `.forge.json, and land again: forge doctor`);
  }
  console.log(`\nlanding ${route}, judgement ${judgement}`);
  for (const key of words) {
    console.log(`\n=== ${key}`);
    let start = null;
    try {
      start = await taken(key);
    } catch (error) {
      if (!(error instanceof Stop)) throw error;
      console.error(`${key} is not this landing's to take and nothing of it has moved: ${error.message}`);
      process.exitCode = 1;
      continue;
    }
    await landOne(key, { ...ctx, ms, route, judgement }, start);
  }
};
