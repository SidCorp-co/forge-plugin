#!/usr/bin/env node
/* One home for the procedure a change goes through outside its own diff. A prompt carrying it is a
   copy with nothing to fail when it ages past the tree, and four of the lines sixteen runs obeyed
   were workarounds for defects closed three releases earlier (ISS-79). */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hookEntries } from "../plugin/src/hooks/hook-log-file.mjs";
import { freezesSession, FROZEN, pluginCopy } from "../plugin/src/tools/plugin-copy.mjs";
import { checkoutRoot, defaultBranch, git, gitOut, loud, parsed, read, REMOTE, Stop, stop } from "./checkout.mjs";
import { recordDir, runSays } from "./gates/timing.mjs";
import { flagLines, VERBS, verbUsage, wanted } from "./run/args.mjs";
import { follows, installs, LINKED } from "./run/install.mjs";
import { cleanTree, INSTALLS, land, LANDS, PUSHES, pushing, runLanding, SHARED, waitMs } from "./run/land.mjs";
import { landReady } from "./run/land-ready.mjs";
import { isRelease, onlyRelease } from "./run/landing.mjs";
import { forgetBump, unwound, versionAbove } from "./run/version.mjs";
import { occupied } from "./run/occupant.mjs";
import { mintRunId, RUN_ID_VAR } from "./run/run-id.mjs";
import { markRefused, REVIEWED, REVIEW_PATHS, reviewBody, reviewLines, spannedIn } from "./run/review.mjs";
import { edgesLeft, fileIssue } from "../plugin/src/tracker/filing/route.mjs";
import { runsMark } from "../plugin/src/stats/eval.mjs";
import { refusing } from "../plugin/src/resolve/settings.mjs";
import { CEILINGS, overCeiling, resizeForm, tierOf } from "../plugin/src/ladder.mjs";
import { partForLanding } from "../plugin/src/guides/served.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = `node ${join(basename(HERE), "tools", "run.mjs")}`;

/* Each delegated run reviews its own diff and stops there, so a helper two of them each wrote, or a
   parameter one stopped passing, is inside no run's range and found by nobody (ISS-95). The reading
   that spans them is owed by this count, and what one owes is `run/review.mjs`'s. */
const NO_MARK = `no ${REVIEWED} in this repository, so what is owed a reading cannot be counted. `
  + `The first review reads from the release that introduced this rule: ${SELF} review --done <that release>.`;

const sig = (verb) => VERBS.get(verb).signature;

