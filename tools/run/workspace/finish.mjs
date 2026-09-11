/* The counterpart `start` never had. Every run of a wave ended its own workspace by hand and each one
   decided for itself what counted as its own, which is how 137 scratch directories, nine orphaned gate
   roots and a verdict record for a tree nobody has outlived their runs (ISS-1106). What is removable
   here is what `start` created under the name `start` chose — one path per run, derived and never
   matched — and the four readings below are taken whole before the first removal, so a branch that
   turns out undeletable cannot cost a tree that was already gone. */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

import { copyToRun } from "../../../plugin/src/tools/plugin-copy.mjs";
import { checkoutRoot, defaultBranch, git, gitOut, lines, loud, REMOTE, remoteRef } from "../../checkout.mjs";
import { gatesHere, verdictPath } from "../../gate-verdict.mjs";
import { runnersOf } from "../../gates/machine.mjs";
import { KEY, whoseTree, worktreePath } from "./occupant.mjs";
import { scratchAt } from "./run-id.mjs";

const REFUSED = 1;

/* Beside the verb and spread into the one usage, as the replay's and the review's are: what a caller
   has to know about this is why each refusal is a refusal, and that lives with the code that refuses. */
export const FINISH_HELP = [
  "finish removes what start created under the name start chose, and that is the whole of what makes",
  "it safe: the scratch directory carries the id minted into that worktree's git directory and start",
  "records the path it made, so it is one path one run owns rather than a glob over a directory two",
  "runs share. Age is not ownership and neither is a prefix somebody typed — a run whose gate is",
  "still writing has a young tree and a run that waited an hour has an old one, and a record naming",
  "anything but the minted name derives no path at all. Recovering a leak somebody else left is an",
  "operator's act and no part of this.",
  "",
  "It refuses rather than forces, on five readings taken whole before the first removal, so nothing",
  "met at a removal can cost a tree already gone: an uncommitted path in the tree, a commit the",
  "remote's default branch does not carry, a gate of that tree still on the process table, a worktree",
  "somebody has locked, and a directory at the derived path that is not this checkout's worktree. Each",
  "leaves the whole workspace standing, the scratch with it, and exits non-zero, because what a",
  "removal would take is what no record of it cites. The second is the reading nothing else here",
  "makes: `git worktree remove` refuses a dirty tree and a locked one by itself, and says nothing at",
  "all about a commit that exists in one place. `-d` and never `-D` is the same rule for the branch,",
  "with git's own advice for the forced delete turned off, that being the one way out a refusal here",
  "may not carry.",
  "",
  "What it left running it reports and never ends. A gate of that tree is named with its pid and with",
  "the one call that reads what that gate decided, which is this repository's only way to ask; no",
  "process is stopped here, by name or otherwise. The stack it confirms is the plugin copy a session",
  "outside this checkout would load, invoked at its own entry rather than read off a record, and a",
  "copy that does not answer is said and changes no exit code: a cleanup that failed because",
  "something else is down has stopped the wrong thing.",
  "",
  "Run from inside the tree it would remove, it takes that run's scratch, leaves the tree and prints",
  "the call that ends it from the checkout — a verb that deletes the directory its caller stands in",
  "strands that caller with nothing left to write its own last records from. That is a report and not",
  "a refusal, and the exit code stays 0. So is a second call, which finds nothing to do and says so,",
  "which is also what a run that died before its last phase leaves for whoever ends it.",
];

/* Each by the copy that sits in the tree it is about: the gate judges the tree its own runner is in,
   and a landing is the run's own from its own worktree, so a route naming this tree's copy would send
   the caller to the wrong one. */
const runnerIn = (tree, script) => `node ${join(tree, "tools", script)}`;

/* `status --porcelain` and not a diff against HEAD: an untracked file a run never staged is work
   too. Read through `git` rather than `gitOut`, which trims the first status column away. */
const uncommitted = (path) => {
  const run = git(["status", "--porcelain"], path);
  if (run.status !== 0) return null;
  return (run.stdout ?? "").split("\n").filter(Boolean).map((one) => one.slice(3));
};

/* Against the remote-tracking ref and never the remote: a ref this checkout has not fetched can only
   name fewer commits than the remote holds, so a stale one refuses and never lets a commit die. This
   is the reading nothing else here makes — `git worktree remove` refuses a dirty tree by itself, and
   says nothing about a commit that exists in one place. */
