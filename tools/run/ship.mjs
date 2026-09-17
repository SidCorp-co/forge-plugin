/* The release verb: the steps it spends in order, the readings it takes off the head the remote held
   before the push, what it says afterwards about the repository rather than about itself, and the
   prose `-h` prints about all of it — which travels here as every other part's does, `run.mjs` having
   outgrown one file (ISS-1654). */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkoutRoot, defaultBranch, gitOut, loud, parsed, read, REMOTE, remoteRef, revAt, stop }
  from "../checkout.mjs";
import { acrossVersion } from "../gates/carried.mjs";
import { follows, installs as installed } from "./install.mjs";
import { recordDir, runSays } from "../gates/timing.mjs";
import { edgesLeft, fileIssue } from "../../plugin/src/tracker/filing/route.mjs";
import { refusing } from "../../plugin/src/resolve/settings.mjs";
import { CEILINGS, climbForm, overCeiling } from "../../plugin/src/ladder.mjs";
import { REPLAYED, replaySays, replayedBy } from "./replayed.mjs";
import { cleanTree, INSTALLS, LANDS, PUSHES, pushing, runLanding, SHARED, waitMs } from "./land.mjs";
import { checkpointsFinished } from "./ship/checkpoint.mjs";
import { onlyRelease, RELEASE_FILES } from "./landing.mjs";
import { CHECK, publishes } from "./publish.mjs";
import { publishesVersion, statesVersion, versionIn } from "./release/released-tag.mjs";
import { forgetBump, unwound, versionAbove } from "./release/version.mjs";
import { REVIEWED, REVIEW_PATHS, reviewBody, reviewLines, reviewSays, spannedIn } from "./review.mjs";
import { hookEntries } from "../../plugin/src/hooks/log/hook-log-file.mjs";
import { typed } from "../../plugin/src/hooks/shell-spans.mjs";
import { freezesSession, FROZEN, pluginCopy } from "../../plugin/src/tools/plugin-copy.mjs";
import { releaseMark, runsMark } from "../../plugin/src/stats/eval.mjs";
import { partForLanding } from "../../plugin/src/guides/served.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SELF = `node ${join(basename(HERE), "tools", "run.mjs")}`;

/** What `-h` prints about the release, after the verb table and the other parts' own paragraphs. */
export const SHIP_HELP = [
  "What a session registered, and the skills it loaded, reach it at its next start — gate code does",
  "not, being chosen per call — so the last step says whether a restart is owed and names the set it",
  "filtered on. It says beside that what the gate run a step earlier took and how that compares with",
  "the run before it, so a release that made the gate slower is visible where a release that wrote a",
  "lot of unread code already is.",
  "",
  "The version step carries the gate's record onto the version it wrote. Every step's digest is keyed",
  "on the manifests, so the commit naming a release used to leave the whole record unreadable at the",
  "one head every later branch is cut from, and a worktree holding no change paid for the whole table",
  "to re-prove content this gate had passed minutes earlier. So the step reads what the record holds",
  "green before the bump and re-keys those same entries after it, deciding nothing green that the",
  "record did not already hold. It carries nothing at all unless the only difference between the two",
  "reads is the release's own: every path that moved is one of the manifests a release writes, each of",
  "those is unchanged once its version fields are taken out, and they all name one version afterwards.",
  "Whatever it does it says so, and it refuses nothing — a record that cannot be read or written is",
  "not a release this stops. `npm run check -- --full` reads no digest and writes no pass, so it",
  "proves a tree independently and repairs nothing; a carried entry is dropped by removing the",
  "gate-ledger directory under the common git directory, which the gate prints.",
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
  wroteLine(tree, own);
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

/** The flag that writes the merged mark's clause about this change's own files, printed at the step
 *  that knows them — the flag and not the clause, whose wording a run typed whole into the value
 *  (ISS-1023). By commit and not by filename: a dependency lives in the manifest a bump also writes. */
const wroteLine = (tree, own) => {
  const wrote = new Set();
  for (const sha of own) {
    for (const one of (gitOut(["diff", "--name-only", `${sha}^`, sha], tree) ?? "").split("\n").filter(Boolean)) wrote.add(one);
  }
  const said = [...wrote].sort();
  console.log("  the clause of the mark's note that says what this change wrote, which `developed` "
    + "reads against the plan, is written by this flag:");
  console.log(`    --wrote ${said.length ? typed(said.join(", ")) : "nothing"}`);
  console.log("  type the flag and the value whole, any quotes on it being the shell's: the note is built "
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
  const resume = () => `Resume the release at its push step, where the branch push is a no-op and `
    + `this is retried: ${SELF} ship --from ${rows.findIndex(([one]) => one === push) + 1}`;
  /* The last step and not the push: what this one clears is a tracker write, and a resume onto the
     push would spend the whole release again to reach it. The install's own is named beside it,
     that being the step a checkpoint left standing for want of an install is waiting on. */
  const again = () => `${SELF} ship --from ${rows.length}`;
  const installs = () => `${SELF} ship --from ${rows.findIndex(([one]) => one === install) + 1}`;
  const rows = [
    ["the tree is clean", () => cleanTree(tree)],
    [`fetch ${REMOTE}/${base}`, () => {
      loud("git", ["fetch", REMOTE, base], tree, "Check the remote is reachable.");
      writeFileSync(markFile(tree), `${revAt(tree, remoteRef(base))}\n`);
    }, LANDS],
    [REPLAYED, () => replaySays(tree, base, SELF), LANDS],
    [`rebase onto ${REMOTE}/${base}`, () => {
      const from = gitOut(["rev-parse", "HEAD"], tree);
      loud("git", ["rebase", remoteRef(base)], tree, "Resolve it, or `git rebase --abort`.");
      replayedBy(tree, from);
    }, LANDS],
    /* After the rebase, the range being what the release ships, and before the bump, whose manifests
       the gate's record is keyed on too: run it after and every release pays a whole gate for one
       version string. */
    [GATE, () => loud("npm", CHECK, tree,
      "Fix the tree and ship again; a release ships what a gate has passed, and nothing after this step has run."), LANDS],
    [`a version above ${REMOTE}/${base}`,
      () => acrossVersion(tree, RELEASE_FILES, () => versionAbove(tree, base, note)), LANDS],
    [push, () => {
      pushing(tree, base, () => `Rejected means the remote `
        + `moved${unwound(tree)}: rebase, re-run the review of the rebased head, then ${SELF} ship --from 2`);
      forgetBump(tree);
      publishesVersion(tree, gitOut(["rev-parse", "HEAD"], tree), versionIn(tree), resume());
    }, PUSHES],
    ["the checkout follows", () => follows(root, base, tree)],
    [install, () => installed({ tree, root, base, market, plugin, self: SELF }), INSTALLS],
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
      const mark = runsMark(root);
      if (mark) console.log(`  ${mark}`);
      publishes(tree, base, copy?.installed);
      /* Whatever the corpus count, so a comparison can be taken since THIS release: the version and
         the head are the two things a reading taken later cannot work out for itself. */
      const held = releaseMark(root, { version: copy?.installed, head: gitOut(["rev-parse", "HEAD"], tree) });
      if (held) console.log(`  ${held}`);
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

export const reviewedAt = (tree) => gitOut(["rev-parse", "--verify", "--quiet", REVIEWED], tree);

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
    body: reviewBody({ tree, from, to, volume }),
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

const reviewOwed = async (tree) => {
  const from = reviewedAt(tree);
  if (!from) return console.error(`  ${NO_MARK(SELF)}`);
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
