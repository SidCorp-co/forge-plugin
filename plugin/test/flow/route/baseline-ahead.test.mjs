/* The line that tells a run a cheap baseline exists, which is the whole difference between a citable
   result and a route nobody takes. It refuses nothing, so every case here is about what is said: the
   store it reads is one machine's, and an owed item reading it would make two checkouts of one issue
   answer differently — which is the one thing `advance` promises they never do. */
import assert from "node:assert/strict";
import test from "node:test";

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("baseline-ahead").path;
const { baselineAhead, headNow } = await import("../../../src/flow/route.mjs");
const { ANSWERED_BY_COMMENT, BASELINE_AT, ORDER } = await import("../../../src/flow/earned.mjs");
const { SHAPES } = await import("../../../src/flow/machine.mjs");
const { stampedNow } = await import("../../../src/flow/worklog.mjs");
const { publishBaseline } = await import("../../../src/flow/earned/published.mjs");
const { slugIfAny } = await import("../../../src/resolve/settings.mjs");

const below = { issue: { status: "approved" } };
const HEAD = "43b811e2c9d0f1a3b4c5d6e7f8091a2b3c4d5e6f";
const NEWER = "0f1e2d3c4b5a69788796a5b4c3d2e1f009182736";
const RESULT = "nothing fails: all 14 gate step(s) green at this commit";
const publish = (commit, version) => publishBaseline(
  { project: slugIfAny(), commit, gate: "npm run check", result: RESULT, scope: "whole", version },
);

