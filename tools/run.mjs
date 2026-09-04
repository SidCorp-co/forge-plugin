#!/usr/bin/env node
/* One home for the procedure a change goes through outside its own diff. Sixteen delegated runs
   read it out of a prompt instead, each obeying a copy with nothing to fail when it aged past the
   tree: four of that prompt's lines were workarounds for defects closed three releases before the
   run that still obeyed them (ISS-79). */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { pluginCopy } from "../plugin/src/tools/plugin-copy.mjs";
import { checkoutRoot, defaultBranch, git, gitOut, REMOTE, Stop, stop } from "./checkout.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = `node ${join(basename(HERE), "tools", "run.mjs")}`;
const LINKED = ["node_modules", join("packages", "code-quality", "node_modules")];

/* Each delegated run reviews its own diff and stops there, so a helper two of them each wrote, or a
   parameter one stopped passing, is inside no run's range and found by nobody (ISS-95). The reading
   that spans them is owed by this count rather than by anyone's judgement per issue. */
const REVIEWED = "refs/forge/reviewed";
const REVIEW_PATHS = ["plugin/src", "plugin/hooks", "plugin/bin"];
const REVIEW_RELEASES = 3;
const REVIEW_LINES = 500;
const NO_MARK = `no ${REVIEWED} in this repository, so what is owed a reading cannot be counted. `
  + `The first review reads from the release that introduced this rule: ${SELF} review --done <that release>.`;

const USAGE = [
  `Usage: ${SELF} <start|ship|review> [args]`,
  "The repository's own steps around one change: the worktree a run works in, and the release that",
  "puts its commit in the plugin copy the next session loads. Everything else is the change itself.",
  "",
  "  start <ISS-nn> [slug]   add the worktree beside this checkout, link both node_modules, and",
  "                          print the wrapper a probe of the change must invoke",
  "  ship [--from N] [--note S]",
  "                          clean tree, fetch, rebase, `npm run check`, a version above the remote",
  "                          head, push, the checkout pulled, the marketplace and the plugin",
  "                          updated, then the installed copy named and every plugin/hooks/ file",
  "                          the release moved",
  "  review [--done [ref]]   the range the next review reads, or --done to move the mark to it",
  "",
  "  --from N     resume at step N, which a failed step prints for you",
  "  --note S     the subject of the version commit, when the release has to make one",
  "  --done [ref] the mark moves to ref, HEAD by default, and only ever from here",
  "",
  "ship stops at the first failure and writes nothing past it. A change under plugin/hooks/ or",
  "plugin/skills/ reaches a session at its next start, so the last step says whether a restart is",
  "owed before anything trusts the release.",
  "",
  `That last step also counts what landed under ${REVIEW_PATHS.join(", ")} since ${REVIEWED}, and`,
  `says one reading of the whole of it is owed once the range holds ${REVIEW_RELEASES} release(s) or`,
  `${REVIEW_LINES} changed line(s). That reading is a delegated run in a worktree of its own, under`,
  "the same contract and the same gates; it ends with --done from that tree, after its own ship, so",
  "the mark names the pushed head it read to. A mark left unmoved keeps the count growing, which is",
  "how a skipped reading stays visible at the next ship.",
].join("\n");

/* Run for the person watching: a step's own output is the evidence that it did what it says. */
const loud = (command, args, cwd, why) => {
  const run = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "inherit" });
  if (run.error) stop(`${command} could not be run: ${run.error.message}. ${why}`);
  if (run.status !== 0) stop(`${command} ${args.join(" ")} exited ${run.status}. ${why}`);
};

const read = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

const parts = (version) => String(version ?? "").split(".").map((one) => Number.parseInt(one, 10));

const above = (one, two) => {
  const [a, b] = [parts(one), parts(two)];
  for (let at = 0; at < 3; at += 1) {
    if ((a[at] ?? 0) !== (b[at] ?? 0)) return (a[at] ?? 0) > (b[at] ?? 0);
  }
  return false;
};

