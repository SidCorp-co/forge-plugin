/* A project that recorded no login cannot reach a rendered state, and the refusal that says so
   only fires once the change has landed. The line below says it while a run can still spend it. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("credential-ahead").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { viewFrom } = await import("../../../src/flow/earned.mjs");
const { credentialAhead, deployFor } = await import("../../../src/flow/route.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const SCREEN = "Screen change: yes.\nSchema coupling: no.\nUser-facing outcome: no.";
const QUIET = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: yes.";
const NO_LOGIN = { urls: [], notes: [], withheld: [], from: "the tracker's project detail" };
const A_LOGIN = { ...NO_LOGIN, withheld: [{ label: "test credentials · password", value: "hunter2" }] };
const ahead = (issue, deploy) =>
  credentialAhead(viewFrom("the-uuid", issue, [], null, null, null, deploy), "ISS-3");

test("a screen change on a project with no test credential is told at the rehearsal, not at the refusal", () => {
  const said = ahead({ status: "in_progress", plan: SCREEN }, NO_LOGIN);
  assert.match(said, /holds no test credential/u, said);
  assert.match(said, /--verdict skipped --why/u, "the skip is one of the two shapes it names");
  assert.match(said, /cited as the evidence/u, "and the pass on another route's render is the other");
  assert.match(said, /forge guide issue-flow verification/u, "which carries the rest, unrestated");
  assert.equal(ahead({ status: "approved", plan: SCREEN }, NO_LOGIN), said,
    "and it is said from the status the plan was written at, not only from the one before it");
  assert.equal(ahead({ status: "developed", plan: SCREEN }, NO_LOGIN), said,
    "and from the rung below the judging one, which is the last that can still act on it");
  assert.match(said, /^Ahead: testing wants an attachment/u,
    "naming the rung that refuses the verdict, which is the judging one");
});

test("the line stays silent on every reading that is not a screen change without a login", () => {
  assert.equal(ahead({ status: "in_progress", plan: QUIET }, NO_LOGIN), null,
    "a user-facing outcome is not a screen change, which is the split the entry check already makes");
  assert.equal(ahead({ status: "in_progress", plan: SCREEN }, A_LOGIN), null,
    "a project that recorded a login is owed nothing");
  assert.equal(ahead({ status: "in_progress", plan: SCREEN }, null), null,
    "and a deploy nobody read reports no empty set: null is unread, never none");
  for (const status of ["testing", "awaiting_release", "closed"]) {
    assert.equal(ahead({ status, plan: SCREEN }, NO_LOGIN), null, `${status} is past the point of saying it`);
  }
});

/* The gate on the fetch and the line spell one pair of conditions; the calls are counted below. */
test("the reading is not taken where the line would not read it", async () => {
  assert.equal(await deployFor(QUIET, "in_progress"), null, "a plan declaring no screen change");
  assert.equal(await deployFor(SCREEN, "testing"), null, "and a status already at the judging rung");
  assert.equal(await deployFor(SCREEN, "awaiting_release"), null, "or past it");
});

