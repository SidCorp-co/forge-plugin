/* ISS-28 / FB-33: no `record design` kind existed, so a run met the design gate only as core's
   refusal of the move into build. The kind PUTs the whole design — each criterion classed and
   proven, the modules and contracts it touches — to /issues/:id/design, and every shape rule is
   earned here before the call goes out. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("record-design-");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ISSUE = {
  documentId: "design-uuid",
  issueId: "ISS-92",
  status: "in_progress",
  workState: { step: "build" },
  title: "a change core gates on a design",
  description: "no design here",
  acceptanceCriteria: "1. The first outcome.\n2. The second outcome.",
  complexity: "m",
};
const project = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { "design-uuid": [] },
  answer: {
    forge_config: () => ({ config: project.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: project.issues, returned: 1, hasMore: false };
      const held = project.issues.find((one) => one.documentId === args.documentId) ?? ISSUE;
      if (args.action === "get") return held;
      if (args.action === "update") return Object.assign(held, args.data);
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    "forge_issues.record_design": () => ({}),
  },
};
const { tracker, env: ENV } = await trackerFor(project);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-92", "--unheld"], ENV);

const design = (...argv) => ranAsync(FORGE, ["record", "design", "ISS-92", ...argv], ENV);
const lastPut = () => project.calls.filter((one) => one.name === "forge_issues.record_design").at(-1);

test("a design PUTs each criterion classed and proven, with the modules and contracts it touches", async () => {
  const run = await design(
    "--criterion", "1", "--class", "observable", "--pattern", "clip", "--proof", "a webm of the sorted list",
    "--criterion", "2", "--class", "code_property", "--proof", "the reviewer reads sortBy",
    "--module", "flow", "--module", "tracker", "--contract", "forge-plugin/issue-design");
  assert.equal(run.status, 0, run.stderr);
  const put = lastPut();
  assert.ok(put, "the design was PUT");
  assert.deepEqual(put.args.data, {
    criteria: [
      { criterion: 1, class: "observable", pattern: "clip", proof: "a webm of the sorted list" },
      { criterion: 2, class: "code_property", pattern: null, proof: "the reviewer reads sortBy" },
    ],
    modules: ["flow", "tracker"],
    contracts: ["forge-plugin/issue-design"],
  });
  assert.match(run.stdout, /design recorded: 2 criteria, 2 module\(s\), 1 contract\(s\)/u, run.stdout);
});

test("a design with one criterion and no modules sends an empty module and contract list", async () => {
  const run = await design("--criterion", "1", "--class", "server_side", "--proof", "the row carries the field");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(lastPut().args.data, {
    criteria: [{ criterion: 1, class: "server_side", pattern: null, proof: "the row carries the field" }],
    modules: [],
    contracts: [],
  });
  assert.match(run.stdout, /design recorded: 1 criterion, 0 module\(s\), 0 contract\(s\)/u, run.stdout);
});

test("a criterion with no proof is refused, and nothing is sent", async () => {
  const before = project.calls.length;
  const run = await design("--criterion", "1", "--class", "observable");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /criterion 1 needs --proof/u, run.stderr);
  assert.equal(run.stdout, "");
  assert.ok(!project.calls.slice(before).some((one) => one.name === "forge_issues.record_design"), "no PUT");
});

test("a criterion whose class is none of the three is refused naming the set", async () => {
  const run = await design("--criterion", "1", "--class", "vibes", "--proof", "x");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--class, one of observable, server_side, code_property/u, run.stderr);
});

test("a design naming one criterion twice is refused", async () => {
  const run = await design("--criterion", "1", "--class", "observable", "--proof", "a",
    "--criterion", "1", "--class", "code_property", "--proof", "b");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /names criterion 1 twice/u, run.stderr);
});

test("a flag standing before the first --criterion is refused", async () => {
  const run = await design("--class", "observable", "--criterion", "1", "--proof", "x");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stands before the first --criterion/u, run.stderr);
});

test("a design naming no criterion at all is refused with the form", async () => {
  const run = await design("--module", "flow");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /names a criterion per criterion of the issue/u, run.stderr);
  assert.match(run.stderr, /forge record design ISS-92 --criterion/u, run.stderr);
});

test("a flag the kind does not take is refused as a stranger, before anything is sent", async () => {
  const run = await design("--criterion", "1", "--class", "observable", "--proof", "x", "--bogus", "y");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--bogus/u, run.stderr);
});
