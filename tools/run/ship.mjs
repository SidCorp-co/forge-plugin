/* The release verb: the steps it spends in order, the readings it takes off the head the remote held
   before the push, what it says afterwards about the repository rather than about itself, and the
   prose `-h` prints about all of it — which travels here as every other part's does, `run.mjs` having
   outgrown one file (ISS-1654). */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkoutRoot, defaultBranch, gitOut, loud, read, REMOTE, remoteRef, revAt, stop }
  from "../checkout.mjs";
import { follows, installs as installed } from "./install.mjs";
import { recordDir, runSays } from "../gates/timing.mjs";
import { edgesLeft, fileIssue } from "../../plugin/src/tracker/filing/route.mjs";
import { refusing } from "../../plugin/src/resolve/settings.mjs";
import { firstLine } from "../../plugin/src/resolve/flags.mjs";
import { CEILINGS, climbForm, overCeiling } from "../../plugin/src/ladder.mjs";
import { REPLAYED, replaySays, replayedBy } from "./replayed.mjs";
import { cleanTree, INSTALLS, LANDS, PUSHES, pushing, runLanding, SHARED, waitMs } from "./land.mjs";
import { checkpointsFinished, keysHere } from "./ship/checkpoint.mjs";
import { onlyRelease } from "./landing.mjs";
import { CHECK, publishes } from "./publish.mjs";
import { publishesVersion, statesVersion, versionIn } from "./release/released-tag.mjs";
import { forgetBump, unwound, versionAbove } from "./release/version.mjs";
import { readingFor, readingTitle, REVIEWED, reviewBody, reviewedAt, reviewReported, reviewSays,
  spannedIn, whereFrom } from "./review.mjs";
import { hookEntries } from "../../plugin/src/hooks/log/hook-log-file.mjs";
import { typed } from "../../plugin/src/hooks/shell-spans.mjs";
import { freezesSession, FROZEN, pluginCopy } from "../../plugin/src/tools/plugin-copy.mjs";
import { releaseReadings } from "./release/readings.mjs";
import { partForLanding } from "../../plugin/src/guides/served.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SELF = `node ${join(basename(HERE), "tools", "run.mjs")}`;

/* A caller who typed `-h` asked what this does, and a configuration fault answered instead withholds
   it; this plugin's own numbers in its place would be a fallback nothing here makes (ISS-1912). */
const counting = () => {
  const declared = reviewReported();
  if (declared.refusal) {
    return [`That last step also counts what landed under the paths this project declares since ${REVIEWED},`,
      "and says one reading of the whole of it is owed once the range holds the volume it declares. Not in",
      `this checkout, whose declaration every reader of it refuses: ${declared.refusal}`];
  }
  return [`That last step also counts what landed under ${declared.paths.value.join(", ")} since ${REVIEWED}, and`,
    `says one reading of the whole of it is owed once the range holds ${declared.lines.value} changed line(s)`,
    `  ← ${whereFrom(declared)}.`];
};

