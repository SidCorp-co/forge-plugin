/* A batch is named on each member's record by the claim its run takes in the batch's tree, and the
   resume of one member reads every sibling live. Each case fails without its part of the change:
   the write, the clear, the line and the shape (ISS-64). */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { git, projectRecord, ranAsync, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("batch-");
const { mintRunId } = await import("../../../src/resolve/session/run-id.mjs");
const { batchFor, batchLine, batchLive } = await import("../../../src/flow/lease/batch.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const HEAD_11 = "abc1234def5678abc1234def5678abc1234def56";
const HEAD_13 = "1234567890abcdef1234567890abcdef12345678";

/* A checkout holding one commit and the run id a dispatch minted for `keys`. */
const treeFor = (keys) => {
  const room = tempRoom("batch-tree-");
  spawnSync("git", ["init", "-q", "-b", "iss-work", room], { cwd: room, encoding: "utf8" });
  writeFileSync(join(room, "one.txt"), "one\n");
  git(room, "add", "one.txt");
  git(room, "commit", "-qm", "one");
  projectRecord(room, BASE.XDG_CONFIG_HOME, OWN);
  return { room, id: mintRunId(room, keys) };
};

const worklog = (extra) => ({ worklog: { branch: "iss-work", head: "fff0000", at: "2026-09-26T00:00:00.000Z", ...extra } });

/* Keyed by sequence, so the key resolution's offset read lands on the row whose number it asked for. */
const row = (n, status, extra = {}) => ({
  documentId: `uuid-${n}`, issueId: `ISS-${n}`, title: `issue ${n}`, status,
  createdAt: `2026-09-01T00:${String(n).padStart(2, "0")}:00.000Z`, ...extra,
});

const ALL = "ISS-10, ISS-11, ISS-12, ISS-13, ISS-15";
const REFUSED = "the tracker will not read uuid-15";
const ISSUES = Array.from({ length: 21 }, (_, at) => row(at + 1, "open"));
Object.assign(ISSUES[2], { sessionContext: worklog({ batch: "ISS-3, ISS-4" }) });
Object.assign(ISSUES[4], { sessionContext: worklog({ batch: "ISS-5, ISS-6" }) });
Object.assign(ISSUES[9], { status: "in_progress", acceptanceCriteria: "1. The first outcome.", sessionContext: worklog({ batch: ALL }) });
Object.assign(ISSUES[10], { status: "in_progress", sessionContext: worklog({ head: HEAD_11, batch: ALL }) });
Object.assign(ISSUES[12], { status: "developed", sessionContext: worklog({ head: HEAD_13, batch: "ISS-13, ISS-14" }) });
Object.assign(ISSUES[19], { status: "in_progress", sessionContext: worklog({}) });

const project = {
  calls: [],
  config: { baseBranch: "master" },
  issues: ISSUES,
  answer: {
    /* Kept on the row, since the next read of it is what a case asserts on. */
    forge_issues: (args) => {
      if (args.action === "get" && args.documentId === "uuid-15") return { refused: REFUSED };
      if (args.action !== "update") return undefined;
      return Object.assign(ISSUES.find((one) => one.documentId === args.documentId), args.data);
    },
  },
};

const { tracker, env: BASE } = await trackerFor(project, []);
test.after(() => tracker.close());

const forgeIn = (cwd, ...argv) => ranAsync(FORGE, argv, BASE, cwd);
/* The read-before-write hold delivers an unread thread once and asks for the command again. */
const claimIn = async (cwd, ...argv) => {
  const first = await forgeIn(cwd, "claim", ...argv);
  return first.status === 0 ? first : forgeIn(cwd, "claim", ...argv);
};
const batchOf = (n) => ISSUES[n - 1].sessionContext?.worklog?.batch;
const lineOf = (text) => text.split("\n").find((one) => one.trim().startsWith("batch "))?.trim() ?? null;

test("a run id naming several issues names the batch for a member of it, and for nothing else", () => {
  const { room } = treeFor(["ISS-1", "ISS-2"]);
  assert.equal(batchFor("ISS-2", room), "ISS-1, ISS-2", "head first, every key the id names");
  assert.equal(batchFor("ISS-7", room), null, "a key the id does not name");
  assert.equal(batchFor("ISS-1", treeFor(["ISS-1"]).room), null, "an id naming one issue is no batch");
});

test("a claim in the batch's tree writes the batch onto the member's worklog, and says where it read it", async () => {
  const { room, id } = treeFor(["ISS-1", "ISS-2"]);
  const run = await claimIn(room, "ISS-1");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(batchOf(1), "ISS-1, ISS-2");
  assert.ok(run.stdout.includes(`batch: ISS-1, ISS-2, read off the run id ${id} this tree was minted under`), run.stdout);
  const again = await claimIn(room, "ISS-1");
  assert.equal(again.status, 0, again.stderr);
  assert.doesNotMatch(again.stdout, /^batch: /mu, "a batch the worklog already holds is not said again");
});

test("a bare claim from a tree not naming the member among several leaves its batch standing", async () => {
  const { room } = treeFor(["ISS-3"]);
  const run = await claimIn(room, "ISS-3");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(batchOf(3), "ISS-3, ISS-4");
  assert.doesNotMatch(run.stdout, /^batch: /mu);
});

test("a capture from a tree not naming the member among several clears its batch, and names what it cleared", async () => {
  const { room } = treeFor(["ISS-5"]);
  const run = await claimIn(room, "ISS-5", "--pushed");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(batchOf(5), undefined, "the field is gone from the worklog");
  assert.match(run.stdout, /^batch: ISS-5, ISS-6 cleared, since this capture was taken in a tree whose run id does not name this member among several\.$/mu);
});

const LINE = "batch       with ISS-11 in_progress at abc1234; ISS-12 open, no capture, names no batch; "
  + "ISS-13 developed at 1234567, names another batch; ISS-15 unreadable:";

test("resume names every sibling with its status, its captured head and whether it names this batch", async () => {
  const run = await forgeIn(process.cwd(), "resume", "ISS-10");
  assert.equal(run.status, 0, run.stderr);
  const line = lineOf(run.stdout);
  assert.ok(line?.startsWith(LINE), `${line}\n${run.stdout}`);
  assert.ok(line.includes(REFUSED), "the tracker's own words for the one it would not answer for");
  assert.match(run.stdout, /^Criteria$/mu, "and the rest of the issue still prints");
  assert.match(run.stdout, /^Read: /mu);
});

test("each sibling is read at the moment of the resume, never off the member's own worklog", async () => {
  ISSUES[10].status = "developed";
  try {
    const run = await forgeIn(process.cwd(), "resume", "ISS-10");
    assert.match(lineOf(run.stdout), /^batch {7}with ISS-11 developed at abc1234; /u);
  } finally {
    ISSUES[10].status = "in_progress";
  }
});

test("the report prints the same batch line", async () => {
  const brief = lineOf((await forgeIn(process.cwd(), "resume", "ISS-10")).stdout);
  const report = await forgeIn(process.cwd(), "resume", "ISS-10", "--report");
  assert.equal(report.status, 0, report.stderr);
  assert.ok(lineOf(report.stdout)?.startsWith(LINE), report.stdout);
  assert.equal(lineOf(report.stdout), brief);
});

test("--json carries the batch in the one shape batchLive owns", async () => {
  const run = await forgeIn(process.cwd(), "resume", "ISS-10", "--json");
  assert.equal(run.status, 0, run.stderr);
  const { batch } = JSON.parse(run.stdout);
  assert.deepEqual(batch.members, ["ISS-10", "ISS-11", "ISS-12", "ISS-13", "ISS-15"]);
  assert.deepEqual(batch.siblings.slice(0, 3), [
    { key: "ISS-11", status: "in_progress", head: HEAD_11, batch: "same" },
    { key: "ISS-12", status: "open", head: null, batch: "none" },
    { key: "ISS-13", status: "developed", head: HEAD_13, batch: "other" },
  ]);
  assert.deepEqual(Object.keys(batch.siblings[3]), ["key", "unreadable"]);
  assert.equal(batch.siblings[3].key, "ISS-15");
  assert.ok(batch.siblings[3].unreadable.includes(REFUSED), batch.siblings[3].unreadable);
});

test("a member naming no batch prints no batch line and reads no issue but its own", async () => {
  const before = project.calls.length;
  const run = await forgeIn(process.cwd(), "resume", "ISS-20");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(lineOf(run.stdout), null);
  const read = project.calls.slice(before).filter((one) => one.name === "forge_issues")
    .map((one) => one.args.documentId).filter(Boolean);
  assert.deepEqual([...new Set(read)], ["uuid-20"]);
  assert.equal(await batchLive({ branch: "x" }, "ISS-20", () => assert.fail("read")), null);
  assert.equal(batchLine(null), null);
});
