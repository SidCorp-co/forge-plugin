/* The project's own level of the one report an agent asks before it plans a live walk, and the two
   seats that keep what it answers off the tracker. Spawned rather than called, because the answer is
   what a developer reads and the refusal has to arrive before the call goes out (ISS-92). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeStore, fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;
const { knowledge } = fakeStore();
const ISSUE = "22222222-2222-4222-8222-222222222222";
const PASSWORD = "correct-horse-battery";

const deploy = {
  stagingUrl: "https://beta.example.test",
  testingUrls: [{ label: "shop", url: "https://shop.example.test" }],
  testCredentials: [{ username: "qa@example.test", password: PASSWORD }],
  notes: "A test account reaches the storefront only.",
};

const held = { documentId: ISSUE, issueId: "ISS-1", status: "in_progress", title: "one" };

const state = {
  issues: [held],
  comments: { [ISSUE]: [] },
  answer: {
    /* The lease is the write's own gate, so the fixture keeps what the claim puts on the issue. */
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [held], returned: 1, hasMore: false };
      if (args.action === "get") return held;
      if (args.action === "update") return Object.assign(held, args.data);
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_config: () => ({
      config: { baseBranch: "staging", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
    }),
    "forge_projects.get": () => ({ project: { previewDeploy: state.deploy } }),
    forge_knowledge: knowledge,
    /* One handler for the three, because the fake routes every `pm/<what>` path to this tool. */
    forge_project_pm: ({ action }) => (action === "snapshot" ? state.snapshot
      : action === "runner_load" ? { runners: [{ id: "r-1" }] } : state.graph),
  },
  deploy,
  graph: { nodes: [{ id: ISSUE }], edges: [], depth: 2, truncated: false, remainingNodes: 0 },
  snapshot: { countsByStatus: { open: 3 }, activeJobs: [], stalledIssues: [], queuedCount: 0, recentFailures: [] },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const ask = (...argv) => ranAsync(FORGE, argv, tracker.env, ROOT);
await ask("claim", "ISS-1", "--unheld");

/* The report's status is its verdict on the machine — a fixture endpoint misses probes of its own —
   so a read of it is judged on the rows and a write on the status, which a write returns before the
   probes are made. */
const ROW = (label, detail) => new RegExp(`^\\[ {2}ok {2}\\] ${label}\\s+${detail}`, "mu");

test("the report answers where a change lands and what it can be walked against", async () => {
  const run = await ask("doctor");
  assert.match(run.stdout, ROW("staging branch", "staging {2}← the tracker's project config"), run.stdout);
  assert.match(run.stdout, ROW("production branch", "master {2}← the tracker's project config"));
  assert.match(run.stdout, ROW("production deploy", "a person's — "));
  assert.match(run.stdout, ROW("staging deploy", "2 host\\(s\\) {2}← the tracker's project detail"));
  assert.match(run.stdout, ROW("staging url", "https://beta\\.example\\.test"));
  assert.match(run.stdout, ROW("testing urls", "https://shop\\.example\\.test"));
  assert.match(run.stdout, ROW("notes", "A test account reaches the storefront only\\."));
});

/* Both lines Phase 0 reads before it decides how a change lands, off the one record that answers
   them: the fixture's branches are distinct and its config names no judge. */
test("the report answers where the merge sits and whether a judge is independent", async () => {
  const run = await ask("doctor");
  assert.match(run.stdout, ROW("where the merge sits", "after-merge {2}← the tracker's project config"), run.stdout);
  assert.match(run.stdout,
    ROW("independent judgement", "not stated between developed and testing {2}← the tracker's project config"),
    "unanswered is discovered and recorded, never read as either value");
});

/* The judge is the tracker record's because a project has one record and many checkouts, so a key in
   a checkout is not a second place to answer it — read as one, two clones would judge differently. */
test("a qa key in the checkout moves nothing the report prints", async () => {
  const room = tempHome("project-qa");
  writeFileSync(join(room.path, ".forge.json"), JSON.stringify({ slug: "forge-plugin", qa: "independent" }));
  const run = await ranAsync(FORGE, ["doctor"], tracker.env, room.path);
  assert.match(run.stdout,
    ROW("independent judgement", "not stated between developed and testing {2}← the tracker's project config"),
    "the checkout said independent and the record said nothing, and the record is what answers");
});