const usage = () => [
  `Usage: ${SELF} <start|ship|land|land-ready|review> [args]`,
  "The repository's own steps around one change: the worktree a run works in, and the release that",
  "puts its commit in the plugin copy the next session loads. Everything else is the change itself.",
  "",
  `  ${sig("start")}   add the worktree beside this checkout, link both node_modules, and`,
  "                          print the wrapper a probe of the change must invoke",
  `  ${sig("ship")}`,
  "                          clean tree, fetch, rebase, `npm run check`, a version above the remote",
  "                          head, push, the checkout offered that head, the marketplace and the",
  "                          plugin installed from the tree that shipped, then the installed copy",
  "                          named, the sha the change landed as, and every file of it a session",
  "                          cannot pick up without restarting",
  `  ${sig("land")}         land a commit that is not a release: clean tree, fetch, rebase, push,`,
  "                          under the same lock the ship takes and nothing else of it. It spends no",
  "                          gate and raises no version, so what it pushes is the caller's judgement",
  "                          and the installed plugin copy is untouched. It is the checkout's own",
  "                          verb — a wave's journal entry, not a run's change, which is a release",
  `  ${sig("land-ready")}`,
  "                          land the branches a build left ready as one candidate: the base head",
  "                          pinned by ls-remote, the branches merged onto it in the order named as",
  "                          one chain of candidate commits, each change's own paths proved unmoved",
  "                          by it, then one gate, one version above the pin, one push against that",
  "                          pin, one install, and the merged mark and statuses each issue's own",
  "                          record earns. It edits no run's tree and repairs no conflict: a conflict",
  "                          parks the issue, a moved path hands that branch back to the run that",
  "                          built it, and a candidate the gate refuses is landed one branch at a",
  "                          time rather than searched for a subset. Where the landing is is each",
  "                          issue's checkpoint, so a second run finishes what is owed and needs no",
  "                          step number",
  `  ${sig("review")}   the range the next review reads, or --done to move the mark to it`,
  "",
  ...flagLines([...VERBS.values()].flatMap((one) => one.flags)),
  "",
  "ship stops at the first failure and writes nothing past it, and a resume past the gate spends",
  "the gate first, so nothing that pushes runs against a tree no gate has passed. What a session",
  "registered, and the skills it loaded, reach it at its next start — gate code does not, being chosen",
  "per call — so the last step says whether a restart is owed and names the set it filtered on. It",
  "says beside that what the gate run a step earlier took and how that compares with the run before",
  "it, so a release that made the gate slower is visible where a release that wrote a lot of unread",
  "code already is.",
  "",
  "The install reads the tree that shipped. The marketplace installs from one registered directory,",
  "so a release used to have to move the shared checkout to the pushed head before it could install,",
  "and any commit a session left unpushed there stopped every other worktree's ship — after its push,",
  "leaving the remote a version ahead of the cache. So the step that offers the checkout that head",
  "reports rather than stops, naming each commit in the way, whose it is, what it touches, the",
  "uncommitted paths and the head the checkout stays at, none of which the blocked run may move. The",
  "install step then points the marketplace at this worktree for the length of the install, prints",
  "the one command that puts the registration back before it moves it, and puts it back itself. Where",
  "the checkout is already at the pushed head with nothing uncommitted under plugin or",
  ".claude-plugin, the source is the checkout and no registration is written at all. Either way the",
  "step ends by reading the install record, and refuses with both numbers where the cache does not",
  "hold the version the tree that shipped carries.",
  "",
  "It names beside those the sha the change landed as, which is not the pushed head the push printed:",
  "the rebase rewrote the commit the run reviewed and the version commit sits above it, so a mark that",
  "is about the change rather than about the release reads its sha from there and not off a log by eye.",
  "",
  `That last step also counts what landed under ${REVIEW_PATHS.join(", ")} since ${REVIEWED}, and`,
  `says one reading of the whole of it is owed once the range holds ${reviewLines()} changed line(s).`,
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
  "",
  "One landing at a time: from the fetch to the last step that moves what the checkout shares, a",
  "landing holds a lock every worktree of this checkout shares, so a sibling's landing cannot move the",
  "branch under a gate run and the rebase is taken once, against a head nobody else is moving. It says",
  "whose landing it waits behind, waits on a notification rather than a poll, and for a ship holds it",
  "past the push and through the install: two releases installing at once would leave the cache holding",
  "whichever finished last while the remote holds whichever pushed last. A `land` makes no install and",
  "drops it at its push.",
  "It is one lock and both landing verbs take it, so a `land` from the checkout waits behind a ship in",
  "a worktree and a ship waits behind it: a push that took no lock is what put a rejected push in the",
  "middle of a run's release. A lock a killed landing left is named with the one command that removes",
  "it, and never taken over silently. Where a ship's push is rejected anyway, by a landing from",
  "another machine, the version commit",
  "step 5 made for a version now taken is undone before the refusal is printed, so the tree a caller",
  "rebases holds only the change; a commit this run did not make whole, or a tree with uncommitted",
  "work in it, is left exactly where it is and the refusal says so.",
].join("\n");

const worktreePath = (root, key) => join(dirname(root), `wt-${key}`);

