/* What `--fields` may be asked for. The set is the answer's own keys, in the words the verb prints
   them under, so the two halves judged here are: the tracker projects what it declares, and this CLI
   projects the rest off the same answer without holding a list of names (ISS-151). */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync } from "../../fixtures.mjs";
import { rowLine } from "../../../src/tracker/issues.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;

/* `unheardOfKey` is named in no source file: it stands for the field the tracker grows next. */
const ISSUE = {
  documentId: "u-1",
  issueId: "ISS-1",
  title: "one",
  status: "open",
  priority: "medium",
  category: "bug",
  complexity: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  plan: "the plan as it stands",
  sessionContext: { lease: { holder: "s-1" } },
  unheardOfKey: "a name this repository holds nowhere",
  /* On a route of its own, so a name that reaches it buys a request and every other name does not. */
  relations: { blocks: [{ edgeId: "e-1", kind: "blocks", fromIssueId: "u-1", toIssueId: "u-2",
    otherDisplayId: "ISS-2", otherStatus: "open", otherMergedAt: null }], blockedBy: [] },
};

/* The tracker's own `get`: it projects the names it declared and always carries both identifiers. */
const projects = (args) => {
  if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
  if (args.action !== "get") return {};
  if (!args.fields) return ISSUE;
  return {
    documentId: ISSUE.documentId,
    issueId: ISSUE.issueId,
    ...Object.fromEntries(args.fields.map((one) => [one, ISSUE[one] ?? null])),
  };
};

const state = { issues: [ISSUE], comments: {}, calls: [], answer: { forge_issues: projects } };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const asked = async (...argv) => {
  const { exit = 0 } = typeof argv[0] === "object" ? argv.shift() : {};
  state.calls.length = 0;
  const run = await ranAsync(FORGE, ["issue", "ISS-1", ...argv], tracker.env, ROOT, null);
  assert.equal(run.status, exit, run.stderr);
  return { ...run, body: exit === 0 ? JSON.parse(run.stdout) : null };
};

/* Sorted, because the parts of one read are asked for together and arrive in no fixed order. */
const paths = () => state.calls
  .filter((one) => one.method === "GET" && one.path?.startsWith("/api/issues/"))
  .map((one) => one.path)
  .sort();

test("a name only the body carries answers where it used to be refused", async () => {
  const run = await asked("--fields", "status");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.body.status, "open");
});

test("an issue's uuid is reachable from its key by naming a field", async () => {
  const run = await asked("--fields", "documentId");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.body.documentId, "u-1");
});

test("a projection prints nothing the ask did not name", async () => {
  const run = await asked("--fields", "status");
  assert.deepEqual(Object.keys(run.body), ["documentId", "issueId", "status"]);
});

test("one ask naming two fields answers both", async () => {
  const run = await asked("--fields", "plan,status");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.body.plan, ISSUE.plan);
  assert.equal(run.body.status, "open");
});

/* The issue's body is one route and its edges and attachments are two more, so a read that named
   neither pays for neither: the lease alone reads a field four times a command. */
test("a read naming fields skips the routes those fields are not on", async () => {
  await asked("--fields", "plan,status");
  assert.deepEqual(paths(), [`/api/issues/${ISSUE.documentId}`]);
});

/* The two halves of one ask: the names the route can choose a request by go to it, the rest are the
   projection's alone. A caller that sent them whole asked the route to narrow where it cannot, and
   before ISS-588 the route answered whole and the ask read as though it had been honoured. */
test("a read naming a part and a column pays for that part's route and prints both", async () => {
  const run = await asked("--fields", "plan,relations");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.body.plan, ISSUE.plan);
  assert.deepEqual(run.body.relations.blocks.map((one) => one.otherDisplayId), ["ISS-2"]);
  assert.deepEqual(paths(), [`/api/issues/${ISSUE.documentId}`, `/api/issues/${ISSUE.documentId}/dependencies`].sort());
});

test("a read naming no field at all reads the whole issue, edges and attachments included", async () => {
  await asked("--full");
  assert.deepEqual(paths(), [
    `/api/issues/${ISSUE.documentId}`,
    `/api/issues/${ISSUE.documentId}/dependencies`,
    `/api/issues/${ISSUE.documentId}/attachments`,
  ].sort());
});