/* `not stated` is what this report prints for a project that decided nothing, so printing it for a
   call the tracker refused hands a developer a decision nobody made. The rows below it are derived
   off the same unread value, which is why they go rather than print beside the refusal (ISS-1663). */
test("a config read the tracker refused is a miss naming it, not a page of not-stated rows", async () => {
  const held = state.answer.forge_config;
  state.answer.forge_config = () => ({ refused: "no available server" });
  try {
    const run = await ask("doctor");
    assert.match(run.stdout,
      /^\[ miss \] release policy\s+the project config could not be read, so nothing below it was read rather than declared: BAD_REQUEST: no available server$/mu,
      run.stdout);
    /* Anchored on the row and not the phrase: `landing` names the merge in its own detail, and a
       loose match would pass on a report that printed every derived row beside the refusal. */
    const noRow = (label) => assert.doesNotMatch(run.stdout, new RegExp(`^\\[[^\\]]+\\] ${label}\\s`, "mu"),
      `${label} is derived off the value that went unread, so it says nothing at all`);
    noRow("independent judgement");
    noRow("where the merge sits");
    noRow("staging branch");
    noRow("production deploy");
    assert.match(run.stderr, /release policy: the project config could not be read/u,
      "and the read itself says so once, for every reader that cannot carry the difference");
    /* A report's exit is its verdict on the machine, so a reading it could not make is a miss and
       the status follows the row; nothing here refuses, which is the thing the issue ruled out. */
    assert.equal(run.status, 1, "the exit says the report reached less than it was asked for");
  } finally {
    state.answer.forge_config = held;
  }
});

test("the credential is named and not printed until the flag asks for it", async () => {
  const held = await ask("doctor");
  assert.match(held.stdout, ROW("test credentials", "present, forge doctor --credentials"));
  assert.doesNotMatch(held.stdout, new RegExp(PASSWORD, "u"));
  const asked = await ask("doctor", "--credentials");
  assert.match(asked.stdout, ROW("test credentials · password", PASSWORD), asked.stderr);
});

const NOTE_ROW = (label, detail) => new RegExp(`^\\[ note {1}\\] ${label}\\s+${detail}`, "mu");

/* The three pm routes were called for liveness and their answers dropped, so a reader learned the
   tool answered and nothing it said. A graph the tracker truncates is the case that makes the
   difference visible: printed as a count alone it reads as the whole graph. */
test("the pm readings are printed rather than probed for liveness alone", async () => {
  state.graph = { nodes: [{ id: ISSUE }], edges: [], depth: 2, truncated: false, remainingNodes: 0 };
  const run = await ask("doctor");
  assert.match(run.stdout, ROW("issue counts", "3 open"), run.stdout);
  assert.match(run.stdout, ROW("runner load", "1 runner\\(s\\) registered"), run.stdout);
  assert.match(run.stdout, ROW("dependency graph", "0 edge\\(s\\) over 1 issue\\(s\\) at depth 2"), run.stdout);
  assert.doesNotMatch(run.stdout, /did not reach/u, "a whole reading claims nothing was cut");
});

test("a graph the tracker cut says what the reading did not reach", async () => {
  state.graph = { nodes: [{ id: ISSUE }], edges: [], depth: 2, truncated: true, remainingNodes: 579 };
  const run = await ask("doctor");
  assert.match(run.stdout,
    NOTE_ROW("dependency graph", "0 edge\\(s\\) over 1 issue\\(s\\) at depth 2, and 579 issue\\(s\\) it did not reach"),
    run.stdout);
});

/* Zeros are a measurement, and a refusal is not one: the row that reads a refusal as an answer would
   report an empty project to a caller whose credential was simply told no. */
test("a pm route that refuses prints no counts at all", async () => {
  state.snapshot = { refused: "FORBIDDEN: pm is not enabled for this credential" };
  const run = await ask("doctor");
  assert.match(run.stdout, NOTE_ROW("project pm", "not read: .*FORBIDDEN"), run.stdout);
  assert.doesNotMatch(run.stdout, /issue counts/u, "and no row claims a count it never read");
  state.snapshot = { countsByStatus: { open: 3 }, activeJobs: [], stalledIssues: [], queuedCount: 0, recentFailures: [] };
});

test("the tracker's own field names reach no reader of this verb", async () => {
  const run = await ask("doctor", "--credentials");
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /baseBranch|previewDeploy/u);
});