test("--owed names the published baseline and the write that cites it, and says so where none is published", () => {
  assert.equal(BASELINE_AT, "in_progress", "the status a baseline earns, read off the sequence");
  assert.equal(ORDER.includes(BASELINE_AT), true);
  const bare = baselineAhead(below, "ISS-3", HEAD);
  assert.match(bare, /no ship has published a whole-tree result for the commit this checkout stands at/u,
    "with nothing published the silence is said rather than left to read as a pass");
  assert.match(bare, /forge record baseline ISS-3 --gate "<the project's gate>"/u, "and the fresh run is named");
  assert.doesNotMatch(bare, /--cited/u, "nothing invites a citation there is no authority for");
  publish(HEAD, "1.2.3");
  const said = baselineAhead(below, "ISS-3", HEAD);
  assert.match(said, /a ship published a whole-tree result for the commit this checkout stands at/u);
  assert.match(said, new RegExp(`--commit ${HEAD} --scope whole`, "u"), "the write it prints names that commit");
  assert.match(said, /--cited "the ship's gate at release 1\.2\.3"/u, "and says whose result is being leaned on");
  assert.match(said, /--result "nothing fails/u, "carrying what already fails, so none of it is retyped from memory");
});

test("the rehearsal reads the head in hand, and a publication for any other commit answers as none", () => {
  publish(NEWER, "1.2.4");
  assert.match(baselineAhead(below, "ISS-3", HEAD), /--cited "the ship's gate at release 1\.2\.3"/u,
    "a newer publication beside this head's does not displace it");
  const elsewhere = baselineAhead(below, "ISS-3", "9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f");
  assert.match(elsewhere, /no ship has published/u, "a head between two published commits is its own tree");
  assert.match(baselineAhead(below, "ISS-3", null), /no ship has published/u,
    "and a checkout whose head cannot be read at all is the same answer");
  assert.equal(headNow(), stampedNow(SHAPES.baseline).head ?? null,
    "the default head is the baseline write's own stamp, so the rehearsal and the write cannot disagree");
});

/* The line reaching a caller, which no call of the function proves. */
const ISSUE = {
  documentId: "ahead-uuid",
  issueId: "ISS-9",
  status: "approved",
  title: "the issue rehearsing the status a baseline earns",
  description: "no mark here",
  complexity: "m",
  acceptanceCriteria: "1. The first outcome.",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
};
const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { "ahead-uuid": [] },
  answer: {},
};
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
  if (args.action === "get") return ISSUE;
  if (args.action === "update") return Object.assign(ISSUE, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
state.answer.forge_comments = () => ({ comments: [], returned: 0, hasMore: false });
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

test("the rehearsal prints the line beside the owed items, and the items read no store", async () => {
  const env = { ...tracker.env, FORGE_SESSION_ID: "the-rehearsing-run" };
  const asked = await ranAsync(new URL("../../../bin/forge", import.meta.url).pathname,
    ["advance", "ISS-9", "--owed"], env);
  assert.equal(asked.status, 0, asked.stdout + asked.stderr);
  assert.match(asked.stdout, /Ahead: in_progress is earned by a baseline/u, "the line reaches a caller");
  assert.match(asked.stdout, /no ship has published a whole-tree result/u,
    "and says which way it went, this checkout having work in it that no gate answered for");
  assert.match(asked.stdout, /in_progress is next and the record does not earn it: 1 item\(s\) owed\./u,
    "beside the judgement, which is the record's own");
  assert.match(asked.stdout,
    /no baseline: the gate, what it already reports and the commit it ran at\n {4}forge record baseline ISS-9 --gate "<command>"/u,
    "and the owed item is the same words whatever the store holds, or two checkouts of one issue would part");
  assert.equal(state.calls.some((one) => one.args.action === "transition"), false, "and --owed moves nothing");
});

test("the line is said at every status below the one a baseline earns, and it refuses nothing", () => {
  const at = (status) => baselineAhead({ issue: { status } }, "ISS-3", HEAD);
  const under = ORDER.slice(0, ORDER.indexOf(BASELINE_AT));
  assert.ok(under.length, "there are statuses below it, so the sweep has something to sweep");
  for (const status of under) {
    assert.notEqual(at(status), null,
      `${status} is below the rung a baseline earns, and Phase 0 reads this before the issue is confirmed`);
  }
  for (const status of ORDER.slice(ORDER.indexOf(BASELINE_AT))) {
    assert.equal(at(status), null, `${status} has the baseline behind it, so the line is spent`);
  }
  /* Every side status is past the baseline and none of them is in the sequence, so a reader keyed on
     `!atLeast` answers for all of them and sends a parked or reopened issue to spend a phase it is
     long done with. `waiting` is where a park from the judging rung lands. */
  for (const status of ["waiting", ANSWERED_BY_COMMENT, "reopen", "blocked", "paused"]) {
    assert.equal(at(status), null, `${status} is no step of the sequence, so this line is not its answer`);
  }
  assert.equal(ORDER.includes("waiting"), false, "which is the property the case above rests on");
  /* Watched failing: a reader keyed on the wrong project would answer for this head all the same. */
  assert.match(at("open"), /--cited/u, "this head is published under this project");
  assert.equal(publishBaseline({ project: "some-other-project", commit: "5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c",
    gate: "npm run check", result: RESULT, scope: "whole" }), "wrote");
  assert.match(baselineAhead(below, "ISS-3", "5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c"), /no ship has published/u,
    "and another project's publication of a commit is not this project's answer");
});

/* The positive branch through the shipped defaults: no head injected and no store stubbed, driven
   from a checkout of its own whose HEAD really is published. It is the only case that would notice
   `headNow` wired to the wrong reader, the seam above taking the head as a parameter. */
test("the rehearsal cites the published head from a clean checkout, reading the head for itself", async () => {
  const room = tempRoom("ahead-checkout-");
  const as = (...args) => spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", "-b", "master", room], { encoding: "utf8" });
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "forge-plugin" }));
  as("add", ".");
  as("commit", "-qm", "base");
  const at = as("rev-parse", "HEAD").stdout.trim();
  assert.equal(as("status", "--porcelain").stdout, "", "the checkout is clean, so a head is stampable");
  const env = { ...tracker.env, FORGE_SESSION_ID: "the-clean-run" };
  const mine = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = env.XDG_CONFIG_HOME;
  assert.equal(publishBaseline({ project: "forge-plugin", commit: at, gate: "npm run check",
    result: RESULT, scope: "whole", version: "3.0.0" }), "wrote");
  process.env.XDG_CONFIG_HOME = mine;
  const asked = await ranAsync(new URL("../../../bin/forge", import.meta.url).pathname,
    ["advance", "ISS-9", "--owed"], env, room);
  assert.equal(asked.status, 0, asked.stdout + asked.stderr);
  assert.match(asked.stdout, /a ship published a whole-tree result for the commit this checkout stands at/u,
    "the head it read for itself is the one the store holds");
  assert.match(asked.stdout, new RegExp(`--commit ${at} --scope whole`, "u"), "and the write it prints names that commit");
  assert.match(asked.stdout, /--cited "the ship's gate at release 3\.0\.0"/u);
});
