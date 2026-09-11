/* What both landing verbs share — the locked span, the push — and `land`, for a commit that is no
   release. The steps stay `run.mjs`'s, so neither verb holds the branch longer than the other's
   roles say (ISS-512). */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { checkoutRoot, defaultBranch, gitOut, loud, REMOTE, remoteRef, Stop, stop } from "../checkout.mjs";
import { shipHolder, takeShipLock, WAIT_MS } from "./lock.mjs";

/* The span: the fetch the rebase and the version are taken against, through the last step that
   moves what every worktree shares — the branch, and the registration an install reads. Dropped
   between two of those, a release installing after a later push leaves the older copy in the cache. */
export const LANDS = "lands";
export const PUSHES = "pushes";
export const INSTALLS = "installs";

export const SHARED = new Set([PUSHES, INSTALLS]);

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
   is there. A landing from another machine is the one race the lock misses, and undoing that is the
   caller's — hence the reason it hands in. */
export const pushing = (tree, base, rejected) => {
  const run = spawnSync("git", ["push", REMOTE, `HEAD:${base}`], { cwd: tree, encoding: "utf8", stdio: "inherit" });
  if (run.error) stop(`git could not be run: ${run.error.message}. Check the remote is reachable.`);
  if (run.status !== 0) stop(`git push ${REMOTE} HEAD:${base} exited ${run.status}. ${rejected()}`);
};

/** One landing's steps, in the order given: the span is the roles', never the caller's to decide. */
export const runLanding = async (steps, order, tree, { ms, held, again }) => {
  let drop = null;
  const last = [...order].reverse().find((at) => SHARED.has(steps[at][2]));
  try {
    for (const at of order) {
      const [name, run] = steps[at];
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
      if (at === last && drop) {
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
    loud("git", ["rebase", remoteRef(base)], tree,
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