/** What `-h` prints about the release, built at print time: no verb pays for a value it never asks for. */
export const shipHelp = () => [
  "What a session registered, and the skills it loaded, reach it at its next start — gate code does",
  "not, being chosen per call — so the last step says whether a restart is owed and names the set it",
  "filtered on. It says beside that what the gate run a step earlier took and how that compares with",
  "the run before it, so a release that made the gate slower is visible where a release that wrote a",
  "lot of unread code already is.",
  "",
  "The version step costs the gate's record nothing. Every step's digest is keyed on the manifests,",
  "so the commit naming a release used to leave the whole record unreadable at the one head every",
  "later branch is cut from, and a worktree holding no change paid for the whole table to re-prove",
  "content this gate had passed minutes earlier. A file a release writes a version into is now keyed",
  "on its values with that version taken out of them, so the bump moves no digest and a rebase past",
  "somebody else's release moves none either. What still moves one is a manifest that disagrees with",
  "its package about the number, and anything in those files that is not the number — a dependency",
  "added or removed spends every step, as it always did. `npm run check -- --full` reads no digest",
  "and writes no pass, so it proves a tree independently and repairs nothing; the record is dropped",
  "by removing the gate-ledger directory under the common git directory, which the gate prints.",
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
  "That same step prints the flag each of the mark's two path clauses is typed into: what this change",
  "wrote, computed over the range's commits that are the change rather than the version bump, and not",
  "earlier, because a clause answered before the version commit exists is answered about a landing",
  "that has not happened. What the landing moved of those paths is `forge record merged`'s own reading",
  "of git between the judged head and the sha a mark takes, which it checks the typed value against.",
  "",
  "The same step finishes the landing checkpoint each issue this tree was started for left, because a",
  "release is a landing and this one wrote no landing state at all: a branch its own run released read",
  "`ready` afterwards, which is the state saying a lander still owes it a first step, and `land-ready`",
  "naming no issue then found that branch and would build a candidate whose merge changes nothing. The",
  "keys come off the id `start` minted into this tree\u0027s git directory, never off the branch name, a",
  "batch being one tree under one id. Only a checkpoint reading `ready` and naming the branch this",
  "release landed is finished; every other one is named and left where it stands, as is one whose write",
  "the tracker refused, since a release already pushed and installed is no place to fail. The checkpoint",
  "is not the status: what the record earns is the run\u0027s own to advance afterwards.",
  "",
  ...counting(),
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
  "another machine, the version commit the release made for a version now taken is undone before the",
  "refusal is printed, so the tree a caller rebases holds only the change; a commit this run did not",
  "make whole, or a tree with uncommitted work in it, is left exactly where it is and the refusal",
  "says so.",
];

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
    console.error(`  no ${MARK} in this tree's git directory, so the sha this change landed `
      + `as cannot be named and what this release moved is unknown; no session may be told it is `
      + `safe. Read both against the head ${REMOTE}/${base} had before the push: `
      + `git log --oneline --first-parent <that sha>..HEAD, git diff --name-only <that sha>..HEAD`);
    return null;
  }
  const all = (gitOut(["log", "--first-parent", "--reverse", "--format=%H", `${was}..HEAD`], tree) ?? "")
    .split("\n").filter(Boolean);
  const own = all.filter((sha) => !onlyRelease(tree, sha));
  console.log(landedLine(was, all, own, `the head this tree pushed to ${base} is `
    + `${(gitOut(["rev-parse", "HEAD"], tree) ?? "").slice(0, 7)}`));
  const moved = (gitOut(["diff", "--name-only", `${was}..HEAD`], tree) ?? "").split("\n").filter(Boolean);
  clauseFlags(tree, own);
  const held = moved.filter(freezesSession);
  if (held.length) {
    const why = reasonsGiven();
    console.log(`  a restart is owed before any open session trusts these ${held.length} file(s):`);
    for (const one of held) console.log(`    ${one} — ${why.get(one) ?? "no reason recorded at the write"}`);
  } else {
    console.log(`  nothing a session is frozen on moved since ${was.slice(0, 7)}`
      + ` — the set is ${FROZEN.join(", ")}`);
  }
  return own.at(-1) ?? null;
};

/** The flags that write the merged mark's two path clauses, printed at the step that knows what landed —
 *  the flags and not the clauses, whose wording a run typed whole into the value (ISS-1023). By commit and
 *  not by filename: a dependency lives in the manifest a bump also writes. Both here and neither earlier,
 *  a clause answered before the version commit exists being about a landing that has not happened (ISS-1896). */