const ahead = (path, base) => {
  // Spelled out by `remoteRef`, a false empty range here being a commit that dies with its tree.
  const ref = remoteRef(base);
  const said = `${REMOTE}/${base}`;
  if (!gitOut(["rev-parse", "--verify", "--quiet", ref], path)) return { unknown: `${said} resolves to nothing in that tree` };
  const held = gitOut(["log", "--oneline", `${ref}..HEAD`], path);
  return held === null ? { unknown: `git would not list ${said}..HEAD there` } : { commits: lines(held) };
};

/* Git's own record of somebody having said not to remove this tree. Read into the preflight rather
   than met at the removal, which would refuse after the scratch had already gone. */
const lockedOn = (root, path) => (gitOut(["worktree", "list", "--porcelain"], root) ?? "")
  .split("\n\n").find((block) => block.startsWith(`worktree ${path}\n`))
  ?.split("\n").find((one) => one === "locked" || one.startsWith("locked ")) ?? null;

const readTree = (root, path, base, gates) => ({
  branch: gitOut(["rev-parse", "--abbrev-ref", "HEAD"], path),
  scratch: scratchAt(path),
  dirty: uncommitted(path),
  ahead: ahead(path, base),
  gates: gates(path, runnersOf(root)),
  locked: lockedOn(root, path),
  verdict: verdictPath(path),
});

const dirtyRefusal = (path, dirty) => {
  if (dirty === null) {
    return { why: `git would not say what is uncommitted in ${path}, so nothing here can prove that `
      + `tree holds no work`, how: `git -C ${path} status` };
  }
  return dirty.length
    ? { why: `${path} holds ${dirty.length} uncommitted path(s) no record cites: ${dirty.join(", ")}`,
      how: `git -C ${path} status --short` }
    : null;
};

const aheadRefusal = (path, base, branch, read) => {
  if (read.unknown) {
    return { why: `${read.unknown}, so nothing here can prove ${REMOTE}/${base} carries the commits `
      + `of ${branch}`, how: `git -C ${path} fetch ${REMOTE} ${base}` };
  }
  return read.commits.length
    ? { why: `${branch} holds ${read.commits.length} commit(s) ${REMOTE}/${base} does not carry, which `
      + `die with the tree: ${read.commits.join("; ")}`, how: `${runnerIn(path, "run.mjs")} ship` }
    : null;
};

/* Off the process table, which is where a gate is its own record: on a machine whose table cannot be
   read this sees none and refuses nobody, exactly as the gate's own count does. */
const gateRefusal = (path, held) => (held.length
  ? { why: `${held.length} gate(s) of that tree are still running — pid `
    + `${held.map((one) => one.pid).join(", ")} — and the tree they are judging is the one this would `
    + `remove`, how: `${runnerIn(path, "gates.mjs")} --wait` }
  : null);

const lockRefusal = (root, path, held) => (held
  ? { why: `that worktree is locked — git records it as \`${held}\` — which is somebody saying not to `
    + `remove it, and this call is not the one to overrule them`, how: `git -C ${root} worktree unlock ${path}` }
  : null);

const refusals = (root, path, base, read) => [
  dirtyRefusal(path, read.dirty),
  aheadRefusal(path, base, read.branch ?? "that branch", read.ahead),
  gateRefusal(path, read.gates),
  lockRefusal(root, path, read.locked),
].filter(Boolean);

const removedScratch = (at) => {
  if (!at) {
    return console.log(`  left     no scratch directory is named: that tree carries no run id this `
      + `repository minted, and nothing derives a path from one it did not`);
  }
  if (!existsSync(at)) return console.log(`  gone     ${at} was already removed`);
  const held = readdirSync(at).length;
  rmSync(at, { recursive: true, force: true });
  return console.log(`  removed  ${at}, holding ${held} entry(s)`);
};

/* `-d` and never `-D`, with git's own advice off: that advice offers the forced delete, which is the
   one route out of this a refusal here may not carry — the way out is the line below it. */
const removedBranch = (root, base, branch) => {
  const run = git(["-C", root, "-c", "advice.forceDeleteBranch=false", "branch", "-d", branch], root);
  if (run.status === 0) return console.log(`  removed  branch ${branch}`);
  console.error(`  left     branch ${branch}, which git refuses to delete: `
    + `${(run.stderr ?? "").trim() || `it exited ${run.status}`}`);
  return console.error(`           nothing of it is lost — ${REMOTE}/${base} carries every commit of `
    + `it, proved before anything was removed. Delete it once this checkout has caught up: `
    + `git -C ${root} branch -d ${branch}`);
};

const removedVerdict = (at) => {
  if (!existsSync(at)) return console.log(`  gone     no gate of that tree ever wrote a verdict record`);
  rmSync(at, { force: true });
  return console.log(`  removed  ${at}, the verdict record of a tree that is now gone`);
};

