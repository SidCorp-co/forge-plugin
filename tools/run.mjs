#!/usr/bin/env node
/* One home for the procedure a change goes through outside its own diff. A prompt carrying it is a
   copy with nothing to fail when it ages past the tree, and four of the lines sixteen runs obeyed
   were workarounds for defects closed three releases earlier (ISS-79). */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { pluginCopy } from "../plugin/src/tools/plugin-copy.mjs";
import { checkoutRoot, defaultBranch, git, gitOut, REMOTE, Stop, stop } from "./checkout.mjs";
import { recordDir, runSays } from "./gates/timing.mjs";
import { flagLines, VERBS, verbUsage, wanted } from "./run/args.mjs";
import { REVIEWED, REVIEW_LINES, REVIEW_PATHS, reviewBody } from "./run/review.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = `node ${join(basename(HERE), "tools", "run.mjs")}`;
const LINKED = ["node_modules", join("packages", "code-quality", "node_modules")];

/* Each delegated run reviews its own diff and stops there, so a helper two of them each wrote, or a
   parameter one stopped passing, is inside no run's range and found by nobody (ISS-95). The reading
   that spans them is owed by this count, and what one owes is `run/review.mjs`'s. */
const NO_MARK = `no ${REVIEWED} in this repository, so what is owed a reading cannot be counted. `
  + `The first review reads from the release that introduced this rule: ${SELF} review --done <that release>.`;

const sig = (verb) => VERBS.get(verb).signature;

const USAGE = [
  `Usage: ${SELF} <start|ship|review> [args]`,
  "The repository's own steps around one change: the worktree a run works in, and the release that",
  "puts its commit in the plugin copy the next session loads. Everything else is the change itself.",
  "",
  `  ${sig("start")}   add the worktree beside this checkout, link both node_modules, and`,
  "                          print the wrapper a probe of the change must invoke",
  `  ${sig("ship")}`,
  "                          clean tree, fetch, rebase, `npm run check`, a version above the remote",
  "                          head, push, the checkout pulled, the marketplace and the plugin",
  "                          updated, then the installed copy named, the sha the change landed as,",
  "                          and every plugin/hooks/ file the release moved",
  `  ${sig("review")}   the range the next review reads, or --done to move the mark to it`,
  "",
  ...flagLines([...VERBS.values()].flatMap((one) => one.flags)),
  "",
  "ship stops at the first failure and writes nothing past it, and a resume past the gate spends",
  "the gate first, so nothing that pushes runs against a tree no gate has passed. A change under",
  "plugin/hooks/ or plugin/skills/ reaches a session at its next start, so the last step says",
  "whether a restart is owed before anything trusts the release. It says beside that what the gate",
  "run a step earlier took and how that compares with the run before it, so a release that made the",
  "gate slower is visible where a release that wrote a lot of unread code already is.",
  "",
  "It names beside those the sha the change landed as, which is not the pushed head the push printed:",
  "the rebase rewrote the commit the run reviewed and the version commit sits above it, so a mark that",
  "is about the change rather than about the release reads its sha from there and not off a log by eye.",
  "",
  `That last step also counts what landed under ${REVIEW_PATHS.join(", ")} since ${REVIEWED}, and`,
  `says one reading of the whole of it is owed once the range holds ${REVIEW_LINES} changed line(s).`,
  "The release count is printed beside it and decides nothing, so three one-line fixes owe no reading",
  "and one large landing owes one on its own. Past the threshold the step files the reading's issue",
  "itself, through this repository's own CLI, and prints the line that launches the run — and while",
  "that issue is there it names it and files nothing, whatever status it has reached. That reading is",
  "a delegated run in a worktree of its own, under the same contract and the same gates; it ends from",
  "that tree, after its own ship, with --done <the range's end>, which the issue it was given carries",
  "and which is the head its reading reached. The ref is named rather than defaulted because other",
  "runs land on this branch while a reading is being read, so a bare --done moves no existing mark at",
  "all. A mark left unmoved keeps the count growing, which is how a skipped reading stays visible",
  "at the next ship; a mark planted too far forward grows nothing, which is why it is refused here.",
].join("\n");

/* Run for the person watching: a step's own output is the evidence that it did what it says. */
const loud = (command, args, cwd, why) => {
  const run = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "inherit" });
  if (run.error) stop(`${command} could not be run: ${run.error.message}. ${why}`);
  if (run.status !== 0) stop(`${command} ${args.join(" ")} exited ${run.status}. ${why}`);
};