const SCREENING = {
  documentId: "screen-uuid",
  issueId: "ISS-97",
  status: "in_progress",
  title: "the change somebody has to look at",
  description: "no mark here",
  plan: SCREEN,
  acceptanceCriteria: "1. The first outcome.",
};
const NOTHING = { ...SCREENING, documentId: "quiet-uuid", issueId: "ISS-98", plan: QUIET, status: "open" };
/* A write is the lease holder's, and this lease is the session the run below declares. */
const HOLDER = "the-earning-run";
const EARNS = {
  ...SCREENING,
  documentId: "earns-uuid",
  issueId: "ISS-99",
  status: "approved",
  /* The branch beside the lease is what `in_progress` owes, so the move this case is about is not
     refused for the one thing it is not about. */
  sessionContext: {
    lease: { holder: HOLDER, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] },
    worklog: { branch: "iss-99-the-work" },
  },
};
const LOGIN = { testCredentials: { user: "qa@example.test", password: "a-real-password" } };
/* Carrying an id: the read-before-write hold credits a comment by one, and nothing else. */
const baseline = (documentId) => ({
  documentId,
  createdAt: "2026-09-03T11:01:00.000Z",
  authorId: "agent",
  body: render("baseline", { gate: "npm test", result: "green", commit: "08ca795", scope: "whole" }),
});
const state = {
  calls: [],
  deploy: {},
  issues: [SCREENING, NOTHING, EARNS],
  comments: { "screen-uuid": [baseline("screen-note")], "earns-uuid": [baseline("earns-note")] },
  answer: {
    forge_config: () => ({ config: { baseBranch: "master", productionBranch: "master", pipelineConfig: {} } }),
    "forge_projects.get": () => ({ project: { previewDeploy: state.deploy } }),
    /* Writes are kept, unlike the shared fixture's: the lease this file's transition renews is read
       back and compared with what was sent, and a store that forgets fails that comparison. */
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      const at = state.issues.findIndex((one) => one.documentId === args.documentId);
      if (at < 0) return { documentId: args.documentId };
      if (args.action !== "get") state.issues[at] = { ...state.issues[at], ...(args.data ?? {}) };
      return state.issues[at];
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const owed = (reference) => ranAsync(FORGE, ["advance", reference, "--owed"], tracker.env);
/* One route serves the project's config and its deploy alike, so what a count says is how many
   times a run read that row: once for the config every run needs, twice where the line is built. */
const fetched = () => state.calls.filter((one) => one.name === "forge_projects.get").length;

/* The verb and not the helper: only a run says what the exit code was, and only the tracker's call
   list says whether the deploy was read. `stagingDeploy` memoises, so each count is a fresh run. */
test("--owed says a screen change has no login to prove it with, and refuses nothing for it", async () => {
  const moves = () => state.calls.filter((one) => one.args.action === "transition").length;
  const before = moves();
  const nothing = fetched();
  const said = await owed("ISS-97");
  assert.equal(said.status, 0, `${said.stdout}${said.stderr}`);
  assert.match(said.stdout, /no merged mark, so nothing says the change landed/u, "the shortfall is still the shortfall");
  assert.match(said.stdout, /holds no test credential/u, said.stdout);
  assert.match(said.stdout, /--verdict skipped --why/u, "and it names the skip");
  assert.match(said.stdout, /forge guide issue-flow verification/u, "and where the rest of it is");
  assert.equal(moves(), before, "a rehearsal moves nothing, this line included");
  assert.equal(fetched() - nothing, 2, "the row is read a second time, the plan having declared a screen");

  state.deploy = LOGIN;
  const held = await owed("ISS-97");
  assert.equal(held.status, 0, held.stderr);
  assert.doesNotMatch(held.stdout, /holds no test credential/u, "a project that recorded one is owed nothing");
  assert.match(held.stdout, /no merged mark/u, "and the shortfall is unchanged either way");
  assert.doesNotMatch(held.stdout, /a-real-password/u, "the credential itself is withheld here as everywhere");

  /* The same issue asked to move rather than to rehearse: only the rehearsal prints the line, so
     only the rehearsal reads what it is built from, and a refusal reads nothing at all. */
  const asked = fetched();
  const refused = await ranAsync(FORGE, ["advance", "ISS-97"], tracker.env);
  assert.equal(refused.status, 1, refused.stdout);
  assert.equal(fetched() - asked, 1, "a move that prints no line pays no round to build one");
});

test("a plan declaring no screen change pays no round to hear what the project's deploy holds", async () => {
  const before = fetched();
  const quiet = await owed("ISS-98");
  assert.equal(quiet.status, 0, quiet.stderr);
  assert.doesNotMatch(quiet.stdout, /test credential/u, "nothing is said");
  assert.equal(fetched() - before, 1, "and nothing beyond the config every run reads was asked to say it");
});

/* The shortfall case above would read the same if the line became a fifth thing owed, `--owed`
   exiting zero either way. Here the record earns its move, and the move goes through. */
test("a record that earns its move still earns it, and the line is said over the top of it", async () => {
  state.deploy = {};
  const env = { ...tracker.env, FORGE_SESSION_ID: HOLDER };
  const said = await ranAsync(FORGE, ["advance", "ISS-99", "--owed"], env);
  assert.equal(said.status, 0, `${said.stdout}${said.stderr}`);
  assert.match(said.stdout, /in_progress is next and the record earns it/u, said.stdout);
  assert.doesNotMatch(said.stdout, /item\(s\) owed/u, "the line is no item owed");
  assert.match(said.stdout, /holds no test credential/u, "and it is said all the same");
  /* The tracker holds a session's first write until it has been shown the page, so a run reads and
     re-sends; the store above keeps the issue where it was, and the second send makes the move. */
  await ranAsync(FORGE, ["advance", "ISS-99"], env);
  const moved = await ranAsync(FORGE, ["advance", "ISS-99"], env);
  assert.equal(moved.status, 0, `${moved.stdout}${moved.stderr}`);
  assert.match(moved.stdout, /approved -> in_progress/u, "a project with no login is refused nothing");
});