const start = ({ words: [given, slug] }) => {
  const key = String(given ?? "").toUpperCase();
  if (!/^ISS-\d+$/u.test(key)) stop(`start takes the issue key it works, \`ISS-nn\`, not \`${given ?? ""}\`.`);
  const root = checkoutRoot(HERE);
  const path = worktreePath(root, key);
  if (existsSync(path)) stop(occupied(root, path));
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
  console.log(`This run's own lease holder, which its every forge call carries — without it the run`);
  console.log(`writes under the dispatching session's id, which every agent of a wave shares:`);
  console.log(`  ${RUN_ID_VAR}=${mintRunId(path, key)}`);
  console.log(`Probe the change with this tree's own wrapper, never the one on PATH:`);
  console.log(`  ${join(path, "plugin", "bin", "forge")} <args>`);
  console.log(`  node ${join(path, "plugin", "hooks", "entries")}/<gate>.mjs   one gate, alone`);
  console.log(`Ship it from that tree: ${SELF} ship`);
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
  wroteLine(tree, own);
  const held = moved.filter(freezesSession);
  if (!held.length) return console.log(`  nothing a session is frozen on moved since ${was.slice(0, 7)}`
    + ` — the set is ${FROZEN.join(", ")}`);
  const why = reasonsGiven();
  console.log(`  a restart is owed before any open session trusts these ${held.length} file(s):`);
  for (const one of held) console.log(`    ${one} — ${why.get(one) ?? "no reason recorded at the write"}`);
};

/** The clause the merged mark's note carries about this change's own files, printed at the step that
 *  knows them: `developed` reads it back against the plan. By commit and not by filename — a
 *  dependency this change added lives in the manifest a release bump also writes. */
const wroteLine = (tree, own) => {
  const wrote = new Set();
  for (const sha of own) {
    for (const one of (gitOut(["diff", "--name-only", `${sha}^`, sha], tree) ?? "").split("\n").filter(Boolean)) wrote.add(one);
  }
  const said = [...wrote].sort();
  console.log(`  the mark's note says what this change wrote, which \`developed\` reads against the plan:`);
  console.log(`    landing wrote ${said.length ? said.join(", ") : "nothing"}`);
  console.log(`  type that clause whole: the note is built to the room the tracker gives it, and one `
    + `too long to store leaves out paths the plan names and says so in a clause of its own`);
};

/** Why each frozen file had to move, as the gate that held the write recorded it. Read here because
 *  this is where the cost lands; the latest answer wins, a file with none says so. */
