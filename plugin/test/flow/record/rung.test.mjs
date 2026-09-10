/* The shortest complete walk of the ladder was ten record writes and seven advances, and `record ->
   record` at 458 and `record -> advance` at 248 were the two commonest adjacent pairs in a corpus of
   514 runner transcripts (ISS-1103). One call now writes the records a rung cites and makes the move
   they earn, so these cases are about what that call writes when it refuses and what it moves. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome, tempRoom, typedPlan } from "../../fixtures.mjs";
import { CITED } from "../../../src/guides/phases.mjs";

process.env.XDG_CONFIG_HOME = tempHome("record-rung").path;
const room = tempRoom("record-rung-");
const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const MINE = "this-run";
const SHA = "9e24c2a1f0b7c3d4e5f60718293a4b5c6d7e8f90";

const PLAN = typedPlan({ Steps: "1. Read the one module. criteria: 1" });
const CRITERIA = "1. FR-05~1: the record a rung cites and the move it earns are one call.";

const leased = () => ({
  lease: { holder: MINE, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(),
    minutes: 30, next: null, history: [] },
});

const issue = (key, status, over = {}) => ({
  documentId: `uuid-${key}`, issueId: key, status, title: `${key} title`,
  description: "what it is", complexity: "m", sessionContext: leased(), ...over,
});

const state = {
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [
    issue("ISS-2001", "confirmed"),
    issue("ISS-2002", "open"),
    issue("ISS-2003", "confirmed"),
    issue("ISS-2004", "in_progress", { plan: PLAN, acceptanceCriteria: CRITERIA }),
    issue("ISS-2006", "confirmed"),
    issue("ISS-2007", "open"),
    issue("ISS-2005", "testing", { plan: PLAN, acceptanceCriteria: CRITERIA, mergedAt: "2026-09-10T00:00:00.000Z" }),
  ],
  comments: {},
  minted: 0,
  device: null,
  swallow: false,
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      const held = state.issues.find((one) => one.documentId === args.documentId);
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "update") Object.assign(held, state.stores?.(args.data) ?? args.data);
      if (args.action === "transition") Object.assign(held, { status: args.data.status });
      return held;
    },
    forge_comments: (args) => {
      const key = args.filters?.issue ?? args.data?.issue;
      if (args.action === "list") {
        const rows = (state.comments[key] ?? []).slice(0, state.swallow ? -1 : undefined);
        return { comments: rows, returned: rows.length, limit: rows.length, hasMore: false };
      }
      const row = { documentId: `c-${state.minted += 1}`, createdAt: new Date().toISOString(),
        ...(state.device ? { authorDeviceId: state.device } : {}), ...args.data };
      (state.comments[key] ??= []).push(row);
      return row;
    },
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const env = () => ({
  ...tracker.env,
  AI_AGENT: "a-test-agent",
  CLAUDE_PID: "4242",
  FORGE_SESSION_ID: MINE,
  FORGE_CODEX_DISABLE: "1",
});

const ask = (...argv) => ranAsync(FORGE, argv, env());
const listed = (from) => state.calls.slice(from).filter((one) => one.args.action === "list").length;
const statusOf = (key) => state.issues.find((one) => one.issueId === key).status;
const held = (key) => state.issues.find((one) => one.issueId === key);
const kindsOn = (key) => (state.comments[`uuid-${key}`] ?? [])
  .map((one) => /^`forge-record: (\w+)/mu.exec(one.body ?? "")?.[1])
  .filter(Boolean);

const fileAt = (name, text) => {
  const path = join(room, name);
  writeFileSync(path, `${text}\n`);
  return path;
};

/* The headline: `approved` cites three records, and the walk it opened cost four calls. */
test("the three records approved cites go in one call, and that call moves the status", async () => {
  const run = await ask("record", "decision", "ISS-2001", "--decision", "one reading | its assumption | its undo",
    "--also", "plan", fileAt("plan.md", PLAN),
    "--also", "criteria", fileAt("criteria.md", CRITERIA));
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.deepEqual(kindsOn("ISS-2001"), ["decision"], "the one kind of the three whose payload is a comment");
  assert.equal(held("ISS-2001").plan.trim(), PLAN, "the plan field is written by the same call");
  assert.equal(held("ISS-2001").acceptanceCriteria, CRITERIA);
  assert.match(run.stderr, /^ISS-2001 {2}confirmed -> approved$/mu, "and the set completes the rung, so it moves");
  assert.equal(statusOf("ISS-2001"), "approved");
});