test("a comment carrying the credential is refused, and the refusal names the field", async () => {
  const room = tempHome("project-verb");
  const body = join(room.path, "note.md");
  writeFileSync(body, `Signed in with ${PASSWORD} and the screen rendered.\n`);
  const run = await ask("comment", "ISS-1", body);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries this project's test credentials · password, at body/u);
  assert.match(run.stderr, /forge doctor --credentials/u);
  assert.doesNotMatch(run.stdout, /comment-uuid/u, "and nothing was posted");
  assert.equal(state.calls.filter((one) => one.args?.action === "create").length, 0);
});

test("a file carrying the credential is refused before the upload slot is minted", async () => {
  const room = tempHome("project-upload");
  const shot = join(room.path, "walk.txt");
  writeFileSync(shot, `the walk, signed in with ${PASSWORD}\n`);
  const run = await ask("attach", "issue", "ISS-1", shot);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^walk\.txt carries this project's test credentials · password\. A test/mu,
    "a file is one value, so the refusal names no field of a payload it does not have");
  assert.equal(state.calls.filter((one) => one.name === "forge_uploads").length, 0,
    "there is no delete for an upload, so a refused file leaves no document behind");
});

test("a payload holding no credential is sent, and a project holding none refuses nothing", async () => {
  const room = tempHome("project-clean");
  const body = join(room.path, "clean.md");
  writeFileSync(body, "The screen rendered and nothing secret is quoted.\n");
  const sent = await ask("comment", "ISS-1", body);
  assert.equal(sent.status, 0, sent.stderr);
  state.deploy = { stagingUrl: "https://beta.example.test", testCredentials: [] };
  const secret = join(room.path, "secret.md");
  writeFileSync(secret, `Signed in with ${PASSWORD}.\n`);
  const through = await ask("comment", "ISS-1", secret);
  assert.equal(through.status, 0, through.stderr);
  state.deploy = deploy;
});

test("a record carrying the credential is refused too, since the guard reads no list of kinds", async () => {
  const run = await ask("record", "park", "ISS-1", "--kind", "paused",
    "--why", `stopped at the login wall; the password on file is ${PASSWORD}`);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries this project's test credentials · password, at [a-zA-Z]/u);
});

/* The guard fails closed: a payload it could not judge is held rather than sent, because there is
   no delete for what the tracker has taken and a held write costs a retry (ISS-487). */
test("a write is refused where the deploy could not be read at all, and the refusal carries the reason", async () => {
  const room = tempHome("project-unread");
  const body = join(room.path, "secret.md");
  writeFileSync(body, `Signed in with ${PASSWORD}.\n`);
  const posted = () => state.calls.filter((one) => one.args?.action === "create").length;
  state.answer["forge_projects.get"] = () => ({ refused: "this credential may not read the project" });
  const before = posted();
  const run = await ask("comment", "ISS-1", body);
  const rows = await ask("doctor");
  state.answer["forge_projects.get"] = () => ({ project: { previewDeploy: state.deploy } });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /could not be read, so nothing here can say whether the payload carries one/u,
    run.stderr);
  assert.match(run.stderr, /this credential may not read the project/u,
    "the reading's own reason, which is what a token that may not read the project acts on");
  assert.match(run.stderr, /^ {2}forge doctor$/mu, "and one command that says whether the project reads");
  assert.equal(posted(), before, "and nothing was posted");
  assert.match(rows.stdout,
    NOTE_ROW("staging deploy", "the tracker's project detail did not answer, so nothing here says"),
    "the report says the reading did not answer, rather than that the project configured nothing");
});

test("the report says how far this device's clock stands from the tracker's, or that it read none", async () => {
  const run = await ask("doctor");
  assert.match(run.stdout,
    ROW("tracker clock", "this device is \\d+\\.\\d\\ds (ahead of|behind) the tracker, known to ±\\d+\\.\\d\\ds"),
    run.stdout);
  assert.match(run.stdout, /tracker clock.*← the `date` header on the tracker's own answers/u);
  state.noDate = true;
  const blind = await ask("doctor");
  state.noDate = false;
  assert.match(blind.stdout,
    NOTE_ROW("tracker clock", "unmeasured — the tracker's answers carry no readable time"),
    "a figure nobody measured is not printed as one");
});
