/* Which tree the release installs from. One registered directory is all the marketplace installs
   from, so a release that had to move the shared checkout first was stopped after its own push by
   whatever a session left unpushed there (ISS-374). Chosen here, and no longer always the checkout. */
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

import { pluginCopy } from "../../plugin/src/tools/plugin-copy.mjs";
import { git, gitOut, lines, loud, REMOTE, stop } from "../checkout.mjs";
import { above } from "./version.mjs";

const READ_BY_INSTALL = ["plugin", ".claude-plugin"];

/** What a worktree borrows from the checkout, so a gate run in it resolves its own linter. */
export const LINKED = ["node_modules", join("packages", "code-quality", "node_modules")];

const CLAUDE = "claude";
const ADD = (at) => `${CLAUDE} plugin marketplace add ${at}`;

export const shortly = (sha) => String(sha ?? "").slice(0, 7);

const headOf = (root) => shortly(gitOut(["rev-parse", "HEAD"], root)) || "an unreadable HEAD";

/** What the remote holds for a branch, or null; an unreachable remote and a gone branch read alike. */
export const remoteHeadOf = (tree, base) =>
  (gitOut(["ls-remote", REMOTE, `refs/heads/${base}`], tree) ?? "").split(/\s+/u)[0] || null;

// Name-only: `status --porcelain`'s column is one `gitOut` has trimmed the first character off.
const uncommitted = (root, paths) => [...new Set([
  ...lines(gitOut(["diff", "--name-only", "HEAD", "--", ...paths], root)),
  ...lines(gitOut(["ls-files", "--others", "--exclude-standard", "--", ...paths], root)),
])].sort();

// Its head, and nothing uncommitted where an install reads; a dirty path elsewhere is open work.
export const shipped = (root, tree) => {
  if (resolve(tree) === resolve(root)) return { is: true, why: "this tree is the checkout" };
  const at = gitOut(["rev-parse", "HEAD"], root);
  if (!at) return { is: false, why: `${root} could not be asked what its HEAD is` };
  const mine = gitOut(["rev-parse", "HEAD"], tree);
  if (at !== mine) return { is: false, why: `its HEAD is ${shortly(at)} and this release is ${shortly(mine)}` };
  const dirty = uncommitted(root, READ_BY_INSTALL);
  return dirty.length
    ? { is: false,
      why: `it is at the pushed head but holds uncommitted work under ${READ_BY_INSTALL.join(" and ")}, `
        + `which an install would copy: ${dirty.join(", ")}` }
    : { is: true, why: "it is at the pushed head with nothing uncommitted where an install reads" };
};

/* `diff-tree`, never `<sha>^`: a repository's first commit has no parent and answers nothing. */
const touching = (root, sha) =>
  lines(gitOut(["diff-tree", "--no-commit-id", "--name-only", "-r", sha], root));

// Whose each commit in the way is and what it touches: a refusal leaving that read names nothing.
export const inTheWay = (root, base) => {
  const held = lines(gitOut(["log", "--format=%h %an, %ad: %s", "--date=short", `${REMOTE}/${base}..HEAD`], root));
  return {
    commits: held.map((one) => {
      const files = touching(root, one.split(" ")[0]);
      return `    ${one}\n      touching ${files.length ? files.join(", ") : "nothing this reading can name"}`;
    }),
    dirty: uncommitted(root, ["."]),
  };
};

const LEAVE_IT = "  Leave every bit of that alone: it is not this run's, and the install no longer reads that "
  + "tree — the next step installs from the tree that shipped, so the release is not waiting on it. The "
  + "checkout catches up when whoever owns that work lands it.";

/** The checkout offered the pushed head, told about either way, and stopping nothing now. */
export const follows = (root, base, tree) => {
  if (resolve(tree) === resolve(root)) return console.log("  this tree is the checkout");
  const on = gitOut(["rev-parse", "--abbrev-ref", "HEAD"], root);
  if (on !== base) {
    console.error(`  ${root} is on ${on} rather than ${base}, so it is not offered the pushed head and `
      + `stays at ${headOf(root)}. Whoever parked it there puts it back — git -C ${root} checkout ${base}.`);
    return console.error(LEAVE_IT);
  }
  /* Never `pull`: under `pull.rebase` that is a rebase, which refuses a dirty worktree even for a
     no-op, and the push a step ago already moved these refs (ISS-143). Through `git` and not
     `loud`, a bare `fatal:` on the way past not being this step's message. */
  if (git(["merge", "--ff-only", `${REMOTE}/${base}`], root).status === 0) {
    return console.log(`  ${root} is at ${headOf(root)}`);
  }
  console.error(`  ${root} cannot fast-forward to the pushed head and stays at ${headOf(root)}. In the way:`);
  const { commits, dirty } = inTheWay(root, base);
  for (const one of commits) console.error(one);
  if (dirty.length) console.error(`    uncommitted: ${dirty.join(", ")}`);
  if (!commits.length && !dirty.length) {
    console.error(`    nothing this reading can name — git -C ${root} status --short and `
      + `git -C ${root} log --oneline ${REMOTE}/${base}..HEAD say more`);
  }
  return console.error(LEAVE_IT);
};