/* Either every payload of the call is accepted or none is, so no run ends holding half a rung. */
test("a call whose second payload is refused writes none of them", async () => {
  const before = { ...held("ISS-2002") };
  const run = await ask("record", "decision", "ISS-2002", "--decision", "one reading | its assumption | its undo",
    "--also", "criteria", fileAt("bad.md", "the list is sorted by name"));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /Every criterion is a numbered line/u, "refused by the kind and the field that is wrong");
  assert.deepEqual(kindsOn("ISS-2002"), [], "and the decision that would have gone first is not on the page");
  assert.equal(held("ISS-2002").acceptanceCriteria, before.acceptanceCriteria);
});

/* A cap is measured on what the transport is about to send, so it cannot be judged in the prepare
   half at all: the fields of a call go in one update, ahead of every comment, or the comment lands
   and the field is refused after it (consult 6b7f11 F1). */
test("a field over its cap refuses the whole call, and the comment beside it is not posted", async () => {
  const run = await ask("record", "verification", "ISS-2005", "--where", "the deployed app",
    "--commit", SHA, "--evidence", "https://ci.example.test/9",
    "--also", "note", "--section", "Fixed", "--user", "x".repeat(501));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /releaseNotes\.userFacing is capped at 500/u);
  assert.deepEqual(kindsOn("ISS-2005"), [], "the verification is not on the page");
  assert.equal(held("ISS-2005").releaseNotes, undefined, "and the note is not in the field");
  assert.equal(statusOf("ISS-2005"), "testing", "so nothing moved");
});

/* The check reads the record the tracker holds and not the one the call sent: a project that rewrites
   prose stores something else, and the plan's own comparator takes any non-empty read-back
   (consult 8d41c7 F2). */
test("the move judges the field the tracker read back, not the value the call sent", async () => {
  const short = `${PLAN.replace(/## Declarations[\s\S]*?(?=\n## Steps)/u, "")}\n`;
  state.stores = (data) => ({ ...data, ...("plan" in data ? { plan: short } : {}) });
  const run = await ask("record", "decision", "ISS-2003", "--decision", "one reading | its assumption | its undo",
    "--also", "plan", fileAt("whole.md", PLAN),
    "--also", "criteria", fileAt("also.md", CRITERIA));
  state.stores = null;
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(held("ISS-2003").plan, short, "the tracker stored a plan short of a section");
  assert.equal(statusOf("ISS-2003"), "confirmed", "so the rung is not earned and the call moved nothing");
  assert.match(run.stderr, /Screen change|Declarations/u, "and the item the stored plan is short of is named");
});

/* The count alone left a run to ask a second time what the name of the missing record was. */
test("a call that leaves the rung short moves nothing and names what is owed, as advance does", async () => {
  const run = await ask("record", "review", "ISS-2004", "--reviewer", "codex", "--commit", SHA,
    "--outcome", "approved");
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(statusOf("ISS-2004"), "in_progress", "the rung cites a merged mark too");
  assert.match(run.stderr, /developed is next and the record does not earn it/u);
  assert.match(run.stderr, /no merged mark, so nothing says the change landed/u, "named, not counted");
  const owed = await ask("advance", "ISS-2004", "--owed");
  assert.equal(owed.status, 0, owed.stderr);
  for (const line of run.stderr.split("\n").filter((one) => one.startsWith("  ")).slice(0, 1)) {
    assert.ok(owed.stdout.includes(line.trim()), `the same check answers both:\n${line}`);
  }
});

/* A rung whose set is one kind spends one call too: the second commonest pair in the corpus is
   mostly these, and excluding them would leave 248 of them standing. */
test("a rung cited by one kind moves on that record's own call", async () => {
  const run = await ask("record", "confirmation", "ISS-2002", "--where", "plugin/src/flow/record",
    "--is", "the verb takes one kind", "--finding", "holds");
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stderr, /^ISS-2002 {2}open -> confirmed$/mu);
  assert.equal(statusOf("ISS-2002"), "confirmed");
});

/* Or the status is moved by whatever write followed the one that earned it, which is not a status
   earned by a record. */
test("a write of a kind the rung does not cite moves nothing, however complete the rung is", async () => {
  assert.equal(statusOf("ISS-2002"), "confirmed", "standing where the case above left it");
  const run = await ask("record", "gap", "ISS-2002", "--none", "the method answered");
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /confirmed -> /u, "no move on an uncited kind");
  assert.equal(statusOf("ISS-2002"), "confirmed");
  const moved = await ask("advance", "ISS-2002");
  assert.equal(moved.status, 1, moved.stdout);
  assert.match(moved.stdout, /approved is next and the record does not earn it/u,
    "and the rung ahead is genuinely short, so nothing was hidden by the guard");
});