test("a field comes back under the tracker's own name for it", async () => {
  const run = await asked("--fields", "category");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.body.category, "bug");
});

test("a word of this CLI's own for that field is refused, there being one name for it now", async () => {
  const run = await asked({ exit: 1 }, "--fields", "kind");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No field named kind\./u);
});

test("a name nothing carries is refused with the command that prints the names", async () => {
  const run = await asked({ exit: 1 }, "--fields", "nosuchfield");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /forge issue ISS-1 --full/u);
});

test("a typo is answered by the nearest name the body carries", async () => {
  const run = await asked({ exit: 1 }, "--fields", "staus");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Did you mean: status\?/u);
});

test("the lease comes back as the stop gate reads it", async () => {
  const run = await asked("--fields", "sessionContext");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.body.sessionContext.lease.holder, "s-1");
});

test("a key only the answer carries is selectable, with no name kept here", async () => {
  const run = await asked("--fields", "unheardOfKey");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.body.unheardOfKey, ISSUE.unheardOfKey);
});

/* The route answers with every column of the issue, so the askable set is the answer's own keys: a
   name it does not carry is a typo and nothing else, and the column the tracker grows next is
   selectable the day it appears without a list here learning about it. */
test("a name the answer does not carry is a typo, and no declaration excuses it", async () => {
  const run = await asked({ exit: 1 }, "--fields", "fixture-only");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No field named fixture-only\./u);
});

/* The other call of this verb, which took no --fields at all until ISS-1526: a caller listing issues
   owed one further call per row for the uuid a link is built from, and a model with one repair turn
   had none to spend. The rows are already in hand, so the projection is over what the walk holds. */
const listed = async (...argv) => {
  state.calls.length = 0;
  return ranAsync(FORGE, ["issue", ...argv], tracker.env, ROOT, null);
};

const sent = () => state.calls.map((one) => `${one.method} ${one.path}`);

test("the list call takes --fields, and the uuid a link is built from is one of them", async () => {
  const run = await listed("--fields", "documentId,issueId");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.stdout.trim().split("\n"), [`${ISSUE.documentId}\t${ISSUE.issueId}`]);
});

test("a listed row is the names asked for, in the order asked", async () => {
  const run = await listed("--fields", "title,status");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), `${ISSUE.title}\t${ISSUE.status}`);
});

test("stdout holds the rows alone, the reading's own count going to stderr", async () => {
  const run = await listed("--fields", "issueId");
  assert.equal(run.stdout.trim(), ISSUE.issueId);
  assert.match(run.stderr, /1 issue\(s\) over \d+ page\(s\)/u);
});

test("a list call naming no fields prints the four columns it always printed", async () => {
  const run = await listed();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ISS-1\s+medium\s+open\s+one$/mu);
});

/* A listed row is the browse projection, so sending this caller to `--full` would name keys the row
   never carried and refuse them again; the names it does carry are what the refusal prints. */
test("a name the listed row does not carry is refused, naming the ones it does", async () => {
  const run = await listed("--fields", "plan");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No field named plan\./u);
  assert.match(run.stderr, /A listed row carries documentId, issueId, title/u);
});

/* The page this call prints is a slice of what the walk holds, so a typo judged only against a
   printed row is not judged at all where the offset lands past the last one. */
test("a name nothing carries is refused at an offset that prints no row", async () => {
  const run = await listed("--offset", "9", "--fields", "plan");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No field named plan\./u);
});

test("a list read naming fields sends no request the same read without them sends", async () => {
  await listed();
  const bare = sent();
  await listed("--fields", "documentId,title");
  assert.deepEqual(sent(), bare);
});

/* A tab inside a value would put a column where none was asked for, which is the parse this surface
   exists to make safe. */
test("a value carrying a tab or a newline travels as one line and one column", () => {
  assert.equal(rowLine({ issueId: "ISS-9", title: "one\ttwo\nthree" }, ["issueId", "title"]),
    "ISS-9\tone two three");
});
