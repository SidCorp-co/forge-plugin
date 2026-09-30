/* A park record says the issue waits on somebody, and `closed` and `dropped` say nobody is waited on.
   `forge record park` moves no status, so at either it left a record the status contradicted: ISS-497
   was parked for a screen review and stayed closed (ISS-1750). Refused there, and the refusal is the
   park through advance, which writes the same record and moves the status — run here as printed. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("park-finished").path;
const { parse } = await import("../../../src/flow/record/page.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const issue = (key, status) => ({ documentId: `${key}-uuid`, issueId: key, status, title: "t", description: "d", complexity: "m" });

const CLOSED = issue("ISS-21", "closed");
const DROPPED = issue("ISS-22", "dropped");
const ASKED = issue("ISS-23", "closed");
const WORKING = issue("ISS-24", "in_progress");

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "none", pipelineConfig: { autoProdDeploy: true } },
  issues: [CLOSED, DROPPED, ASKED, WORKING],
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      const held = state.issues.find((one) => one.documentId === args.documentId);
      if (args.action === "get") return held ?? {};
      if (args.action === "update" && held) return Object.assign(held, args.data);
      if (args.action === "transition" && held) return Object.assign(held, { status: args.data.status });
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = { documentId: `made-${state.calls.length}`, createdAt: new Date().toISOString(),
          authorId: "agent", authorDeviceId: "a-device", body: args.data.body };
        (state.comments[args.data.issue] ??= []).push(one);
        return one;
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());

const READS = ["get", "list"];
const writesSince = (at) => state.calls.slice(at).filter((one) => !READS.includes(one.args?.action));

/* The read-before-write gate may hold the first claim once, which is not what any case here is about. */
const claimed = async (key) => {
  let run = await ranAsync(FORGE, ["claim", key, "--unheld"], ENV);
  if (run.status !== 0) run = await ranAsync(FORGE, ["claim", key, "--unheld"], ENV);
  assert.equal(run.status, 0, run.stderr);
};

const parksOn = (held) => (state.comments[held.documentId] ?? [])
  .map((one) => parse(one.body ?? "")).filter((one) => one?.kind === "park");

const WHY = "the release isn't mine to close";
const EVIDENCE = ["https://app.example/shot/1.png", "https://app.example/shot/2.png"];

/* Refused with nothing sent, then the command the refusal printed, run as a shell reads it. */
const refusedThenReplayed = async (held, kind, side) => {
  /* Read before anything runs: the fixture moves the very object it serves. */
  const finished = held.status;
  await claimed(held.issueId);
  const at = state.calls.length;
  const refused = await ranAsync(FORGE, ["record", "park", held.issueId, "--kind", kind, "--why", WHY,
    ...EVIDENCE.flatMap((one) => ["--evidence", one])], ENV);
  assert.equal(refused.status, 1, refused.stdout);
  assert.deepEqual(writesSince(at).map((one) => `${one.name} ${one.args?.action}`), [], "a refused park wrote");
  assert.match(refused.stderr, new RegExp(`${held.issueId} is ${finished}, which owes nothing further`, "u"), refused.stderr);
  const command = refused.stderr.split("\n").find((line) => line.startsWith("  forge advance "));
  assert.ok(command, `the refusal names no advance to run:\n${refused.stderr}`);
  assert.ok(command.startsWith(`  forge advance ${held.issueId} --park ${kind} --why `), command);
  const replayed = await ranAsync("bash", ["-c", command.trim().replace(/^forge /u, `${FORGE} `)], ENV);
  assert.equal(replayed.status, 0, `${command}\n${replayed.stderr}`);
  const parks = parksOn(held);
  assert.equal(parks.length, 1, `one park record, not ${parks.length}`);
  assert.deepEqual(parks[0].fields, { kind, why: WHY, evidence: EVIDENCE, left: finished });
  assert.equal(state.issues.find((one) => one.issueId === held.issueId).status, side);
};

test("a park record at closed is refused, and the advance it names parks the issue off closed", async () => {
  await refusedThenReplayed(CLOSED, "paused", "on_hold");
});

test("a park record at dropped is refused the same way, and its advance parks the issue off dropped", async () => {
  await refusedThenReplayed(DROPPED, "screen-review", "waiting");
});

/* A question asks only from open or confirmed, so printing the advance would send the caller to a
   second refusal: that refusal is carried instead. */
test("where the park through advance refuses the call too, its refusal is carried and no command", async () => {
  await claimed("ISS-23");
  const at = state.calls.length;
  const run = await ranAsync(FORGE, ["record", "park", "ISS-23", "--kind", "question", "--why", WHY], ENV);
  assert.equal(run.status, 1, run.stdout);
  assert.deepEqual(writesSince(at), []);
  assert.match(run.stderr, /The park through advance, which moves the status, refuses it too:\na question goes to the reporter, and ISS-23 is closed/u, run.stderr);
  assert.doesNotMatch(run.stderr, /forge advance ISS-23 --park question/u);
});

test("a park record at a lane status still goes up", async () => {
  await claimed("ISS-24");
  const run = await ranAsync(FORGE, ["record", "park", "ISS-24", "--kind", "paused", "--why", "left for the night"], ENV);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(parksOn(WORKING).map((one) => one.fields.left), ["in_progress"]);
});

test("the park kind's help says where it is refused and what to run there", async () => {
  const run = await ranAsync(FORGE, ["record", "park", "-h"], ENV);
  assert.equal(run.status, 0, run.stderr);
  const said = run.stdout.replace(/\n/gu, " ");
  assert.match(said, /refused on an issue at closed or dropped/u, run.stdout);
  assert.match(said, /`forge advance <ref> --park <kind> --why W` writes the same record and moves the status/u, run.stdout);
});