const reasonsGiven = () => {
  const said = new Map();
  for (const one of hookEntries()) {
    if (one.hook === "restart-owed" && one.decision === "note" && one.target) said.set(one.target, one.reason);
  }
  return said;
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
    owed: lines >= reviewLines(),
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

const whose = (said, call) => (said.unrun ? `${CLI} could not be run` : `the tracker did not answer ${call}`);

const NOT_A_READING = "dropped";
const READ = "closed";

/** The review issue for this mark, at whatever status it has reached, or nothing: a run claims and
 *  advances its issue in its first minute, so `open` was the answer only before anybody had started
 *  (ISS-140). A dropped reading answers nothing — counted, it leaves the range an issue nobody reads
 *  and no route that files another. The filter is on the range's start, so a moved mark misses it. */
const issueFor = (tree, from) => {
  const at = from.slice(0, 7);
  const found = forgeSays(tree, ["issue", "--search", at, "--limit", "100"]);
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
   count keeps growing and the next ship reads the backlog again. The filing itself is in-process:
   whether the body collided or was this repository's own to fix is what `fileIssue` returns, and a
   release step reading it off another process's stdout read a paragraph written for a person. */
const fileReview = async (tree, from, volume) => {
  const held = issueFor(tree, from);
  if (held.why || held.key) return held;
  const to = gitOut(["rev-parse", "HEAD"], tree);
  if (!to) return { why: `${tree} has no HEAD to name as the range's end.`, whose: "this tree could not answer" };
  const title = `The batch ${from.slice(0, 7)}..${to.slice(0, 7)} is read once as a whole by a run `
    + `that wrote none of it, and the mark moves`;
  /* Inside `refusing`, so a credential or a transport this CLI would exit over comes back here: a
     release is mid-flight at this point and nothing about a filing may end it. */
  /* Keys off the commit subjects, never the body, which cites the issues that shaped this step. */
  const filed = await refusing(() => fileIssue({
    title,
    body: reviewBody({ tree, from, to, volume, self: SELF }),
    kind: "review",
    relateKeys: spannedIn(tree, from),
    soft: true,
  })).catch((error) => ({ threw: error }));
  if (filed.threw) return { why: filed.threw.message, whose: "the filing could not be made" };
  if (filed.refusal) {
    return { why: filed.refusal.text, collided: filed.refusal.collided, mine: filed.refusal.mine,
      whose: "this plugin refused the filing" };
  }
  if (filed.answer?.refused) return { why: filed.answer.refused, whose: whose({}, "the filing") };
  const key = filed.joined?.issueId ?? filed.answer?.issueId ?? null;
  return key
    ? { key, filed: true, related: filed.related }
    : { why: JSON.stringify(filed.answer ?? null), whose: "the filing answered with no issue key" };
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

/* The backstop, never the decision, and contained whole: what it prints and why it refuses nothing,
   why it is silent rather than loud on a doubtful read, and why the loss in that read only ever
   tightens it, are docs/cli/the-ladder.md's. The rung comes off the issue the branch names. */
const BRANCH_KEY = /^iss-(\d+)/u;

const tierCeiling = (tree, was) => {
  try {
    const key = BRANCH_KEY.exec(gitOut(["rev-parse", "--abbrev-ref", "HEAD"], tree) ?? "")?.[1];
    if (!key) return undefined;
    const ref = `ISS-${key}`;
    const said = forgeSays(tree, ["issue", ref, "--fields", "complexity,plan"]);
    if (said.why) return undefined;
    /* Parsed, never matched: JSON escapes newlines. `null` parses; anything worse takes the catch. */
    const body = JSON.parse(said.out);
    if (!body || typeof body !== "object") return undefined;
    /* One string: every climb on it is a climb, whichever record carried it, and only the latest. */
    const page = forgeSays(tree, ["resume", ref, "--report"]);
    const size = { band: body.complexity, plan: body.plan, whole: true, moved: page.why ? [] : [page.out] };
    const tier = tierOf(size), ceiling = CEILINGS[tier];
    if (!ceiling) return undefined;
    const rows = (gitOut(["diff", "--numstat", `${was}..HEAD`], tree) ?? "").split("\n").filter(Boolean);
    const each = (row) => row.split("\t").slice(0, 2).reduce((part, one) => part + (Number.parseInt(one, 10) || 0), 0);
    const landed = { files: rows.length, lines: rows.reduce((sum, row) => sum + each(row), 0) };
    const line = `  ${ref} is a \`${tier}\` and landed ${landed.files} file(s) and `
      + `${landed.lines} changed line(s), against that tier's ceiling of ${ceiling.files} and ${ceiling.lines}`;
    const over = overCeiling(tier, landed);
    if (!over) return console.log(line);
    console.error(`${line} — past it on ${over.join(" and ")}`);
    return console.error("    a landing larger than its tier owes a correction naming the re-size, and the "
      + `tier's skipped obligations are earned before the close:\n      ${resizeForm(ref, tier)}`);
  } catch {
    return undefined;
  }
};

/* The mark is never planted here. One planted where none was found would read exactly like a
   reading that has just finished, and the skipped reading it hid would surface at no later ship. */
const reviewOwed = async (tree) => {
  const from = reviewedAt(tree);
  if (!from) return console.error(`  ${NO_MARK}`);
  const { owed, range, count, volume } = reviewSays(tree, from);
  if (!owed) {
    return console.log(`  ${count} under ${REVIEW_PATHS.join(", ")} since ${from.slice(0, 7)}, short `
      + `of the ${reviewLines()} line(s) that call for a reading`);
  }
  console.log(`  a review of ${range} is owed: ${count} under ${REVIEW_PATHS.join(", ")}, at or past `
    + `${reviewLines()} line(s). It is a delegated run of its own:`);
  const asked = await fileReview(tree, from, volume);
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
    console.log(`    file its issue:  forge new - --title "review ${range}" --category review`);
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
  const left = edgesLeft(asked.related);
  if (left) console.log(`    the range named more than the filing relates: ${left}`);
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
      ? `A review is owed: ${reviewLines()} changed line(s) call for one, and this range is past that.`
      : `Short of the ${reviewLines()} changed line(s) that call for a reading.`);
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
  const reaches = git(["merge-base", "--is-ancestor", to, "HEAD"], tree).status === 0;
  const forward = !from || git(["merge-base", "--is-ancestor", from, to], tree).status === 0;
  if (!reaches || !forward) stop(markRefused({ tree, from, to, reaches, forward, self: SELF }));
  /* Two worktrees share this ref: without the old value, the second to finish drops the first's range. */
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
    }, LANDS],
    [`rebase onto ${REMOTE}/${base}`, () =>
      loud("git", ["rebase", `${REMOTE}/${base}`], tree, `Resolve it, or \`git rebase --abort\`, then ${SELF} ship --from 3`), LANDS],
    /* After the rebase, because the range is what the release actually ships, and before the bump,
       because the gate's record is keyed on the manifests too: run it after and every release pays
       for a whole gate over a change of one version string. */
    [GATE, () => loud("npm", ["run", "check"], tree,
      "Fix the tree and ship again; a release ships what a gate has passed, and nothing after this step has run."), LANDS],
    [`a version above ${REMOTE}/${base}`, () => versionAbove(tree, base, note), LANDS],
    [`push to ${REMOTE}/${base}`, () => {
      pushing(tree, base, () => `Rejected means the remote `
        + `moved${unwound(tree)}: rebase, re-run the review of the rebased head, then ${SELF} ship --from 2`);
      forgetBump(tree);
    }, PUSHES],
    ["the checkout follows", () => follows(root, base, tree)],
    [`install ${plugin}@${market} from the tree that shipped`, () =>
      installs({ tree, root, base, market, plugin, self: SELF }), INSTALLS],
    ["the copy the next session loads", async () => {
      const copy = pluginCopy(join(tree, "plugin"));
      console.log(copy
        ? `  ${copy.name} ${copy.running} running, ${copy.installed} installed${copy.stale ? " — this version is in no install record" : ""}`
        : "  no install record answers for this plugin");
      releaseSays(tree, base);
      const was = shipFrom(tree);
      if (was) tierCeiling(tree, was);
      gateGrew(tree);
      await reviewOwed(tree);
      const mark = runsMark(root);
      if (mark) console.log(`  ${mark}`);
      /* Inside the step and not after the whole run, so a `--from 9` resume carries it too. */
      partForLanding((phase) => console.log(`\n${phase}`));
    }],
  ];
};