/** The version this release must carry, or null when the tree already carries one above the remote
 *  head. A rebase drops a bump identical to one already upstream without a conflict, leaving a
 *  manifest that names a version carrying none of the change and nothing red to say so. */
const nextVersion = (local, upstream) => {
  if (!parts(local).every(Number.isInteger)) stop(`this tree's package.json names no version: \`${local}\`.`);
  if (above(local, upstream)) return null;
  const [major, minor, patch] = parts(upstream).every(Number.isInteger) ? parts(upstream) : parts(local);
  return [major, minor, patch + 1].join(".");
};

const versionAt = (root, ref) => {
  const shown = gitOut(["show", `${ref}:package.json`], root);
  if (!shown) return null;
  try {
    return JSON.parse(shown).version ?? null;
  } catch {
    return null;
  }
};

const worktreePath = (root, key) => join(dirname(root), `wt-${key}`);

const start = ([given, slug]) => {
  const key = String(given ?? "").toUpperCase();
  if (!/^ISS-\d+$/u.test(key)) stop(`start takes the issue key it works, \`ISS-nn\`, not \`${given ?? ""}\`.`);
  const root = checkoutRoot(HERE);
  const path = worktreePath(root, key);
  if (existsSync(path)) {
    stop(`${path} is already there, and start never touches a worktree it did not make. Work in it, `
      + `or remove it: git -C ${root} worktree remove ${path}`);
  }
  const branch = `iss-${key.slice(4).toLowerCase()}${slug ? `-${slug}` : ""}`;
  const base = defaultBranch(root);
  loud("git", ["-C", root, "worktree", "add", path, "-b", branch, base], root,
    `Pick another branch name than ${branch} if it is taken.`);
  /* All of it or none of it: a half-linked tree refuses the next `start` for the path it left and
     keeps the branch it cut, so the run's escape is two commands it was never told. */
  try {
    for (const one of LINKED) {
      if (!existsSync(join(root, one))) {
        console.error(`  ${one} is not installed in the checkout, so nothing was linked for it.`);
        continue;
      }
      symlinkSync(join(root, one), join(path, one));
      console.log(`  linked  ${join(path, one)}`);
    }
  } catch (error) {
    git(["-C", root, "worktree", "remove", "--force", path], root);
    git(["-C", root, "branch", "-D", branch], root);
    stop(`${path} could not be linked (${error.message}), so the worktree and ${branch} are removed `
      + `again and nothing is half-made. Install the checkout's dependencies, then start over.`);
  }
  console.log(`\nBranch ${branch} on ${path}, cut from ${base}.`);
  console.log(`Probe the change with this tree's own wrapper, never the one on PATH:`);
  console.log(`  ${join(path, "plugin", "bin", "forge")} <args>`);
  console.log(`  node ${join(path, "plugin", "hooks", "entries")}/<gate>.mjs   one gate, alone`);
  console.log(`Ship it from that tree: ${SELF} ship`);
};

const cleanTree = (tree) => {
  const dirty = gitOut(["status", "--porcelain"], tree);
  if (dirty === null) stop(`${tree} is no git checkout.`);
  if (dirty) stop(`the tree is dirty and a release ships commits:\n${dirty}\nCommit or drop these first.`);
  console.log("  nothing uncommitted");
};

/* Whether the bump is committed is read from the tree against its own head, never from having just
   made it: a resume after a failed commit finds the manifest already raised, and a step that took
   that for done would push a release whose version is only on disk. */
