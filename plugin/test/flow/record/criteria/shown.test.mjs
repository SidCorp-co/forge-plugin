/* Whether anybody can show a criterion once the change has landed (ISS-3154): the declared gate
   passing is refused before the issue is read, and a measurement over repeated runs or under load is
   written and named on stderr. Each case drives the verb against a fake tracker and reads what
   reached it. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { OWN, trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("shown").path;

const room = tempRoom("shown-");
const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const MINE = "shown-run";

const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [],
  comments: {},
  writes: [],
  reads: 0,
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      state.reads += 1;
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      const issue = state.issues.find((one) => one.documentId === args.documentId) ?? state.issues[0];
      if (args.action === "update") {
        if ("acceptanceCriteria" in args.data) state.writes.push(args.data);
        Object.assign(issue, args.data);
      }
      return issue;
    },
    forge_comments: (args) => {
      const id = args.filters?.issue ?? args.data?.issue ?? state.issues[0].documentId;
      const held = (state.comments[id] ??= []);
      if (args.action === "list") return { comments: held, returned: held.length, hasMore: false };
      const row = { documentId: `c-${held.length + 1}-${id}`, createdAt: new Date().toISOString(), authorDeviceId: "a-device", body: args.data.body };
      held.push(row);
      return row;
    },
  },
};

const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());

const env = { ...ENV, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: MINE, FORGE_CODEX_DISABLE: "1" };

/* A checkout whose project declares everything this one does but a gate. */
const noGate = projectRoom(tempRoom("shown-no-gate-"), ENV.XDG_CONFIG_HOME, { ...OWN, stats: {} });

const lease = () => ({ lease: { holder: MINE, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] } });

const issue = (key) => {
  const documentId = `${key}-uuid`;
  state.issues = [{ documentId, issueId: key, title: "criteria someone can show", description: "x",
    complexity: "m", status: "open", sessionContext: lease() }];
  state.comments = { [documentId]: [] };
  state.writes = [];
  state.reads = 0;
};

const fileOf = (...lines) => {
  const path = join(room, `criteria-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(path, `${lines.map((one, at) => `${at + 1}. ${one}`).join("\n")}\n`);
  return path;
};

const write = (key, lines, cwd) => {
  issue(key);
  return ranAsync(FORGE, ["record", "criteria", key, fileOf(...lines)], env, cwd);
};

const written = () => state.writes.at(-1)?.acceptanceCriteria ?? "";

test("a criterion making the declared gate's pass its outcome is refused, naming the criterion and the landing", async () => {
  const run = await write("ISS-9101", ["The list shows the empty state.", "`npm run check` passes on the branch."]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^ {2}2\. `npm run check` passes on the branch\.$/mu, "the criterion, by its number");
  assert.match(run.stderr, /the landing\s+runs it before the merge: that run is the proof/u, "the landing as what proves it");
  assert.equal(state.reads, 0, "refused before the issue is read");
  assert.doesNotMatch(run.stderr, /consult/iu, "and before a consult is asked for");
  assert.equal(state.writes.length, 0);

  const flagged = await write("ISS-9102", ["The whole gate, `node tools/gates.mjs --full`, passes at the head that lands."]);
  assert.equal(flagged.status, 1, flagged.stdout);
  assert.match(flagged.stderr, /`node tools\/gates\.mjs` is this project's gate/u, "the other declared command, under its own flags");
});

test("a criterion naming the gate for what it does rather than for its pass is written", async () => {
  const lines = [
    "`npm run check -- --full` spends every test file whatever the records hold.",
    "`node tools/gates.mjs -h` exits 0.",
    "`npm run check:vendor` passes on the branch.",
    "A criterion reading \"`npm run check` passes on the branch\" is refused.",
  ];
  const run = await write("ISS-9103", lines);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(written(), lines.map((one, at) => `${at + 1}. ${one}`).join("\n"));
});

test("a project declaring no gate has no criterion refused for naming one", async () => {
  const run = await write("ISS-9104", ["`npm run check` passes on the branch."], noGate);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(written(), "1. `npm run check` passes on the branch.");
});

test("a load or repeat-run criterion is written and named on stderr as the builder's evidence", async () => {
  const lines = [
    "Twenty consecutive runs of that file each take under 1.8 s.",
    "Two different runs answer as no read.",
    "At a one-minute load of 25 or more the case takes under 1.8 s.",
    "Sixteen runs of the employee-layout case all pass.",
  ];
  const run = await write("ISS-9105", lines);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(written().split("\n").length, 4, "every line written");
  assert.match(run.stderr, /record criteria: criteria 1, 3, 4 are measured over repeated runs or under load/u);
  assert.match(run.stderr, /the builder's evidence/u);
  assert.doesNotMatch(run.stderr, /^ {2}2\. /mu, "a count of runs that measures nothing is not named");
});

test("the criteria help names the gate commands this project declares", async () => {
  const run = await ranAsync(FORGE, ["record", "criteria", "-h"], env);
  assert.equal(run.status, 0, run.stderr);
  const said = run.stdout.replace(/\s+/gu, " ");
  assert.match(said, /This project's gate is `npm run check` or `node tools\/gates\.mjs`, under `stats\.commands\.gate`\./u);
  assert.match(said, /A criterion whose outcome is the gate passing is refused/u);
  assert.match(said, /A criterion measured over repeated runs or under load is written and named on stderr as the builder's evidence/u);

  const none = await ranAsync(FORGE, ["record", "criteria", "-h"], env, noGate);
  assert.match(none.stdout.replace(/\s+/gu, " "), /This project declares no gate under `stats\.commands\.gate`, so no criterion is refused for naming one\./u);
});