const ship = async ({ flags }) => {
  const asked = flags.get("--from");
  const from = asked === undefined ? 1 : Number.parseInt(asked, 10);
  const note = flags.get("--note") ?? null;
  const ms = waitMs(flags);
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
  /* Taken only where this run will move what the checkout shares — its branch, or the registration
     an install reads. A resume aimed past both spends the gate again, and holding the branch through
     that would block every sibling for a landing nobody makes. */
  const lands = order.some((at) => SHARED.has(steps[at][2])) ? (at) => Boolean(steps[at][2]) : () => false;
  const whole = await runLanding(steps, order, tree, {
    ms,
    held: lands,
    again: (at) => `Resume from there: ${SELF} ship --from ${at + 1}`,
  });
  if (!whole) return;
  console.log(`\nReleased. Verify the change against the installed copy by its own path, not \`forge\` on PATH.`);
};

const VERB_RUNS = new Map([["start", start], ["ship", ship],
  ["land", (read) => land(read, SELF)],
  ["land-ready", (read) => landReady(read, { ...named(), root: HERE, base: defaultBranch(HERE), self: SELF })],
  ["review", review]]);

const main = (argv) => {
  const [verb, ...rest] = argv;
  if (!verb || verb === "-h" || verb === "--help") return console.log(usage());
  if (!VERB_RUNS.has(verb)) {
    stop(`no step \`${verb}\`. It is ${[...VERB_RUNS.keys()].join(", ")}; \`${SELF} -h\` says what each does.`);
  }
  const read = wanted(verb, rest, SELF);
  return read ? VERB_RUNS.get(verb)(read) : console.log(verbUsage(verb, SELF));
};

/* Awaited: one step files in-process, so a `Stop` raised past the first await would land on nobody. */
try {
  await main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