const clauseFlags = (tree, own) => {
  const wrote = new Set();
  for (const sha of own) {
    for (const one of (gitOut(["diff", "--name-only", `${sha}^`, sha], tree) ?? "").split("\n").filter(Boolean)) wrote.add(one);
  }
  const said = [...wrote].sort();
  const landed = own.at(-1) ?? null;
  console.log("  the clause of the mark's note that says what this change wrote, which `developed` "
    + "reads against the plan, is written by this flag:");
  console.log(`    --wrote ${said.length ? typed(said.join(", ")) : "nothing"}`);
  console.log("  and the clause that says what the landing moved of this change, which is what lets the "
    + "verdicts stand at the head they were taken at, by --moved: `forge record merged` reads it from "
    + `git itself, as the paths above whose bytes differ between --judged and --at${landed
      ? ` ${landed.slice(0, 7)}` : ""}, and refuses any other value, naming the one it read. The replay `
    + "step proved the base moved none of those paths, so for verdicts taken at the head this ship "
    + "rebased that reading is:");
  console.log("    --moved nothing");
  console.log("  type each flag and its value whole, any quotes on it being the shell's: the note is built "
    + "to the room the tracker gives it, and one too long to store leaves out paths the plan names "
    + "and says so in a clause of its own");
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

export const named = () => ({
  market: read(join(HERE, ".claude-plugin", "marketplace.json"))?.name,
  plugin: read(join(HERE, "plugin", ".claude-plugin", "plugin.json"))?.name,
});

const GATE = "the gate";

const shipSteps = (tree, root, base, note) => {
  const { market, plugin } = named();
  if (!market || !plugin) stop("this checkout names no marketplace or no plugin, so there is nothing to install.");
  const push = `push to ${REMOTE}/${base}`;
  const install = `install ${plugin}@${market} from the tree that shipped`;
  const fetching = `fetch ${REMOTE}/${base}`;
  const resume = () => `Resume the release at its push step, where the branch push is a no-op and `
    + `this is retried: ${SELF} ship --from ${rows.findIndex(([one]) => one === push) + 1}`;
  /* The last step and not the push: what this one clears is a tracker write, and a resume onto the
     push would spend the whole release again to reach it. The install's own is named beside it,
     that being the step a checkpoint left standing for want of an install is waiting on. */
  const again = () => `${SELF} ship --from ${rows.length}`;
  const installs = () => `${SELF} ship --from ${rows.findIndex(([one]) => one === install) + 1}`;
  /* The release from the fetch, which every refusal naming a re-release points at. Off the table
     rather than typed where it is printed: a step that carries its own number is the drift this
     file's own step count already paid for once (ISS-671). */
  const step = (name) => rows.findIndex(([one]) => one === name) + 1;
  const releases = () => `${SELF} ship --from ${step(fetching)}`;
  const rows = [
    ["the tree is clean", () => cleanTree(tree)],
    [fetching, () => {
      loud("git", ["fetch", REMOTE, base], tree, "Check the remote is reachable.");
      writeFileSync(markFile(tree), `${revAt(tree, remoteRef(base))}\n`);
    }, LANDS],
    [REPLAYED, () => replaySays(tree, base, SELF), LANDS],
    [`rebase onto ${REMOTE}/${base}`, () => {
      const from = gitOut(["rev-parse", "HEAD"], tree);
      loud("git", ["rebase", remoteRef(base)], tree, "Resolve it, or `git rebase --abort`.");
      replayedBy(tree, from);
    }, LANDS],
    /* After the rebase, the range being what the release ships, so the gate judges the content that goes out. Where it sits relative to the bump decides nothing now: a release's own version is no part of a step's digest (ISS-1716). */
    [GATE, () => loud("npm", CHECK, tree,
      "Fix the tree and ship again; a release ships what a gate has passed, and nothing after this step has run."), LANDS],
    [`a version above ${REMOTE}/${base}`,
      () => versionAbove(tree, base, note), LANDS],
    [push, () => {
      /* Read and judged before the push, not after: a version that cannot be read here is the same
         failed manifest join every other site meets, and a tree that cannot say what it is about to
         publish does not push a branch and then decline to tag it (ISS-2025). Past this point
         `publishesVersion`'s own refusal is the accurate one — the branch already on the remote. */
      const version = versionIn(tree);
      if (!version) {
        stop(`this tree's package.json names no version to publish, read from `
          + `${join(tree, "package.json")}. Nothing is pushed.`);
      }
      pushing(tree, base, () => `Rejected means the remote moved${unwound(tree)}. A lost race is `
        + `not a stale review: whether the review still stands turns on whether that landing wrote any `
        + `of this change's own paths, and step ${step(REPLAYED)} of the resume prints both sets and `
        + `judges it. Where the landing wrote none, the review stands at the head the resume's own `
        + `rebase makes and the resume is the whole remedy; where it wrote one, that step refuses naming `
        + `it, and a read at the new head is owed before the push. Rebase nothing by hand first: a replay `
        + `the ship did not make takes the reviewed head off the lineage that step accepts. The resume: ${releases()}`);
      forgetBump(tree);
      publishesVersion(tree, gitOut(["rev-parse", "HEAD"], tree), version, resume());
    }, PUSHES],
    ["the checkout follows", () => follows(root, base, tree)],
    [install, () => installed({ tree, root, base, market, plugin, again: installs(), release: releases() }), INSTALLS],
    ["the copy the next session loads", async () => {
      const copy = pluginCopy(join(tree, "plugin"));
      console.log(copy
        ? `  ${copy.name} ${copy.running} running, ${copy.installed} installed${copy.stale ? " — this version is in no install record" : ""}`
        : "  no install record answers for this plugin");
      statesVersion(tree, gitOut(["rev-parse", "HEAD"], tree), versionIn(tree), resume());
      const landed = releaseSays(tree, base);
      const was = shipFrom(tree);
      if (landed) tierCeiling(tree, was, landed);
      gateGrew(tree);
      await reviewOwed(tree);
      publishes(tree, base, copy?.installed);
      await releaseReadings(root, { version: copy?.installed, head: gitOut(["rev-parse", "HEAD"], tree),
        issues: keysHere(tree) });
      await checkpointsFinished({ tree, base, copy, resume: again(), installs: installs(), ships: SELF + " ship" });
      /* Inside the step and not after the whole run, so a `--from 9` resume carries it too. */
      partForLanding((phase) => console.log(`\n${phase}`));
    }],
  ];
  return rows;
};

export const NO_MARK = (self) => `no ${REVIEWED} in this repository, so what is owed a reading cannot `
  + `be counted. The first review reads from the release that introduced this rule: `
  + `${self} review --done <that release>.`;

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

const READ = "closed";

/* Never twice outranks filing promptly, so a lookup that could not read the backlog whole files
   nothing either. Both halves run in process and inside `refusing`: the answer is three-valued and a
   page cut to a printed limit cannot say which, and a release is mid-flight here (ISS-1887). */
const fileReview = async (tree, from, volume) => {
  const held = await refusing(() => readingFor(from)).catch((error) => ({ short: error.message }));
  if (held.short || held.key) return held;
  const to = gitOut(["rev-parse", "HEAD"], tree);
  if (!to) return { why: `${tree} has no HEAD to name as the range's end.`, whose: "this tree could not answer" };
  const filed = await refusing(() => fileIssue({
    title: readingTitle(from, to),
    body: reviewBody({ tree, from, to, volume }),
    kind: "review",
    relateKeys: spannedIn(tree, from),
    /* Off deliberately and only here, the identity being the range, which the lookup above answered
       exactly: the measure drops the two short hashes that are all two readings' titles differ in,
       so it reads each reading as the one before it and refuses the filing. docs/cli/filing.md. */
    duplicates: false,
    soft: true,
  })).catch((error) => ({ threw: error }));
  if (filed.threw) return heldBy(from, { why: filed.threw.message, whose: "the filing could not be made" });
  if (filed.refusal) return { why: filed.refusal.text, mine: filed.refusal.mine, whose: "this plugin refused the filing" };
  if (filed.answer?.refused) return heldBy(from, { why: filed.answer.refused, whose: whose({}, "the filing") });
  const key = filed.joined?.issueId ?? filed.answer?.issueId ?? null;
  return key
    ? reconciled(tree, from, key, filed.related)
    : { why: JSON.stringify(filed.answer ?? null), whose: "the filing answered with no issue key" };
};

const reread = (from) => refusing(() => readingFor(from, { again: true })).catch((error) => ({ short: error.message }));

/* A create the tracker turned back may be the tracker refusing a second row for this mark, in words
   this step cannot parse: a row found now is the issue already being there, whoever filed it. */
const heldBy = async (from, failed) => {
  const now = await reread(from);
  return now.key ? now : failed;
};

const dropWhy = (first, mark) => `${first} was filed first for the mark ${mark.slice(0, 7)} and `
  + "holds its reading; this is a second row a ship crossing the same mark filed in the same window";

/* An empty lookup and the create after it are a window two ships can cross together, and no lock
   closes it that a crashed ship could not leave standing. So the mark is read again once this row
   exists: the first filed holds it, and the ship that filed later drops its own, the later create
   being the one whose read comes after both (ISS-133). */
const reconciled = async (tree, from, key, related) => {
  const after = await reread(from);
  if (after.short) return { key, filed: true, related, unchecked: after.short };
  if (!after.key || after.key === key) return { key, filed: true, related, ...(after.cut ? { unchecked: after.cut } : {}) };
  const why = dropWhy(after.key, from);
  const dropped = forgeSays(tree, ["advance", key, "--drop", "--why", why]);
  return { key: after.key, status: after.status, second: key,
    undropped: dropped.why ? { said: dropped.why, command: `forge advance ${key} --drop --why '${why}'` } : null };
};

/* Beside the volume count: the gate this release just spent wrote the newest figure there is. */
const gateGrew = (tree) => {
  try {
    console.log(`  the gate: ${runSays(recordDir(tree))}`);
  } catch (error) {
    console.error(`  what this tree's gate runs have taken could not be read: ${error.message}`);
  }
};

/* The backstop and never the decision, contained whole: why it is silent rather than loud and why
   `at` is the sha the change landed as are docs/cli/the-ladder.md's. */
const BRANCH_KEY = /^iss-(\d+)/u;

const tierCeiling = (tree, was, at) => {
  try {
    const key = BRANCH_KEY.exec(gitOut(["rev-parse", "--abbrev-ref", "HEAD"], tree) ?? "")?.[1];
    if (!key) return undefined;
    const ref = `ISS-${key}`;
    const said = forgeSays(tree, ["resume", ref, "--json"]);
    if (said.why) return undefined;
    /* Parsed, never matched: JSON escapes newlines. `null` parses; anything worse takes the catch. */
    const body = JSON.parse(said.out);
    if (!body || typeof body !== "object") return undefined;
    /* An own string key of the table and nothing an object inherits: `CEILINGS.constructor` is
       truthy and has no figures, so a rung nobody set would print a ceiling of undefined. */
    const rung = body.rung;
    const ceiling = typeof rung === "string" && Object.hasOwn(CEILINGS, rung) ? CEILINGS[rung] : null;
    if (!ceiling) return undefined;
    const rows = (gitOut(["diff", "--numstat", `${was}..${at}`], tree) ?? "").split("\n").filter(Boolean);
    const each = (row) => row.split("\t").slice(0, 2).reduce((part, one) => part + (Number.parseInt(one, 10) || 0), 0);
    const landed = { files: rows.length, lines: rows.reduce((sum, row) => sum + each(row), 0) };
    const line = `  ${ref} is a \`${rung}\` and landed ${landed.files} file(s) and `
      + `${landed.lines} changed line(s), against that rung's ceiling of ${ceiling.files} and ${ceiling.lines}`;
    const over = overCeiling(rung, landed);
    if (!over) return console.log(line);
    console.error(`${line} — past it on ${over.join(" and ")}`);
    return console.error("    a landing larger than its rung owes a correction naming the climb, and the "
      + `rung's skipped obligations are earned before the close:\n      ${climbForm(ref, rung)}`);
  } catch {
    return undefined;
  }
};

const secondRow = ({ key, status, second, undropped }) => {
  console.log(`    ${key} is ${status} for this mark already, filed by another ship in the window this `
    + `one filed ${second} in`);
  if (!undropped) return console.log(`    ${second} is dropped, so one row holds this mark`);
  console.error(`    ${second} is a second row for this mark and dropping it failed: ${firstLine(undropped.said)}`);
  return console.log(`    drop it: ${undropped.command}`);
};

const reviewOwed = async (tree) => {
  const from = reviewedAt(tree);
  if (!from) return console.error(`  ${NO_MARK(SELF)}`);
  const said = reviewSays(tree, from);
  if (said.refusal) return console.error(`  ${said.refusal}`);
  const { owed, range, count, volume, threshold, paths, source } = said;
  if (!owed) {
    return console.log(`  ${count} under ${paths.join(", ")} since ${from.slice(0, 7)}, short `
      + `of the ${threshold} line(s) that call for a reading  ← ${source}`);
  }
  console.log(`  a review of ${range} is owed: ${count} under ${paths.join(", ")}, at or past `
    + `${threshold} line(s)  ← ${source}. It is a delegated run of its own:`);
  const asked = await fileReview(tree, from, volume);
  /* The one answer that is neither a row nor an absence: a second row for one range is what the
     lookup alone now stands between, so a lookup that read part of the backlog files nothing. */
  if (asked.short) {
    console.error(`  whether an issue already holds this reading is unread, so nothing was filed and `
      + `a second row for one range is not risked: ${firstLine(asked.short)}`);
    console.log(`    read it yourself: forge issue --search ${from.slice(0, 7)}`);
    console.log(`    the count keeps growing until that read comes back whole`);
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
  if (asked.second) secondRow(asked);
  else {
    console.log(asked.filed
      ? `    filed ${asked.key}`
      : `    ${asked.key} is ${asked.status} for this mark already, so nothing was filed`);
  }
  if (asked.unchecked) {
    console.error(`    whether another ship filed this mark's reading in the same window is unread, so `
      + `${asked.key} stands: ${firstLine(asked.unchecked)}`);
    console.log(`    read it yourself: forge issue --search ${from.slice(0, 7)}`);
  }
  const left = edgesLeft(asked.related);
  if (left) console.log(`    the range named more than the filing relates: ${left}`);
  console.log(`  ${launch(asked.key)}`);
};

export const ship = async ({ flags }) => {
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
     unchanged tree cost nothing, so it is spent again rather than taken on trust. The replay check
     goes back the same way and ahead of it, so `--from` is no way past a read nobody took and a
     refusal there costs no gate — but only while the resume can still reach the push, since past it
     there is no head left to protect and a sibling's landing would refuse the release's own
     reporting (ISS-962). */
  const at = (name) => steps.findIndex(([one]) => one === name);
  const pushes = steps.findLastIndex(([, , role]) => role === PUSHES);
  const owed = [...(from - 1 <= pushes ? [at(REPLAYED)] : []), at(GATE)];
  const order = [...owed.filter((one) => from - 1 > one), ...[...steps.keys()].filter((one) => one >= from - 1)];
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
