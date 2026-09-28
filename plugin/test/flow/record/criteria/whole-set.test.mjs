/* A criteria write replaces the whole set the field holds, so one that would drop a held number is
   refused until the caller says it means to, and every field write says what it did to the value it
   replaced (ISS-1444, ISS-2009). Each case drives the verb against a fake tracker and reads what
   reached it. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("whole-set").path;

const room = tempRoom("whole-set-");
const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const MINE = "whole-set-run";

const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [],
  comments: {},
  writes: [],
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      const issue = state.issues.find((one) => one.documentId === args.documentId) ?? state.issues[0];
      if (args.action === "update") {
        if (["plan", "acceptanceCriteria"].some((one) => one in args.data)) state.writes.push(args.data);
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

const lease = () => ({ lease: { holder: MINE, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] } });

const issue = (key, fields) => {
  const documentId = `${key}-uuid`;
  state.issues = [{ documentId, issueId: key, title: "criteria written whole", description: "x",
    complexity: "m", status: "open", sessionContext: lease(), ...fields }];
  state.comments = { [documentId]: [] };
  state.writes = [];
  return state.issues[0];
};

const numbered = (from, to, word = "outcome") =>
  Array.from({ length: to - from + 1 }, (_, at) => `${from + at}. The ${word} numbered ${from + at} holds.`).join("\n");

const fileOf = (text) => {
  const path = join(room, `criteria-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(path, `${text}\n`);
  return path;
};

const ask = (argv, over = env) => ranAsync(FORGE, ["record", ...argv], over);

test("a criteria file leaving out held numbers is refused, naming both counts, each dropped number and both routes", async () => {
  const held = issue("ISS-8101", { acceptanceCriteria: numbered(1, 53) });
  const run = await ask(["criteria", "ISS-8101", fileOf(numbered(45, 53))]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /ISS-8101 holds 53 criteria and this file holds 9/u, "both counts");
  assert.match(run.stderr, /would drop 44 of them: 1-44\b/u, "each held number the write drops");
  assert.match(run.stderr, /forge issue ISS-8101 --fields acceptanceCriteria/u, "the route to the complete file");
  assert.match(run.stderr, /--replace/u, "and the route that drops them on purpose");
  assert.deepEqual(state.writes, [], "nothing was sent");
  assert.equal(held.acceptanceCriteria, numbered(1, 53));
});

test("a criteria set whose lowest number is not 1 is refused, with nothing held as well", async () => {
  issue("ISS-8102", {});
  const run = await ask(["criteria", "ISS-8102", fileOf(numbered(10, 12))]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /opens at 10/u);
  assert.match(run.stderr, /--replace/u);
  assert.deepEqual(state.writes, []);
});

test("--replace stores a set that drops held numbers, and stderr names the counts and what was dropped", async () => {
  const held = issue("ISS-8103", { acceptanceCriteria: numbered(1, 5) });
  const run = await ask(["criteria", "ISS-8103", fileOf(numbered(1, 2)), "--replace"]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(held.acceptanceCriteria, numbered(1, 2));
  assert.match(run.stderr, /^criteria: the field held 5 and now holds 2; dropped 3-5\.$/mu);
});

test("--replace on a write that drops nothing is refused as a flag this write does not use", async () => {
  issue("ISS-8104", { acceptanceCriteria: numbered(1, 2) });
  const run = await ask(["criteria", "ISS-8104", fileOf(numbered(1, 3)), "--replace"]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--replace drops criteria the field holds, and this write drops none/u);
  assert.deepEqual(state.writes, []);
});

test("a write rewording held numbers, or splitting one and renumbering the tail, lands and says the counts", async () => {
  const held = issue("ISS-8105", { acceptanceCriteria: numbered(1, 3) });
  const reworded = await ask(["criteria", "ISS-8105", fileOf(numbered(1, 3, "reworded outcome"))]);
  assert.equal(reworded.status, 0, reworded.stderr);
  assert.match(reworded.stderr, /^criteria: the field held 3 and now holds 3\.$/mu, "a full write is as legible as a reducing one");
  const split = await ask(["criteria", "ISS-8105", fileOf(numbered(1, 4))]);
  assert.equal(split.status, 0, split.stderr);
  assert.equal(held.acceptanceCriteria, numbered(1, 4));
  assert.match(split.stderr, /^criteria: the field held 3 and now holds 4; added 4\.$/mu);
});

test("a plan write says how many lines the field held and how many it holds now", async () => {
  issue("ISS-8106", { plan: "The first reading.\nIts second line.\nIts third line." });
  const run = await ask(["plan", "ISS-8106", fileOf("The second reading.")]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /^plan: the field held 3 lines and now holds 1, replaced whole\.$/mu);
});

test("a partial criteria file is refused for the drop before the consult it has not had", async () => {
  issue("ISS-8107", { acceptanceCriteria: numbered(1, 5) });
  const consulting = { ...env };
  delete consulting.FORGE_CODEX_DISABLE;
  const run = await ask(["criteria", "ISS-8107", fileOf(numbered(1, 2))], consulting);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /holds 5 criteria and this file holds 2/u);
  assert.doesNotMatch(run.stderr, /consult/iu, "no review round is asked for a file the write refuses anyway");
});
