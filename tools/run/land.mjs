/* What every landing on this checkout shares — the span the lock is held for, the push both verbs
   make — and `land` itself, the verb for a commit that is no release. `run.mjs` keeps the release's
   ten steps, so neither verb can hold the branch for a span the other does not (ISS-512). */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { checkoutRoot, defaultBranch, gitOut, loud, REMOTE, Stop, stop } from "../checkout.mjs";
import { shipHolder, takeShipLock, WAIT_MS } from "./lock.mjs";

/* The span one landing holds this checkout's lock for: the fetch, whose answer the rebase and the
   version are taken against, through the push. The install steps touch no branch. */
export const LANDS = "lands";
export const PUSHES = "pushes";

export const cleanTree = (tree) => {
  const dirty = gitOut(["status", "--porcelain"], tree);
  if (dirty === null) stop(`${tree} is no git checkout.`);
  if (dirty) stop(`the tree is dirty and a landing pushes commits:\n${dirty}\nCommit or drop these first.`);
  console.log("  nothing uncommitted");
};

export const waitMs = (flags) => {
  const patience = flags.get("--wait");
  const minutes = patience === undefined ? WAIT_MS / 60_000 : Number(patience);
  if (!(minutes > 0)) stop(`--wait takes the minutes to wait behind another landing, not \`${patience}\`.`);
  return minutes * 60_000;
};

/* Not `loud`: the refusal is composed after the caller has put the tree back, so it describes what
   is there. The lock does not reach a landing from another machine, the one race that survives it,
   and what that leaves to undo is the caller's — hence the reason it hands in. */
export const pushing = (tree, base, rejected) => {
  const run = spawnSync("git", ["push", REMOTE, `HEAD:${base}`], { cwd: tree, encoding: "utf8", stdio: "inherit" });
  if (run.error) stop(`git could not be run: ${run.error.message}. Check the remote is reachable.`);
  if (run.status !== 0) stop(`git push ${REMOTE} HEAD:${base} exited ${run.status}. ${rejected()}`);
};

/** The steps of one landing, in the order given, under a lock taken at the first that touches the
 *  branch and dropped at the push: the span is the steps' own roles, never the caller's to decide. */
export const runLanding = async (steps, order, tree, { ms, held, again }) => {
  let drop = null;
  try {
    for (const at of order) {
      const [name, run, role] = steps[at];
      if (!drop && held(at)) drop = await takeShipLock(tree, shipHolder(tree), { ms });
      console.log(`\nstep ${at + 1}/${steps.length}  ${name}`);
      try {
        await run();
      } catch (error) {
        if (!(error instanceof Stop)) throw error;
        console.error(`\nstopped at step ${at + 1} (${name}): ${error.message}`);
        console.error(again(at));
        process.exitCode = 1;
        return false;
      }
      if (role === PUSHES && drop) {
        drop();
        drop = null;
      }
    }
  } finally {
    if (drop) drop();
  }
  return true;
};

const landSteps = (tree, base, self) => [
  ["the tree is clean", () => cleanTree(tree)],
  [`fetch ${REMOTE}/${base}`, () =>
    loud("git", ["fetch", REMOTE, base], tree, "Check the remote is reachable."), LANDS],
  [`rebase onto ${REMOTE}/${base}`, () =>
    loud("git", ["rebase", `${REMOTE}/${base}`], tree,
      `Resolve it, or \`git rebase --abort\`, then run it again: ${self} land`), LANDS],
  [`push to ${REMOTE}/${base}`, () => {
    pushing(tree, base, () => `Rejected means the remote moved under this landing, which no lock on `
      + `this checkout reaches — a landing from another machine. Nothing here raised a version, so `
      + `there is nothing to undo: ${self} land`);
    console.log(`  ${base} is at ${(gitOut(["rev-parse", "HEAD"], tree) ?? "").slice(0, 7)}`);
  }, PUSHES],
];

/* Both guards are about which tree is typing and neither reads the diff: no gate stands between
   this and the branch, so a run reaching for it instead of `ship` is the mistake the shape invites.
   They run before the lock, so a refused landing never held the branch to be refused. */
export const land = async ({ flags }, self) => {
  const ms = waitMs(flags);
  const tree = process.cwd();
  const root = checkoutRoot(tree);
  const base = defaultBranch(tree);
  if (resolve(tree) !== resolve(root)) {
    stop(`land is the checkout's verb and this is ${tree}, a worktree of ${root}. A run's own change `
      + `is a release, gate and all: ${self} ship. A commit for the checkout is made in ${root} and `
      + `landed from there.`);
  }
  const on = gitOut(["rev-parse", "--abbrev-ref", "HEAD"], tree);
  if (on !== base) {
    stop(`the checkout is on ${on} and land pushes HEAD to ${base}, so it would land ${on} there. `
      + `Put it on ${base} — git -C ${root} checkout ${base} — then land again.`);
  }
  const steps = landSteps(tree, base, self);
  const whole = await runLanding(steps, [...steps.keys()], tree, {
    ms,
    held: (at) => Boolean(steps[at][2]),
    again: () => `Nothing here made a commit or raised a version, so run it again: ${self} land`,
  });
  if (!whole) return;
  console.log(`\nLanded on ${base}. No version was raised, so the installed plugin copy is the one it `
    + `was and no session is owed a restart for this.`);
};