const versionAbove = (tree, base, note) => {
  const upstream = versionAt(tree, `${REMOTE}/${base}`);
  const want = nextVersion(read(join(tree, "package.json"))?.version, upstream);
  if (want) {
    console.log(`  ${REMOTE}/${base} carries ${upstream}; taking ${want}`);
    loud("npm", ["version", want, "--no-git-tag-version"], tree, "The version lifecycle writes the manifest too.");
  }
  const mine = read(join(tree, "package.json"))?.version;
  if (versionAt(tree, "HEAD") === mine) return console.log(`  ${mine} is committed and above ${upstream}`);
  const touched = ["package.json", "package-lock.json", join("plugin", ".claude-plugin", "plugin.json")]
    .filter((one) => existsSync(join(tree, one)));
  loud("git", ["add", ...touched], tree, "Stage them by name and commit the bump yourself.");
  loud("git", ["commit", "-m", note ?? `chore(release): ${mine}, so the installed copy is this head`], tree,
    "Commit the bump, then resume.");
};

/* The sha the remote head had before the push, kept in the tree's own git directory rather than in
   this process: the whole point of --from is that the process is a new one, and after the push
   `origin/<base>` is the head, so a run that read it then would compare a range of nothing. */
const MARK = "forge-ship-from";

const markFile = (tree) => join(gitOut(["rev-parse", "--absolute-git-dir"], tree) ?? tree, MARK);

/* Silent about what it cannot compare rather than reassuring: a session told no hook moved keeps
   running the hook that did. */
const restartOwed = (tree, base) => {
  const was = existsSync(markFile(tree)) ? readFileSync(markFile(tree), "utf8").trim() : null;
  if (!was) {
    return console.error(`  no ${MARK} in this tree's git directory, so what this release moved is `
      + `unknown and no session may be told it is safe. Read it against the head ${REMOTE}/${base} `
      + `had before the push: git diff --name-only <that sha>..HEAD`);
  }
  const moved = (gitOut(["diff", "--name-only", `${was}..HEAD`], tree) ?? "").split("\n").filter(Boolean);
  const held = moved.filter((one) => one.startsWith("plugin/hooks/") || one.startsWith("plugin/skills/"));
  if (!held.length) return console.log(`  nothing under plugin/hooks/ or plugin/skills/ moved since ${was.slice(0, 7)}`);
  console.log(`  a restart is owed before any open session trusts these ${held.length} file(s):`);
  for (const one of held) console.log(`    ${one}`);
};

const reviewedAt = (tree) => gitOut(["rev-parse", "--verify", "--quiet", REVIEWED], tree);

/** What has landed in a range. A release is a commit whose manifest version differs from its first
 *  parent's, so a ship whose rebase dropped the bump is counted by the version it pushed rather
 *  than by a subject line nothing enforces. The walk is `--first-parent` for the same reason the
 *  comparison is: off it, a merge that carried a bump in from a side branch is dropped as TREESAME
 *  while the side branch's own bumps are each counted, and neither is a release of this branch.
 *  A binary file is `-\t-` in numstat and has no lines to add. */
const landed = (tree, from) => {
  const bumps = (gitOut(["log", "--first-parent", "--format=%H", `${from}..HEAD`, "--", "package.json"], tree) ?? "")
    .split("\n").filter(Boolean);
  const rows = (gitOut(["diff", "--numstat", `${from}..HEAD`, "--", ...REVIEW_PATHS], tree) ?? "")
    .split("\n").filter(Boolean);
  return {
    releases: bumps.filter((sha) => versionAt(tree, sha) !== versionAt(tree, `${sha}^`)).length,
    files: rows.length,
    lines: rows.reduce((sum, row) => sum + row.split("\t").slice(0, 2)
      .reduce((part, one) => part + (Number.parseInt(one, 10) || 0), 0), 0),
  };
};

/** The one sentence both readers of the count print, so ship's last step and the review verb can
 *  never disagree about what the range holds or whether it is enough. */
const reviewSays = (tree, from) => {
  const { releases, files, lines } = landed(tree, from);
  return {
    owed: releases >= REVIEW_RELEASES || lines >= REVIEW_LINES,
    range: `${from.slice(0, 7)}..HEAD`,
    count: `${releases} release(s), ${files} file(s), ${lines} changed line(s)`,
  };
};

/* The mark is never planted here. One planted where none was found would read exactly like a
   reading that has just finished, and the skipped reading it hid would surface at no later ship. */
