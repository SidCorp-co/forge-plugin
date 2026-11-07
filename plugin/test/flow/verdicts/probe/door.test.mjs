/* The probe a verdict keeps and the rules around it (ISS-7): a verdict carrying one is recorded
   through the verdict door core keeps a probe from, not as a comment; the issue's criterion classes
   are read before any upload and every block core would refuse is named in one message, nothing going
   up for a verdict core would turn back; `advance --owed` names the probe and clip each observable
   criterion owes; and a refusal arriving after an upload leads with the names already up. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import test, { after, before } from "node:test";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { OWN, trackerFor } from "../../../fixtures/own-project.mjs";

const HOME = tempHome("verdict-probe");
process.env.XDG_CONFIG_HOME = HOME.path;
const AWAY = projectRoom(tempRoom("verdict-probe-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);

const { viewFrom } = await import("../../../../src/flow/earned.mjs");
const { CHECKS } = await import("../../../../src/flow/earned.mjs");
const { observableOwed, withCoreVerdicts } = await import("../../../../src/flow/earned/core-verdicts.mjs");

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const PROBE = JSON.stringify({ kind: "request", request: { method: "GET", path: "/health", as: "anonymous" }, expect: { status: 200 } });
const CRITERIA = "1. The first outcome.\n2. The second outcome.";

const CLIP = join(HOME.path, "run.webm");
const NOTE = join(HOME.path, "run.txt");
writeFileSync(CLIP, "webm bytes");
writeFileSync(NOTE, "a capture that is no clip");

let clock = 0;
const at = () => `2026-09-20T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const issue = {
  documentId: "probe-uuid",
  issueId: "ISS-77",
  status: "developed",
  title: "the change being judged",
  description: "no mark here",
  acceptanceCriteria: CRITERIA,
  mergedAt: "2026-09-20T09:00:00.000Z",
  attachments: [],
};

/* The classes the issue's design gives its criteria, and the answer the verdict door returns: a case
   sets `state.classes` and `state.verdictAnswer` before the call it is about. */
