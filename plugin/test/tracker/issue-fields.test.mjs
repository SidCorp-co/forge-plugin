/* What `--fields` may be asked for. The set is the answer's own keys, in the words the verb prints
   them under, so the two halves judged here are: the tracker projects what it declares, and this CLI
   projects the rest off the same answer without holding a list of names (ISS-151). */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;

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
};

/* The tracker's own `get`: it projects the names it declared and always carries both identifiers. */
const answered = (args) => {
  if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
  if (args.action !== "get") return {};
  if (!args.fields) return ISSUE;
  return {
    documentId: ISSUE.documentId,
    issueId: ISSUE.issueId,
    ...Object.fromEntries(args.fields.map((one) => [one, ISSUE[one] ?? null])),
  };
};

const state = { issues: [ISSUE], comments: {}, calls: [], answer: { forge_issues: answered } };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const asked = async (...argv) => {
  state.calls.length = 0;
  const run = await ranAsync(FORGE, ["issue", "ISS-1", ...argv], tracker.env, ROOT, null);
  return { ...run, body: run.status === 0 ? JSON.parse(run.stdout) : null };
};

const gets = () => state.calls.filter((one) => one.args?.action === "get");

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

test("a name the tracker declares is still projected on the wire", async () => {
  const run = await asked("--fields", "plan");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(gets().map((one) => one.args.fields), [["plan"]]);
  assert.equal(run.body.plan, ISSUE.plan);
});

test("one ask mixing a declared name with a body-only one answers both", async () => {
  const run = await asked("--fields", "plan,status");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.body.plan, ISSUE.plan);
  assert.equal(run.body.status, "open");
});

test("the mixed ask costs one get, and asks it for the whole body", async () => {
  await asked("--fields", "plan,status");
  assert.equal(gets().length, 1);
  assert.equal(gets()[0].args.fields, undefined);
});

test("a field comes back under the word this verb prints it under", async () => {
  const run = await asked("--fields", "kind");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.body.kind, "bug");
});

test("the tracker's own name for that field is refused", async () => {
  const run = await asked("--fields", "category");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No field named category\./u);
});

test("a name nothing carries is refused with the command that prints the names", async () => {
  const run = await asked("--fields", "nosuchfield");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /forge issue ISS-1 --full/u);
});

test("a typo is answered by the nearest name the body carries", async () => {
  const run = await asked("--fields", "staus");
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

test("a declared name the answer left out is empty rather than a typo", async () => {
  const run = await asked("--fields", "fixture-only,status");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.body.status, "open");
  assert.equal(Object.hasOwn(run.body, "fixture-only"), false);
});

test("a name only the tracker's enum declares goes to the wire rather than back as a typo", async () => {
  const run = await asked("--fields", "fixture-only");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(gets().map((one) => one.args.fields), [["fixture-only"]]);
});