/* Invoked and not read off the install record: a record names a version, and what a session needs is
   a copy that still starts. A copy that does not answer is this run's to report and nobody's to fix
   from here, so it changes no exit code — a cleanup that failed for something else being down has
   stopped the wrong thing. */
const stackSays = () => {
  const copy = copyToRun({ cwd: homedir() });
  const entry = copy?.dir ? join(copy.dir, "src", "cli.mjs") : null;
  if (!entry || !existsSync(entry)) {
    return console.log(`  stack    no installed plugin copy resolves for a session outside this `
      + `checkout, so there is nothing here to confirm`);
  }
  const run = spawnSync(process.execPath, [entry, "-h"], { cwd: homedir(), encoding: "utf8", timeout: 30_000 });
  const said = `${copy.version} at ${copy.dir} — ${copy.why}`;
  return run.status === 0
    ? console.log(`  stack    the copy a session outside this checkout loads answered: ${said}`)
    : console.error(`  stack    the copy a session outside this checkout loads did not answer: ${said}`
      + `: ${(run.error?.message ?? run.stderr ?? `it exited ${run.status}`).toString().trim()}`);
};

const treesLeft = (root) => {
  const held = lines(gitOut(["worktree", "list"], root));
  console.log(`  trees    ${held.length} left on this checkout:`);
  for (const one of held) console.log(`             ${one}`);
};

const standingIn = (path, cwd) => {
  const at = resolve(path);
  return resolve(cwd) === at || resolve(cwd).startsWith(`${at}${sep}`);
};

const foreign = (root, path, whose) => {
  if (whose.plain) {
    return `${path} is there and git answers no worktree root for it, so it is a plain directory or a `
      + `tree this checkout cannot read, and neither is this call's to remove. Which of the two is what `
      + `\`git -C ${path} status\` says.`;
  }
  const which = whose.itsOwn ? "a checkout of its own" : `a worktree of ${whose.owner}`;
  return `${path} is ${which} and not a worktree of ${root}, so ending it is that repository's to do `
    + `and nothing here reaches it. Ask that repository to release the path: git -C `
    + `${whose.itsOwn ? path : whose.owner} worktree list`;
};

export const finish = ({ words: [given] }, { here, cwd = process.cwd(), gates = gatesHere }) => {
  const key = String(given ?? "").toUpperCase();
  if (!KEY.test(key)) {
    console.error(`finish takes the issue key whose workspace it ends, \`ISS-nn\`, not \`${given ?? ""}\`.`);
    process.exitCode = REFUSED;
    return;
  }
  const root = checkoutRoot(here);
  const path = worktreePath(root, key);
  console.log(`The workspace ${key} was started with: ${path}`);
  if (!existsSync(path)) {
    console.log(`  gone     nothing is there, so this workspace is already ended and this removed nothing`);
    console.log(`  left     the run id and the ledger's name for that tree both lived in it, so this `
      + `names neither a scratch directory nor a verdict record: what a removal by hand left behind `
      + `is a leak to recover and not a workspace to end`);
    treesLeft(root);
    stackSays();
    return;
  }
  const whose = whoseTree(root, path);
  if (!whose.mine) {
    console.error(`  left     ${foreign(root, path, whose)}`);
    process.exitCode = REFUSED;
    return;
  }
  const base = defaultBranch(root);
  const read = readTree(root, path, base, gates);
  const held = refusals(root, path, base, read);
  if (held.length) {
    console.error(`  left     the whole workspace, its scratch with it, because a removal would take `
      + `what no record of it cites:`);
    for (const one of held) console.error(`             ${one.why}\n               clear it: ${one.how}`);
    treesLeft(root);
    stackSays();
    process.exitCode = REFUSED;
    return;
  }
  removedScratch(read.scratch);
  if (standingIn(path, cwd)) {
    console.log(`  left     ${path}, which this call is standing in: a verb that removes the directory `
      + `its caller stands in leaves that caller nothing to write its last records from.`);
    console.log(`           End it from the checkout, where nothing stands in it: `
      + `${runnerIn(root, "run.mjs")} finish ${key}`);
  } else {
    loud("git", ["-C", root, "worktree", "remove", path], root,
      `The scratch directory above is gone and nothing else is — no branch and no verdict record. `
      + `Read what git said, then take this call again: a second one finds the scratch already gone.`);
    console.log(`  removed  ${path}`);
    if (read.branch) removedBranch(root, base, read.branch);
    removedVerdict(read.verdict);
  }
  treesLeft(root);
  stackSays();
};