test("--also takes a record kind, once, and refuses before any call is made", async () => {
  const bogus = await ask("record", "decision", "ISS-2001", "--decision", "a | b | c", "--also", "planning");
  assert.equal(bogus.status, 1);
  assert.match(bogus.stderr, /No record kind named planning/u);
  assert.doesNotMatch(bogus.stderr, /No Forge endpoint|forge doctor/u, "a flag error costs no call");
  const twice = await ask("record", "decision", "ISS-2001", "--decision", "a | b | c",
    "--also", "decision", "--decision", "d | e | f");
  assert.equal(twice.status, 1);
  assert.match(twice.stderr, /names the kind `decision` twice/u);
  const bare = await ask("record", "decision", "ISS-2001", "--decision", "a | b | c", "--also");
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /--also was given no value/u);
});

/* A hand-written pairing would be a second copy of `CITED`, free to disagree the first time a rung's
   set changes — which ISS-1066 changed twice in one month. The move reads that table and the record
   verb names no rung at all; this fails the moment one of them does. */
test("no module of the record verb names a rung beside the kinds that rung cites", () => {
  const dir = new URL("../../../src/flow/record/", import.meta.url).pathname;
  const source = readdirSync(dir).filter((one) => one.endsWith(".mjs"))
    .map((one) => readFileSync(join(dir, one), "utf8")).join("\n");
  const paired = Object.entries(CITED).filter(([, kinds]) => kinds.length > 1);
  assert.ok(paired.length > 1, "the table holds the rungs this rule is about");
  for (const [status, kinds] of paired) {
    for (const kind of kinds) {
      assert.doesNotMatch(source, new RegExp(`(["']${status}["']|\\b${status}\\s*:)[^\\n]*\\b${kind}\\b`, "u"),
        `${status} is named as a value beside its cited ${kind} under plugin/src/flow/record/`);
    }
  }
});

/* `answered` reads a comment with no device on it as a person's reply to a park, so a row this write
   invented would let a call enter the release rung where a fresh `forge advance` refuses. The answer
   names the author or the page is read again before anything is judged (consult 47c1d0 F1). */
test("a comment whose answer names no device is judged against the page read again, not against an invented row", async () => {
  state.device = null;
  const mark = state.calls.length;
  const blind = await ask("record", "gap", "ISS-2004", "--none", "the method answered");
  assert.equal(blind.status, 0, blind.stderr);
  const reread = listed(mark);
  state.device = "a-device";
  const named = state.calls.length;
  const seen = await ask("record", "gap", "ISS-2004", "--none", "the method answered again");
  assert.equal(seen.status, 0, seen.stderr);
  assert.ok(reread > listed(named), "the unnamed author costs the read the named one does not");
  assert.equal(statusOf("ISS-2004"), "in_progress", "and neither write moved anything");
});

/* The citation guard decides the move; what a rung is short of is owed to whoever wrote anything. */
test("a write of an uncited kind still names every item the rung ahead is owed", async () => {
  const run = await ask("record", "gap", "ISS-2006", "--none", "the method answered");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /approved is next and the record does not earn it/u);
  assert.match(run.stderr, /the plan field is empty/u, "the item by name, not the count alone");
  const owed = await ask("advance", "ISS-2006", "--owed");
  const named = run.stderr.split("\n").filter((one) => one.startsWith("  ") && one.trim());
  assert.ok(named.length, "the write named at least one item");
  for (const line of named) assert.ok(owed.stdout.includes(line.trim()), `--owed says the same: ${line}`);
});

/* Reading again is not enough on its own: a cut read hands the new row back to nobody, and the local
   copy surviving that merge is what would satisfy the park. An unconfirmed row is dropped instead, so
   the rung reads short and the status stays where a fresh `forge advance` leaves it (consult 6e2a70 F1). */
test("a row the tracker named no author of and did not hand back is not counted, so nothing moves", async () => {
  state.device = null;
  state.swallow = true;
  const run = await ask("record", "confirmation", "ISS-2007", "--where", "plugin/src/flow",
    "--is", "the verb takes one kind", "--finding", "holds");
  state.swallow = false;
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^finding: holds$/mu, "the record is written all the same");
  assert.equal(statusOf("ISS-2007"), "open", "and the write is not counted, so nothing moved");
  assert.match(run.stderr, /no confirmation/u, "the rung reads short, as a fresh advance would read it");
  state.device = "a-device";
  const named = await ask("record", "confirmation", "ISS-2007", "--where", "plugin/src/flow",
    "--is", "the verb takes one kind", "--finding", "holds");
  assert.equal(named.status, 0, named.stderr);
  assert.match(named.stderr, /^ISS-2007 {2}open -> confirmed$/mu, "named, it counts and the rung moves");
});
