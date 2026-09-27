/* A move-first park that dies between its two writes leaves the issue in on_hold with no record, and
   nothing on the page says where it came from. The tracker's own history does, so a park or a park
   record written there reads it, and whoever meets the issue next is told which record finishes it
   (ISS-425). The fixture tracker serves no history route, so a proxy in front of it answers that one
   path in the shape the tracker serves and passes every other request through. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { join } from "node:path";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("park-finish").path;
const { parse } = await import("../../../src/flow/record/page.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const held = (key, status) => ({
  documentId: `${key}-uuid`,
  issueId: key,
  status,
  title: "the park whose record did not go up",
  description: "no mark here",
  complexity: "s",
});

const RESENT = held("ISS-81", "on_hold");
const RECORDED = held("ISS-82", "on_hold");
const UNREAD = held("ISS-83", "on_hold");
const MET = held("ISS-84", "on_hold");

const moved = (id, from, to, at) => ({ id, action: "issue.statusChanged", payload: { from, to }, createdAt: at });
const said = (id, at) => ({ id, action: "comment.created", payload: {}, createdAt: at });

/* Newest first, as the tracker answers: a comment after the move, the move, and an older one. */
const HISTORY = {
  [RESENT.documentId]: [said("e3", "2026-09-20T10:05:00.000Z"),
    moved("e2", "in_progress", "on_hold", "2026-09-20T10:00:00.000Z"),
    moved("e1", "approved", "in_progress", "2026-09-19T10:00:00.000Z")],
  /* From one side status to another: where the park leaves is where the first of them was entered from. */
  [RECORDED.documentId]: [moved("e5", "waiting", "on_hold", "2026-09-20T09:00:00.000Z"),
    moved("e4", "approved", "waiting", "2026-09-20T08:30:00.000Z")],
  [UNREAD.documentId]: [said("e6", "2026-09-20T08:00:00.000Z")],
  [MET.documentId]: [moved("e7", "testing", "on_hold", "2026-09-20T07:00:00.000Z")],
};

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [RESENT, RECORDED, UNREAD, MET],
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      const found = state.issues.find((one) => one.documentId === args.documentId);
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "get") return found ?? {};
      if (args.action === "update" && found) return Object.assign(found, args.data);
      if (args.action === "transition" && found) return Object.assign(found, { status: args.data.status });
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = { documentId: `comment-${state.calls.length}`, createdAt: new Date().toISOString(),
          authorId: "agent", authorDeviceId: "a-device", body: args.data.body.replace(/^⟦[^⟧]*⟧\n|\n⟦[^⟧]*⟧$/gu, "") };
        (state.comments[args.data.issue] ??= []).push(one);
        return one;
      }
      const page = state.comments[args.filters?.issue] ?? [];
      return { comments: page, returned: page.length, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state);

const ACTIVITY = /^\/api\/issues\/([^/]+)\/activity$/u;
const asked = [];
const proxy = createServer((incoming, outgoing) => {
  const url = new URL(incoming.url, "http://x");
  const found = ACTIVITY.exec(url.pathname);
  if (found) {
    asked.push(found[1]);
    outgoing.writeHead(200, { "Content-Type": "application/json" });
    outgoing.end(JSON.stringify({ items: HISTORY[found[1]] ?? [], nextBefore: null }));
    return;
  }
  const target = new URL(tracker.url);
  const passed = request({ host: target.hostname, port: target.port, path: incoming.url,
    method: incoming.method, headers: incoming.headers }, (answer) => {
    outgoing.writeHead(answer.statusCode, answer.headers);
    answer.pipe(outgoing);
  });
  incoming.pipe(passed);
});
await new Promise((ready) => proxy.listen(0, "127.0.0.1", ready));
const CONFIG = join(ENV.XDG_CONFIG_HOME, "forge", "config.json");
writeFileSync(CONFIG, JSON.stringify({ ...JSON.parse(readFileSync(CONFIG, "utf8")),
  url: `http://127.0.0.1:${proxy.address().port}/mcp` }));
test.after(() => {
  proxy.close();
  tracker.close();
});

const forge = (...argv) => ranAsync(FORGE, argv, ENV);
for (const one of state.issues) await forge("claim", one.issueId, "--unheld");

const sentFor = (documentId, action) => state.calls.filter((one) => one.name === "forge_issues"
  && one.args.action === action && one.args.documentId === documentId);
const postedTo = (documentId) => state.comments[documentId] ?? [];
const leftOn = (comment) => parse(comment.body)?.fields.left;

test("a park sent again where its move landed and its record did not posts the record alone", async () => {
  const run = await forge("advance", "ISS-81", "--park", "blocked", "--why", "the upstream fix has not shipped");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(sentFor(RESENT.documentId, "transition"), [], "no move was sent: the move is the half that landed");
  assert.equal(postedTo(RESENT.documentId).length, 1, "and the record went up");
  assert.equal(RESENT.status, "on_hold");
  assert.match(run.stdout, /ISS-81 {2}on_hold already, with no park record since it moved there/u, run.stdout);
});

test("the record that finishes a park names the status the tracker's history says the issue left", () => {
  const [record] = postedTo(RESENT.documentId);
  assert.equal(parse(record.body)?.kind, "park");
  assert.equal(leftOn(record), "in_progress", "the newest move into on_hold came from in_progress, not on_hold");
});

test("once the finishing record is up, the advance resumes where it says the issue left", async () => {
  const run = await forge("advance", "ISS-81", "--owed");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /in_progress is next/u, run.stdout);
});

test("a park record written at a side status stamps where the history says the issue came from", async () => {
  const run = await forge("record", "park", "ISS-82", "--kind", "paused", "--why", "waiting on the owner");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const [record] = postedTo(RECORDED.documentId);
  assert.equal(leftOn(record), "approved", "where the history says it entered side statuses from, never a side status");
  assert.deepEqual(asked.filter((one) => one === RECORDED.documentId).length > 0, true, "read off the history");
});

test("a park where the history names no move into the side status is refused, nothing posted, naming the set", async () => {
  for (const argv of [["advance", "ISS-83", "--park", "blocked", "--why", "w"],
    ["record", "park", "ISS-83", "--kind", "paused", "--why", "w"]]) {
    const run = await forge(...argv);
    assert.equal(run.status, 1, `${argv.join(" ")}: ${run.stdout}`);
    assert.deepEqual(postedTo(UNREAD.documentId), [], `${argv.join(" ")} posted nothing`);
    assert.deepEqual(sentFor(UNREAD.documentId, "transition"), [], `${argv.join(" ")} moved nothing`);
    assert.match(run.stderr, /the tracker's history would not: it holds no move into on_hold/u, run.stderr);
    assert.match(run.stderr, /forge advance ISS-83 --set <status> --why/u, "the set that clears it is named");
  }
});

test("the advance at a side status no park record is paired with names the record that finishes it", async () => {
  const run = await forge("advance", "ISS-84");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /Where a park moved it and its record is what did not go up, write that record/u, run.stderr);
  assert.match(run.stderr, /forge record park ISS-84 --kind <[a-z|-]*blocked[a-z|-]*> --why/u, run.stderr);
  assert.match(run.stderr, /Where nothing parked it, whoever knows where it belongs sets it/u, run.stderr);
});

test("a claim of an issue whose park record did not go up names the record that finishes it", async () => {
  const run = await forge("claim", "ISS-84", "--unheld");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /forge record park ISS-84 --kind <[a-z|-]*crashed[a-z|-]*> --why/u, run.stdout);
  assert.deepEqual(postedTo(MET.documentId), [], "and the claim itself writes no record");
});