// Not `loud`: this unwinds, and a throw from an unwind loses the reason it was unwinding.
const moved = (at) => {
  const run = spawnSync(CLAUDE, ["plugin", "marketplace", "add", at], { cwd: at, encoding: "utf8", stdio: "inherit" });
  if (run.error) return `${CLAUDE} could not be run: ${run.error.message}`;
  return run.status === 0 ? null : `${ADD(at)} exited ${run.status}`;
};

/* A mismatch is refused and the route out is this step again: by hand would re-point the
   registration this step has put back, and install under no lock. An unreadable record is only said. */
const cacheHolds = (from) => {
  const copy = pluginCopy(join(from, "plugin"));
  if (!copy) return console.log("  no install record answers for this plugin, so what the cache now holds cannot be read here");
  if (copy.installed !== copy.running) {
    stop(`the install ran and the cache does not hold this release: ${copy.name} ${copy.running} is what `
      + `the tree that shipped carries and ${copy.installed} is the newest version the install record `
      + `holds. Nothing is half-released quietly — read what the install said above, and take this step `
      + `again rather than installing by hand.`);
  }
  return console.log(`  ${copy.name} ${copy.installed} is installed, from ${from}`);
};

/* Read here rather than at the step's start, because the window this closes is inside the step: the branch check a moment ago passed against a branch another release has pushed to since, and the record is the one thing that says so. Versions rather than the record's own order, which is the order two racing installs finished in (ISS-673 AC-05-10-10). */
const overwritesNewer = (from) => {
  const copy = pluginCopy(join(from, "plugin"));
  if (!copy?.installed || !copy?.running || !above(copy.installed, copy.running)) return null;
  return `the install record holds ${copy.name} ${copy.installed} and this tree carries ${copy.running}, `
    + `a version below it: a newer release installed while this one was on its way here, and this `
    + `install would put the older copy in the cache. Nothing has been installed and the newer copy `
    + `stands. This release is behind the branch — take it again from the fetch, which raises a `
    + `version above what landed`;
};

const updating = (from, market, plugin) => {
  const older = overwritesNewer(from);
  if (older) stop(older);
  loud(CLAUDE, ["plugin", "marketplace", "update", market], from,
    "The cache is keyed by version, so an update at an installed version is a no-op.");
  loud(CLAUDE, ["plugin", "update", `${plugin}@${market}`], from,
    "Install it by hand if the marketplace has it and this does not.");
};

/* Asked of the remote, never of a tracking ref a resume aimed at this step never fetched: that ref
   can name a release another clone pushed past, and installing then caches a copy below the branch. */
const notTheBranch = (tree, base) => {
  const held = remoteHeadOf(tree, base);
  const mine = gitOut(["rev-parse", "HEAD"], tree);
  if (!held || !mine) {
    return `${REMOTE}/${base} and this tree could not be compared: ${REMOTE} named `
      + `${held ? shortly(held) : "nothing"} for ${base} and this tree named `
      + `${mine ? shortly(mine) : "nothing"} for its own HEAD. An unreachable remote, a branch that is `
      + `gone and an unreadable HEAD all read this way, and an install past any of them would put `
      + `whatever is here in the cache against nothing.`;
  }
  if (held === mine) return null;
  return `this tree is not what ${REMOTE}/${base} holds — HEAD is ${shortly(mine)} and the branch is `
    + `${shortly(held)} — so installing it would put a copy in the cache older than the one the branch `
    + `carries. A release landed after this one pushed.`;
};

// One step, its span being stateful: a resume redoes all of it or none of it.
export const installs = ({ tree, root, base, market, plugin, self }) => {
  const wrong = notTheBranch(tree, base);
  if (wrong) {
    stop(`${wrong} Nothing has moved here: take this release again from the fetch, which raises a `
      + `version above the branch and installs its head:\n    ${self} ship --from 2`);
  }
  const here = shipped(root, tree);
  const from = here.is ? root : tree;
  if (here.is) {
    console.log(`  the checkout is the tree that shipped — ${here.why} — so the install reads it and `
      + `no marketplace registration is written`);
    updating(from, market, plugin);
    return cacheHolds(from);
  }
  console.log(`  the checkout is not the tree that shipped — ${here.why}`);
  console.log(`  so the install reads ${from}, and the registration goes back to the checkout after it.`);
  console.log(`  Where this run dies before that, one command puts it back:\n    ${ADD(root)}`);
  loud(CLAUDE, ["plugin", "marketplace", "add", from], from, `Nothing has moved yet: the registration is `
    + `where it was and no install has run. Read what ${CLAUDE} said, then resume from this step.`);
  /* Caught whatever its class, and re-thrown after the registration is back: a throw carried past
     this would leave every session on this machine installing from this worktree. */
  let failed = null;
  try {
    updating(from, market, plugin);
  } catch (error) {
    failed = error;
  }
  const why = moved(root);
  if (why) {
    stop(`the registration could not be put back and still names ${from}, a worktree this run does not `
      + `own past its own end: ${why}.${failed ? ` The install had already failed: ${failed.message}` : ""} `
      + `Put it back before anything else on this machine ships:\n    ${ADD(root)}`);
  }
  console.log(`  the registration names ${root} again`);
  if (failed) throw failed;
  return cacheHolds(from);
};
