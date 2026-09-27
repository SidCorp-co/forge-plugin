/* What a release owes the repository once its copy is installed, whichever route released it: the
   ladder's backstop for each change it landed, the newest gate figure, and the batch reading where
   the volume since the mark calls for one. One function for the ship and the landing alike, because
   a second route that grew its own step table dropped all three and read as nothing owed (ISS-2735). */
import { execFile, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { gitOut } from "../../checkout.mjs";
import { recordDir, runSays } from "../../gates/timing.mjs";
import { edgesLeft, fileIssue } from "../../../plugin/src/tracker/filing/route.mjs";
import { refusing } from "../../../plugin/src/resolve/settings.mjs";
import { firstLine } from "../../../plugin/src/resolve/flags.mjs";
import { CEILINGS, climbForm, overCeiling } from "../../../plugin/src/ladder.mjs";
import { overdueSays, readingFor, readingTitle, REVIEWED, reviewBody, reviewedAt, reviewSays,
  spannedIn, untaken } from "../review.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

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

/* The same read without holding this process: a landing's tracker may be answered by this very
   process, which a child it blocked on would never hear back from. */
const forgeAsks = (tree, args) => new Promise((done) => {
  execFile(CLI, args, { cwd: tree, encoding: "utf8", timeout: CLI_MS }, (error, stdout, stderr) => {
    if (!error) return done({ out: stdout });
    if (typeof error.code !== "number") return done({ why: error.message, unrun: true });
    return done({ why: (stderr || stdout || `exited ${error.code}`).trim() });
  });
});

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

/** The issue a tree's branch was started for, which is how a ship knows the change it landed; a
 *  landing knows its members by key and never reads a branch name. */
export const branchKey = (tree) => {
  const key = BRANCH_KEY.exec(gitOut(["rev-parse", "--abbrev-ref", "HEAD"], tree) ?? "")?.[1];
  return key ? `ISS-${key}` : null;
};

const tierCeiling = async (tree, { ref, was, at }) => {
  try {
    if (!ref || !was || !at) return undefined;
    const said = await forgeAsks(tree, ["resume", ref, "--json"]);
    if (said.why) return undefined;
    /* Parsed, never matched: JSON escapes newlines. `null` parses; anything worse takes the catch. */
    const body = JSON.parse(said.out);
    if (!body || typeof body !== "object") return undefined;
    const rung = body.rung;
    /* An own string key of the table and nothing an object inherits: `CEILINGS.constructor` is
       truthy and has no figures, so a rung nobody set would print a ceiling of undefined. */
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

const reviewOwed = async (tree, self) => {
  const from = reviewedAt(tree);
  if (!from) return console.error(`  ${NO_MARK(self)}`);
  const said = reviewSays(tree, from);
  if (said.refusal) return console.error(`  ${said.refusal}`);
  const { owed, range, count, volume, threshold, paths, source, changed } = said;
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
    console.log(`    the body is ${self}'s own, so what the check asks for is this repository's to `
      + `write. File that: forge feedback - --title "<what the check asked the review body for>"`);
    console.log(`    the count keeps growing until the body it generates is one the check accepts`);
    return;
  }
  if (asked.why) {
    console.error(`  ${asked.whose}, so nothing is filed and the next ship asks again: ${asked.why}`);
    console.log(`    file its issue:  forge new - --title "review ${range}" --category review`);
    console.log(`    give it a tree:  ${self} start <that ISS-nn>`);
    console.log(`    it ends by moving the mark, finding or none: ${self} review --done <the range's end>`);
    return;
  }
  if (asked.status === READ) {
    return console.log(`    ${asked.key} is ${READ} for this mark and the mark never moved, so the `
      + `count keeps growing. Read it, then move the mark to the head that reading reached: `
      + `${self} review --done <that head>`);
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
  if (!asked.filed && !asked.second) await overdue(asked, { changed, threshold }, self);
  console.log(`  ${launch(asked.key)}`);
};

/* A lease that cannot be read says nothing either way, so the line is withheld rather than guessed. */
const overdue = async (asked, range, self) => {
  const waiting = await refusing(() => untaken(asked)).catch(() => false);
  if (!waiting) return;
  console.log(`    ${overdueSays(asked, range)}`);
  console.log(`    start it: ${self} start ${asked.key}`);
};

/** Every obligation above, in the order the ship always took them. `landed` is one row per change
 *  the release carries — its key and the range `was..at` that holds it — and `self` is the command
 *  a printed remedy names. Reports and refuses nothing a release could stop for. */
export const releaseOwes = async ({ tree, self, landed = [] }) => {
  for (const one of landed) await tierCeiling(tree, one);
  gateGrew(tree);
  await reviewOwed(tree, self);
};