const reviewOwed = (tree) => {
  const from = reviewedAt(tree);
  if (!from) return console.error(`  ${NO_MARK}`);
  const { owed, range, count } = reviewSays(tree, from);
  if (!owed) {
    return console.log(`  ${count} under ${REVIEW_PATHS.join(", ")} since ${from.slice(0, 7)}, short `
      + `of the ${REVIEW_RELEASES} release(s) or ${REVIEW_LINES} line(s) that call for a reading`);
  }
  console.log(`  a review of ${range} is owed: ${count} under ${REVIEW_PATHS.join(", ")}, at or past `
    + `${REVIEW_RELEASES} release(s) or ${REVIEW_LINES} line(s). It is a delegated run of its own:`);
  console.log(`    file its issue:  forge new - --title "review ${range}" --size feature`);
  console.log(`    give it a tree:  ${SELF} start <that ISS-nn>`);
  console.log(`    it ends by moving the mark, finding or none: ${SELF} review --done`);
};

/* The mark's only writer, so nothing else has to agree with it about where a reading reached. */
const review = (argv) => {
  const tree = process.cwd();
  const at = argv.indexOf("--done");
  const from = reviewedAt(tree);
  if (at < 0) {
    if (!from) stop(NO_MARK);
    const { owed, range, count } = reviewSays(tree, from);
    console.log(`${range} is the next review's, and holds ${count} under ${REVIEW_PATHS.join(", ")}.`);
    console.log(`  git diff ${from}..HEAD -- ${REVIEW_PATHS.join(" ")}`);
    return console.log(owed
      ? `A review is owed: ${REVIEW_RELEASES} release(s) or ${REVIEW_LINES} line(s) call for one, and this range is past that.`
      : `Short of the ${REVIEW_RELEASES} release(s) or ${REVIEW_LINES} line(s) that call for a reading.`);
  }
  const asked = argv[at + 1] ?? "HEAD";
  const to = gitOut(["rev-parse", "--verify", `${asked}^{commit}`], tree);
  if (!to) stop(`\`${asked}\` is no commit in this tree, and the mark records where a reading reached.`);
  if (from && git(["merge-base", "--is-ancestor", from, to], tree).status !== 0) {
    stop(`${to.slice(0, 7)} is not a descendant of the mark at ${from.slice(0, 7)}, and a mark that `
      + `moves backwards hands the next reading a range already read. Name a commit ahead of it — or, `
      + `where the mark itself is the mistake, move it by hand and say so: `
      + `git update-ref ${REVIEWED} ${to.slice(0, 7)} ${from.slice(0, 7)}`);
  }
  /* Two review worktrees share this ref, so the old value goes with the write: the second to finish
     is refused rather than silently dropping the range the first had already read. */
  loud("git", ["update-ref", REVIEWED, to, from ?? ""], tree,
    `The mark is not where this run read it. Another reading finished first: ${SELF} review, then move it again.`);
  console.log(from
    ? `${REVIEWED} ${from.slice(0, 7)} -> ${to.slice(0, 7)}; the next review reads from there.`
    : `${REVIEWED} planted at ${to.slice(0, 7)}; the next review reads from there.`);
};

const named = () => ({
  market: read(join(HERE, ".claude-plugin", "marketplace.json"))?.name,
  plugin: read(join(HERE, "plugin", ".claude-plugin", "plugin.json"))?.name,
});