const state = { calls: [], issues: [issue], comments: { "probe-uuid": [] }, answer: {},
  classes: [{ n: 1, class: "observable", probe: null }, { n: 2, class: "observable", probe: null }],
  verdictAnswer: { verdictId: "v-1", duplicate: false, criterion: 1, notCounted: null } };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "get") return issue;
  if (args.action === "update") return Object.assign(issue, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
state.answer["forge_issues.criteria"] = () =>
  ({ criteria: state.classes.map((one) => ({ ...one, statement: `outcome ${one.n}`, latest: null })), retired: [] });
state.answer["forge_issues.verdicts"] = () => state.verdictAnswer;
state.answer.forge_comments = (args) => {
  if (args.action === "list") {
    const held = state.comments[args.filters?.issue] ?? [];
    return { comments: held, returned: held.length, hasMore: false };
  }
  const held = (state.comments[args.data?.issue] ??= []);
  const id = `comment-${held.length}`;
  held.push({ documentId: id, createdAt: at(), body: args.data?.body });
  return { documentId: id };
};
const { tracker, env: ENV } = await trackerFor(state, [AWAY]);
after(() => tracker.close());

const env = { ...ENV, FORGE_SESSION_ID: "the-qa-session" };
const ask = (...argv) => ranAsync(FORGE, argv, env);
const called = (name, from = 0) => state.calls.slice(from).filter((one) => one.name === name);
const comments = () => state.comments["probe-uuid"].length;

state.comments["probe-uuid"].push({ documentId: "the-mark", createdAt: at(),
  body: `mark_merged target=base — merged to master at ${COMMIT}` });

before(async () => {
  await ask("claim", "ISS-77", "--unheld");
  const claimed = await ask("claim", "ISS-77", "--unheld");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
});

test("a verdict carrying a probe is recorded through the verdict door, not as a comment", async () => {
  const before = comments();
  const from = state.calls.length;
  const run = await ask("record", "verdict", "ISS-77", "--criterion", "1", "--verdict", "pass",
    "--commit", COMMIT, "--evidence", COMMIT, "--probe", PROBE, "--without-clip", "headless run, no screen");
  assert.equal(run.status, 0, run.stderr);
  const posts = called("forge_issues.verdicts", from);
  assert.equal(posts.length, 1, `one verdict-door write:\n${run.stderr}`);
  assert.deepEqual(posts[0].args.data.probe, JSON.parse(PROBE), "the probe reaches the door as sent");
  assert.equal(posts[0].args.data.criterion, 1);
  assert.equal(posts[0].args.data.identity.sha, COMMIT, "its commit is the identity the door records against");
  assert.equal(comments(), before, "and no comment was posted for it");
  assert.match(run.stderr, /through the verdict door/u, "the write says where it went");
});

test("an observable pass with no probe and no clip is refused locally before any upload", async () => {
  const before = comments();
  const from = state.calls.length;
  const run = await ask("record", "verdict", "ISS-77", "--criterion", "1", "--verdict", "pass",
    "--commit", COMMIT, "--evidence", NOTE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /VERDICT_PROBE_REQUIRED/u, run.stderr);
  assert.match(run.stderr, /VERDICT_CLIP_REQUIRED/u, run.stderr);
  assert.equal(called("forge_uploads", from).length, 0, "nothing was uploaded for a verdict core would refuse");
  assert.equal(called("forge_issues.verdicts", from).length, 0, "and nothing reached the door");
  assert.equal(comments(), before, "and no comment was posted");
});

test("a write with one faulty block is all-or-nothing, every faulty block named in one message", async () => {
  const before = comments();
  const from = state.calls.length;
  const run = await ask("record", "verdict", "ISS-77", "--commit", COMMIT, "--evidence", NOTE,
    "--criterion", "1", "--verdict", "pass",
    "--criterion", "2", "--verdict", "pass", "--probe", PROBE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /criterion 1[\s\S]*VERDICT_PROBE_REQUIRED/u, "block 1's probe fault is named");
  assert.match(run.stderr, /criterion 2[\s\S]*VERDICT_CLIP_REQUIRED/u, "block 2's clip fault is named");
  assert.match(run.stderr, /all-or-nothing/u, "and the write is all-or-nothing");
  assert.equal(called("forge_uploads", from).length, 0, "so nothing went up");
  assert.equal(called("forge_issues.verdicts", from).length, 0, "and nothing reached the door, the passing block included");
  assert.equal(comments(), before);
});

test("a door refusal after an upload leads with the names already up", async () => {
  state.verdictAnswer = { refused: "criterion 1's probe VERDICT_PROBE_ROUTE: refused, nothing written", status: 400 };
  try {
    const run = await ask("record", "verdict", "ISS-77", "--criterion", "1", "--verdict", "pass",
      "--commit", COMMIT, "--evidence", CLIP, "--probe", PROBE);
    assert.equal(run.status, 1, run.stdout);
    const stranded = run.stderr.indexOf("run.webm");
    const refusal = run.stderr.indexOf("VERDICT_PROBE_ROUTE");
    assert.ok(stranded >= 0, `the uploaded name is named:\n${run.stderr}`);
    assert.ok(refusal >= 0, "and core's refusal is carried");
    assert.ok(stranded < refusal, "the names up lead, core's refusal follows");
  } finally {
    state.verdictAnswer = { verdictId: "v-1", duplicate: false, criterion: 1, notCounted: null };
  }
});

/* The owed list names, per observable criterion with no verdict, the probe and the clip its verdict
   will owe, so the write is composed with them rather than refused for them after a clip is up. */
const owedView = (classes, kept = false) => {
  const read = { judged: new Set(), earned: new Set(), review: new Set(), verdicts: new Map(),
    classes: new Map(classes.map((n) => [n, { klass: "observable", kept }])) };
  return withCoreVerdicts(viewFrom("probe-uuid", { status: "in_progress:test", acceptanceCriteria: CRITERIA }, []), read);
};

test("advance --owed names the probe and the clip each observable criterion owes", () => {
  const items = observableOwed(owedView([1, 2]), "ISS-77");
  assert.equal(items.length, 2, "one per observable criterion with no verdict");
  assert.match(items[0].what, /criterion 1 is observable/u);
  assert.match(items[0].what, /VERDICT_PROBE_REQUIRED/u, "the probe it will owe");
  assert.match(items[0].what, /VERDICT_CLIP_REQUIRED/u, "and the clip");
  assert.match(items[0].command, /--probe/u, "the command carries the probe to send");
});

test("where a probe is kept already, the owed line says a pass or short sends none", () => {
  const [item] = observableOwed(owedView([1], true), "ISS-77");
  assert.match(item.what, /probe is kept on it already/u);
  assert.doesNotMatch(item.command, /--probe/u, "and the command does not ask for one");
});

test("the probe and clip owed are carried in the judging rung's owed list", () => {
  const owed = CHECKS["in_progress:release"](owedView([1, 2]), "ISS-77");
  assert.ok(owed.some((one) => /criterion 1 is observable[\s\S]*VERDICT_PROBE_REQUIRED/u.test(one.what)),
    "the rung the verdicts are owed at carries the observable lines");
});

test("a verdict naming --release or --judged-by goes to the door with that identity and that judge", async () => {
  const before = comments();
  const from = state.calls.length;
  const run = await ask("record", "verdict", "ISS-77", "--criterion", "1", "--verdict", "skipped",
    "--why", "the release is not reachable from this box", "--release", "3.36.690", "--judged-by", "review");
  assert.equal(run.status, 0, run.stderr);
  const posts = called("forge_issues.verdicts", from);
  assert.equal(posts.length, 1, `one verdict-door write:\n${run.stderr}`);
  assert.deepEqual(posts[0].args.data.identity, { kind: "release", version: "3.36.690" });
  assert.equal(posts[0].args.data.judge, "review");
  assert.equal(comments(), before, "and no comment was posted for it");
});

test("--release beside --commit or --runtime is refused by name, and nothing is sent", async () => {
  for (const beside of [["--commit", COMMIT], ["--runtime", COMMIT]]) {
    const from = state.calls.length;
    const run = await ask("record", "verdict", "ISS-77", "--criterion", "1", "--verdict", "skipped",
      "--why", "x", "--release", "3.36.690", ...beside);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /--release/u, run.stderr);
    assert.equal(called("forge_issues.verdicts", from).length, 0, "nothing reached the door");
  }
});

test("a judge core refuses as not the run's role is told which --judged-by to send", async () => {
  state.verdictAnswer = { refused: "VERDICT_JUDGE_NOT_RUN_ROLE: the run is declared reviewer", status: 422 };
  try {
    const run = await ask("record", "verdict", "ISS-77", "--criterion", "1", "--verdict", "skipped",
      "--why", "x", "--commit", COMMIT, "--judged-by", "qa");
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /VERDICT_JUDGE_NOT_RUN_ROLE/u, run.stderr);
    assert.match(run.stderr, /--role reviewer records its verdict with --judged-by review/u, run.stderr);
  } finally {
    state.verdictAnswer = { verdictId: "v-1", duplicate: false, criterion: 1, notCounted: null };
  }
});