const parsed = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const read = (path) => {
  try {
    return parsed(readFileSync(path, "utf8"));
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

/** A release is a commit whose manifest version differs from its first parent's, so a rebase that
 *  dropped the bump is still read by the version pushed. Both readers of a range take it here. */
const isRelease = (tree, sha) => versionAt(tree, sha) !== versionAt(tree, `${sha}^`);

const RELEASE_FILES = ["package.json", "package-lock.json", join("plugin", ".claude-plugin", "plugin.json")];

/* The bump `versionAbove` commits touches these files and no others, so a change that raised the
   version in its own commit is still the change. */
const onlyRelease = (tree, sha) => isRelease(tree, sha)
  && (gitOut(["diff", "--name-only", `${sha}^`, sha], tree) ?? "").split("\n")
    .filter(Boolean).every((one) => RELEASE_FILES.includes(one));

const worktreePath = (root, key) => join(dirname(root), `wt-${key}`);

const start = ({ words: [given, slug] }) => {
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
  const touched = RELEASE_FILES.filter((one) => existsSync(join(tree, one)));
  loud("git", ["add", ...touched], tree, "Stage them by name and commit the bump yourself.");
  loud("git", ["commit", "-m", note ?? `chore(release): ${mine}, so the installed copy is this head`], tree,
    "Commit the bump, then resume.");
};

/* In the tree's git directory and not in this process: --from is a new process, and after the push
   the remote head is no range's start. */
const MARK = "forge-ship-from";

const markFile = (tree) => join(gitOut(["rev-parse", "--absolute-git-dir"], tree) ?? tree, MARK);

const shipFrom = (tree) => (existsSync(markFile(tree)) ? readFileSync(markFile(tree), "utf8").trim() : null);

/** Both readings a release owes a session, off the head the remote had before the push: the sha a
 *  merged mark names, which is neither end of the line the push prints, and the files a restart is
 *  owed for. This tree's head is what the push sent; the remote-tracking ref every worktree shares
 *  would name the tip of whichever run pushed last (ISS-169). Silent about what it cannot compare. */
const releaseSays = (tree, base) => {
  const was = shipFrom(tree);
  if (!was) {
    return console.error(`  no ${MARK} in this tree's git directory, so the sha this change landed `
      + `as cannot be named and what this release moved is unknown; no session may be told it is `
      + `safe. Read both against the head ${REMOTE}/${base} had before the push: `
      + `git log --oneline --first-parent <that sha>..HEAD, git diff --name-only <that sha>..HEAD`);
  }
  const all = (gitOut(["log", "--first-parent", "--reverse", "--format=%H", `${was}..HEAD`], tree) ?? "")
    .split("\n").filter(Boolean);
  const own = all.filter((sha) => !onlyRelease(tree, sha));
  console.log(landedLine(was, all, own, `the head this tree pushed to ${base} is `
    + `${(gitOut(["rev-parse", "HEAD"], tree) ?? "").slice(0, 7)}`));
  const moved = (gitOut(["diff", "--name-only", `${was}..HEAD`], tree) ?? "").split("\n").filter(Boolean);
  const held = moved.filter((one) => one.startsWith("plugin/hooks/") || one.startsWith("plugin/skills/"));
  if (!held.length) return console.log(`  nothing under plugin/hooks/ or plugin/skills/ moved since ${was.slice(0, 7)}`);
  console.log(`  a restart is owed before any open session trusts these ${held.length} file(s):`);
  for (const one of held) console.log(`    ${one}`);
};

/** Which sha a mark takes, and where the range naming it carries commits the count does not. */
const landedLine = (was, all, own, pushed) => {
  const tip = (own.at(-1) ?? "").slice(0, 7);
  if (!own.length) return `  this release landed ${all.length ? "nothing but the version commit" : "no commit of its own"}; ${pushed}`;
  if (own.length === 1) return `  the change landed as ${tip}; ${pushed}`;
  const range = `${was.slice(0, 7)}..${tip}`;
  return all.indexOf(own.at(-1)) === own.length - 1
    ? `  the change landed as ${own.length} commits, ${range}, of which a mark takes the last, ${tip}; ${pushed}`
    : `  the change landed as ${own.length} commits, the last of them ${tip}, which a mark takes; a `
      + `release commit sits among them, so ${range} holds more than the change; ${pushed}`;
};

const reviewedAt = (tree) => gitOut(["rev-parse", "--verify", "--quiet", REVIEWED], tree);

/** What has landed in a range, walked `--first-parent` for the reason `isRelease` reads one: off it a
 *  merge that carried a bump in from a side branch is TREESAME while the side branch's own bumps are
 *  each counted, and neither is a release of this branch. Binary is `-\t-` and has no lines to add. */
const landed = (tree, from) => {
  const bumps = (gitOut(["log", "--first-parent", "--format=%H", `${from}..HEAD`, "--", "package.json"], tree) ?? "")
    .split("\n").filter(Boolean);
  const rows = (gitOut(["diff", "--numstat", `${from}..HEAD`, "--", ...REVIEW_PATHS], tree) ?? "")
    .split("\n").filter(Boolean);
  return {
    releases: bumps.filter((sha) => isRelease(tree, sha)).length,
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
    owed: lines >= REVIEW_LINES,
    range: `${from.slice(0, 7)}..HEAD`,
    count: `${releases} release(s), ${files} file(s), ${lines} changed line(s)`,
    volume: `${files} file(s) and ${lines} changed line(s)`,
  };
};

const CLI = join(HERE, "plugin", "bin", "forge");
const CLI_MS = 60_000;
const launch = (key) => `Work ${key}. Use the Skill tool: skill forge:issue-flow, args ${key}.`;

/* The tracker through this repository's own CLI, and never through `loud`: a filing the network
   refuses is not a failed release, so what cannot be reached is returned as a reason to print. */
const forgeSays = (tree, args, input) => {
  const run = spawnSync(CLI, args, { cwd: tree, encoding: "utf8", input, timeout: CLI_MS });
  if (run.error) return { why: run.error.message, unrun: true };
  if (run.status !== 0) return { why: (run.stderr || run.stdout || `exited ${run.status}`).trim() };
  return { out: run.stdout };
};

/* The head `forge new` opens a refusal of its own shape check with: a generated body it reads as
   wrong is this repository's to fix, a tracker that did not answer the next ship's to ask (ISS-163). */
const CHECK_SAYS = "this files an issue the flow cannot carry";

const whose = (said, call) => (said.unrun ? `${CLI} could not be run` : `the tracker did not answer ${call}`);

const NOT_A_READING = "dropped";
const READ = "closed";

/** The review issue for this mark, at whatever status it has reached, or nothing: a run claims and
 *  advances its issue in its first minute, so `open` was the answer only before anybody had started
 *  (ISS-140). A dropped reading answers nothing — counted, it leaves the range an issue nobody reads
 *  and no route that files another. The filter is on the range's start, so a moved mark misses it. */
const issueFor = (tree, from) => {
  const at = from.slice(0, 7);
  const found = forgeSays(tree, ["issues", "--search", at, "--limit", "100"]);
  if (found.why) return { why: found.why, whose: whose(found, "the lookup") };
  /* The row says which issue, the issue what status: those columns grew a rank mid-batch. */
  const key = found.out.split("\n").map((line) => /^(ISS-\d+)\s+(.*)$/u.exec(line.trim()))
    .find((row) => row?.[2].includes(`${at}..`))?.[1] ?? null;
  if (!key) return { key: null, status: null };
  const said = forgeSays(tree, ["issue", key]);
  if (said.why) return { key, unread: said.why };
  const status = parsed(said.out)?.status ?? null;
  if (!status) return { key, unread: `${key} answered with no status:\n${said.out.trim()}` };
  return status === NOT_A_READING ? { key: null, status: null } : { key, status };
};

/* Never twice outranks filing promptly, so a list that does not answer files nothing either: the
   count keeps growing and the next ship reads the backlog again. */
const fileReview = (tree, from, volume) => {
  const held = issueFor(tree, from);
  if (held.why || held.key) return held;
  const to = gitOut(["rev-parse", "HEAD"], tree);
  if (!to) return { why: `${tree} has no HEAD to name as the range's end.`, whose: "this tree could not answer" };
  const title = `The batch ${from.slice(0, 7)}..${to.slice(0, 7)} is read once as a whole by a run `
    + `that wrote none of it, and the mark moves`;
  const filed = forgeSays(tree, ["new", "-", "--title", title, "--kind", "feature"],
    reviewBody({ tree, from, to, volume, self: SELF }));
  /* The refusal's own phrase, not any key: a reason quotes paths, and a worktree carries a key. Only
     this check's duplicate line writes `against <a key>`, so one carrying it is its by construction. */
  if (filed.why) {
    const collided = /against (ISS-\d+)/u.exec(filed.why)?.[1] ?? null;
    const mine = !filed.unrun && filed.why.includes(CHECK_SAYS);
    return { why: filed.why, collided, mine, whose: whose(filed, "the filing") };
  }
  const key = /"issueId":\s*"(ISS-\d+)"/u.exec(filed.out)?.[1];
  return key
    ? { key, filed: true }
    : { why: filed.out.trim(), whose: "the filing answered with no issue key" };
};

/* Beside the volume count and not on a surface of its own: both are what this run left for the next
   one to answer for, and a second place to look is a second thing to remember to read. The gate
   this release just spent wrote the newest figure, so the release is where it is freshest. */
const gateGrew = (tree) => {
  try {
    console.log(`  the gate: ${runSays(recordDir(tree))}`);
  } catch (error) {
    console.error(`  what this tree's gate runs have taken could not be read: ${error.message}`);
  }
};

/* The mark is never planted here. One planted where none was found would read exactly like a
   reading that has just finished, and the skipped reading it hid would surface at no later ship. */
const reviewOwed = (tree) => {
  const from = reviewedAt(tree);
  if (!from) return console.error(`  ${NO_MARK}`);
  const { owed, range, count, volume } = reviewSays(tree, from);
  if (!owed) {
    return console.log(`  ${count} under ${REVIEW_PATHS.join(", ")} since ${from.slice(0, 7)}, short `
      + `of the ${REVIEW_LINES} line(s) that call for a reading`);
  }
  console.log(`  a review of ${range} is owed: ${count} under ${REVIEW_PATHS.join(", ")}, at or past `
    + `${REVIEW_LINES} line(s). It is a delegated run of its own:`);
  const asked = fileReview(tree, from, volume);
  /* Read, never launched: the check collides on similarity, so the key may not be a reading. */
  if (asked.collided) {
    console.error(`  this plugin's own filing check refused the body, the tracker having answered: it `
      + `reads as ${asked.collided}: ${asked.why}`);
    console.log(`    read it:         forge issue ${asked.collided}`);
    console.log(`    it is this mark's reading under another range, or a title that only resembles `
      + `one; the refusal's own \`clear:\` line is the write it leaves open, and the count keeps `
      + `growing until one of them files`);
    return;
  }
  /* A body no person typed, so the route is this repository's and never the filing just refused. */
  if (asked.mine) {
    console.error(`  this plugin's own filing check refused the body this step generates, and named `
      + `no issue to fold it onto: ${asked.why}`);
    console.log(`    the body is ${SELF}'s own, so what the check asks for is this repository's to `
      + `write. File that: forge feedback - --title "<what the check asked the review body for>"`);
    console.log(`    the count keeps growing until the body it generates is one the check accepts`);
    return;
  }
  if (asked.unread) {
    console.error(`  ${asked.key} is this mark's reading, so nothing was filed; what could not be read `
      + `is that issue's own status: ${asked.unread}`);
    console.log(`    read it:         forge issue ${asked.key}`);
    return;
  }
  if (asked.why) {
    console.error(`  ${asked.whose}, so nothing is filed and the next ship asks again: ${asked.why}`);
    console.log(`    file its issue:  forge new - --title "review ${range}" --kind feature`);
    console.log(`    give it a tree:  ${SELF} start <that ISS-nn>`);
    console.log(`    it ends by moving the mark, finding or none: ${SELF} review --done <the range's end>`);
    return;
  }
  if (asked.status === READ) {
    return console.log(`    ${asked.key} is ${READ} for this mark and the mark never moved, so the `
      + `count keeps growing. Read it, then move the mark to the head that reading reached: `
      + `${SELF} review --done <that head>`);
  }
  console.log(asked.filed
    ? `    filed ${asked.key}`
    : `    ${asked.key} is ${asked.status} for this mark already, so nothing was filed`);
  console.log(`  ${launch(asked.key)}`);
};

/* The mark's only writer, so nothing else has to agree with it about where a reading reached. */
const review = ({ flags }) => {
  const tree = process.cwd();
  const done = flags.get("--done");
  const from = reviewedAt(tree);
  if (!flags.has("--done")) {
    if (!from) stop(NO_MARK);
    const { owed, range, count } = reviewSays(tree, from);
    console.log(`${range} is the next review's, and holds ${count} under ${REVIEW_PATHS.join(", ")}.`);
    console.log(`  git diff ${from}..HEAD -- ${REVIEW_PATHS.join(" ")}`);
    return console.log(owed
      ? `A review is owed: ${REVIEW_LINES} changed line(s) call for one, and this range is past that.`
      : `Short of the ${REVIEW_LINES} changed line(s) that call for a reading.`);
  }
  /* Refused, not reported: a mark too far forward reads like a reading that finished and grows
     nothing; the volume since it is a net diff, shrinking as later commits delete (ISS-146). */
  if (done === null && from) {
    stop(`a move of the mark names the head the reading reached, and only the first plant defaults: `
      + `other runs land on this branch while a reading is read, so this tree's HEAD is not that head. `
      + `${SELF} review --done <that head>, the end of the range the issue you were given names. Where `
      + `the reading did reach HEAD, say so: ${SELF} review --done ${gitOut(["rev-parse", "HEAD"], tree)}`);
  }
  const asked = done ?? "HEAD";
  const to = gitOut(["rev-parse", "--verify", `${asked}^{commit}`], tree);
  if (!to) stop(`\`${asked}\` is no commit in this tree, and the mark records where a reading reached.`);
  if (!from && git(["merge-base", "--is-ancestor", to, "HEAD"], tree).status !== 0) {
    stop(`${to.slice(0, 7)} is on no history reaching this tree's head, so the range it opens is not `
      + `this repository's work and the count over it would measure nothing. Name a commit this head `
      + `descends from — a tree that has not fetched is the usual reason: git -C ${tree} fetch ${REMOTE}. `
      + `Where the commit is right and this tree is not the one to read it from, plant it by hand and `
      + `say so: git update-ref ${REVIEWED} ${to.slice(0, 7)}`);
  }
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

const GATE = "the gate";

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
    [GATE, () => loud("npm", ["run", "check"], tree,
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
      /* The fast-forward itself, never `pull`: a pull under `pull.rebase` is a rebase, which refuses a
         dirty worktree even for a no-op, and runs share this checkout. Its refs are already this
         repository's own, moved by the push a step ago, so there is nothing to fetch (ISS-143). */
      loud("git", ["-C", root, "merge", "--ff-only", `${REMOTE}/${base}`], root,
        `${root} cannot fast-forward to the pushed head, and the marketplace installs from its working `
        + `tree. Read what is in the way: git -C ${root} status --short for a path the fast-forward `
        + `needs, git -C ${root} log --oneline ${REMOTE}/${base}..HEAD for a commit it holds that is not `
        + `upstream. Land that commit, or move that one path. Not \`git stash\` and not a commit of a `
        + `file this run did not write: other runs' work is open in that tree.`);
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
      releaseSays(tree, base);
      gateGrew(tree);
      reviewOwed(tree);
    }],
  ];
};

const ship = ({ flags }) => {
  const asked = flags.get("--from");
  const from = asked === undefined ? 1 : Number.parseInt(asked, 10);
  const note = flags.get("--note") ?? null;
  const tree = process.cwd();
  const root = checkoutRoot(tree);
  const base = defaultBranch(tree);
  const steps = shipSteps(tree, root, base, note);
  if (!Number.isInteger(from) || from < 1 || from > steps.length) {
    stop(`--from takes a step between 1 and ${steps.length}, not \`${asked}\`.`);
  }
  /* A resume past the gate would push a tree no gate has passed, and the run that most needs one
     is the run that edited something to get past a failed step. The gate's own record makes an
     unchanged tree cost nothing, so it is spent again rather than taken on trust. */
  const gateAt = steps.findIndex(([name]) => name === GATE);
  const order = [...steps.keys()].filter((at) => at >= from - 1);
  if (from - 1 > gateAt) order.unshift(gateAt);
  for (const at of order) {
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

const VERB_RUNS = new Map([["start", start], ["ship", ship], ["review", review]]);

const main = (argv) => {
  const [verb, ...rest] = argv;
  if (!verb || verb === "-h" || verb === "--help") return console.log(USAGE);
  if (!VERB_RUNS.has(verb)) {
    stop(`no step \`${verb}\`. It is start, ship or review; \`${SELF} -h\` says what each does.`);
  }
  const read = wanted(verb, rest, SELF);
  return read ? VERB_RUNS.get(verb)(read) : console.log(verbUsage(verb, SELF));
};

try {
  main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