const shipSteps = (tree, root, base, note) => {
  const { market, plugin } = named();
  if (!market || !plugin) stop("this checkout names no marketplace or no plugin, so there is nothing to install.");
  return [
    ["the tree is clean", () => cleanTree(tree)],
    [`fetch ${REMOTE}/${base}`, () => {
      loud("git", ["fetch", REMOTE, base], tree, "Check the remote is reachable.");
      writeFileSync(markFile(tree), `${gitOut(["rev-parse", `${REMOTE}/${base}`], tree)}\n`);
    }],
    [`rebase onto ${REMOTE}/${base}`, () =>
      loud("git", ["rebase", `${REMOTE}/${base}`], tree, `Resolve it, or \`git rebase --abort\`, then ${SELF} ship --from 3`)],
    /* After the rebase, because the range is what the release actually ships, and before the bump,
       because the gate's record is keyed on the manifests too: run it after and every release pays
       for a whole gate over a change of one version string. */
    ["the gate", () => loud("npm", ["run", "check"], tree,
      "Fix the tree and ship again; a release ships what a gate has passed, and nothing after this step has run.")],
    [`a version above ${REMOTE}/${base}`, () => versionAbove(tree, base, note)],
    [`push to ${REMOTE}/${base}`, () =>
      loud("git", ["push", REMOTE, `HEAD:${base}`], tree,
        `Rejected means the remote moved: rebase, re-run the review of the rebased head, then ${SELF} ship --from 2`)],
    ["the checkout follows", () => {
      if (resolve(tree) === resolve(root)) return console.log("  this tree is the checkout");
      /* The marketplace installs from the checkout's working tree, so a checkout parked on another
         branch would ship that branch under this release's version. */
      const on = gitOut(["rev-parse", "--abbrev-ref", "HEAD"], root);
      if (on !== base) {
        stop(`the checkout at ${root} is on ${on}, and the marketplace installs from its working tree. `
          + `Put it on ${base} — git -C ${root} checkout ${base} — then resume.`);
      }
      loud("git", ["-C", root, "pull", "--ff-only"], root, `Something landed in ${root} that is not upstream.`);
    }],
    [`marketplace ${market}`, () => loud("claude", ["plugin", "marketplace", "update", market], root,
      "The cache is keyed by version, so an update at an installed version is a no-op.")],
    [`plugin ${plugin}@${market}`, () => loud("claude", ["plugin", "update", `${plugin}@${market}`], root,
      "Install it by hand if the marketplace has it and this does not.")],
    ["the copy the next session loads", () => {
      const copy = pluginCopy(join(root, "plugin"));
      console.log(copy
        ? `  ${copy.name} ${copy.running} running, ${copy.installed} installed${copy.stale ? " — this version is in no install record" : ""}`
        : "  no install record answers for this plugin");
      restartOwed(tree, base);
      reviewOwed(tree);
    }],
  ];
};

const ship = (argv) => {
  const at = argv.indexOf("--from");
  const from = at < 0 ? 1 : Number.parseInt(argv[at + 1], 10);
  const noteAt = argv.indexOf("--note");
  const note = noteAt < 0 ? null : argv[noteAt + 1];
  const tree = process.cwd();
  const root = checkoutRoot(tree);
  const base = defaultBranch(tree);
  const steps = shipSteps(tree, root, base, note);
  if (!Number.isInteger(from) || from < 1 || from > steps.length) {
    stop(`--from takes a step between 1 and ${steps.length}, not \`${argv[at + 1] ?? ""}\`.`);
  }
  for (let at = from - 1; at < steps.length; at += 1) {
    const [name, run] = steps[at];
    console.log(`\nstep ${at + 1}/${steps.length}  ${name}`);
    try {
      run();
    } catch (error) {
      if (!(error instanceof Stop)) throw error;
      console.error(`\nstopped at step ${at + 1} (${name}): ${error.message}`);
      console.error(`Resume from there: ${SELF} ship --from ${at + 1}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`\nReleased. Verify the change against the installed copy by its own path, not \`forge\` on PATH.`);
};

const main = (argv) => {
  const [verb, ...rest] = argv;
  if (!verb || verb === "-h" || verb === "--help") return console.log(USAGE);
  if (verb === "start") return start(rest);
  if (verb === "ship") return ship(rest);
  if (verb === "review") return review(rest);
  stop(`no step \`${verb}\`. It is start, ship or review; \`${SELF} -h\` says what each does.`);
};

try {
  main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
