/* A skipped verdict holds every rung from the judging one to the close, the same shape a fail
   already holds (ISS-2511), and so does a verdict a reopen's triage already moved past
   (`judgedSince`). ISS-1192 reached `testing` with criterion 18 skipped, and the issue would have
   closed over a criterion nobody ever exercised (ISS-2430); core's own release sweep already refuses
   a skip and a stale verdict the same way it refuses a fail. A never-judged criterion is left alone:
   `the-rung.test.mjs` (ISS-1065) holds the judging half and the deploying half apart on that one, and
   a skip or a stale verdict crosses that boundary only because each is a verdict already on the page. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("skipped-holds").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { CHECKS, judgedOwed, viewFrom } = await import("../../../src/flow/earned.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const COMMIT = "43b811e";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";

let clock = 0;
const at = () => `2026-09-29T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body, extra = {}) => ({ documentId: `c-${clock + 1}`, createdAt: at(), authorId: "agent", body, ...extra });
const mark = () => comment(`mark_merged target=base — merged to master at ${COMMIT}`);
const verdict = (number, value, extra = {}) => comment(render("verdict", {
  criterion: `${number} — text`, verdict: value, commit: COMMIT, evidence: [COMMIT], ...extra,
}));
const pass = (number) => verdict(number, "pass");
const skip = (number, why = "no route in the fixture suite reaches this criterion") => verdict(number, "skipped", { why });
const ruling = (outcome) => comment(render("triage", { outcome, "would-have-caught": "a criterion naming the order" }, "0"));

const ISSUE = { acceptanceCriteria: CRITERIA, mergedAt: "2026-09-29T09:00:00.000Z", attachments: [] };
const owed = (status, comments, issue = {}) =>
  CHECKS[status](viewFrom("the-uuid", { ...ISSUE, ...issue }, comments), "ISS-7");
const naming = (status, comments, number, issue) =>
  owed(status, comments, issue).filter((one) => one.what.includes(`criterion ${number}`));

test("a whole skip standing on a criterion refuses awaiting_release and closed, naming the criterion and the why", () => {
  const page = [mark(), pass(1), skip(2, "no route in the fixture suite reaches this criterion")];
  for (const status of ["awaiting_release", "closed"]) {
    assert.deepEqual(naming(status, page, 2).map((one) => one.what), [
      "criterion 2 was skipped (\"no route in the fixture suite reaches this criterion\"), and "
        + "nothing on the record says it has been judged since",
    ], `${status} is refused on the skipped criterion, by name and by why`);
    assert.deepEqual(naming(status, page, 1), [], `${status}: the passing criterion beside it is not named`);
  }
});

test("the item a skipped verdict raises past the judging carries the verdict write for that criterion", () => {
  const page = [mark(), pass(1), skip(2)];
  for (const status of ["awaiting_release", "closed"]) {
    const [item] = naming(status, page, 2);
    assert.match(item?.command ?? "", /^forge record verdict ISS-7 --criterion 2 --verdict <pass\|fail\|skipped\|short> --commit 43b811e /u,
      `${status}: the one write that answers it, at the commit the mark names`);
  }
});

test("testing itself asks nothing past the skip's own --why: out of scope is left alone", () => {
  const page = [mark(), pass(1), skip(2)];
  const view = viewFrom("the-uuid", ISSUE, page);
  assert.deepEqual(judgedOwed(view, "ISS-7"), [], "a skip earns the judging rung it was written at");
});

test("a skip superseded by a later verdict on the same criterion holds nothing past the judging", () => {
  assert.deepEqual(naming("awaiting_release", [mark(), pass(1), skip(2), pass(2)], 2), [],
    "the latest verdict is the one standing");
  assert.deepEqual(naming("closed", [mark(), pass(1), skip(2), pass(2)], 2), [],
    "and closed reads the same page the same way");
});

test("each rung is entered on its own half still: a criterion with no verdict at all holds neither by this change", () => {
  const bare = { acceptanceCriteria: "1. The one outcome." };
  assert.deepEqual(naming("awaiting_release", [], 1, bare), [], "awaiting_release names no skip where none was written");
  assert.deepEqual(naming("closed", [], 1, bare), [], "closed reads the same empty page the same way");
});

test("a verdict a reopen's triage already moved past holds awaiting_release and closed too", () => {
  const marked = mark();
  const early2 = pass(2);
  const wrong = ruling("wrong-test");
  const late1 = pass(1);
  const page = [marked, early2, wrong, late1];
  for (const status of ["awaiting_release", "closed"]) {
    assert.deepEqual(naming(status, page, 2).map((one) => one.what), [
      "the verdict on criterion 2 was written before this reopen's triage, and a reopen judges again",
    ], `${status}: a verdict the reopen already moved past still holds it, exactly as testing reads it`);
    assert.deepEqual(naming(status, page, 1), [], `${status}: the verdict written since the triage is not named`);
  }
  const rejudged = [...page, pass(2)];
  for (const status of ["awaiting_release", "closed"]) {
    assert.deepEqual(naming(status, rejudged, 2), [], `${status}: a verdict written since the triage earns it again`);
  }
});

/* Spawned from here down: whether a write moves the status is the tracker's to count. */
const held = {
  documentId: "held-uuid",
  issueId: "ISS-7",
  status: "awaiting_release",
  title: "the change past its judging",
  description: "no mark here",
  acceptanceCriteria: CRITERIA,
  mergedAt: "2026-09-29T09:00:00.000Z",
  attachments: [],
};
const state = { calls: [], issues: [held], comments: { "held-uuid": [mark(), pass(1), pass(2)] }, answer: {} };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "get") return held;
  if (args.action === "update") return Object.assign(held, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
state.answer.forge_comments = (args) => {
  if (args.action === "list") {
    const page = state.comments[args.filters?.issue] ?? [];
    return { comments: page, returned: page.length, hasMore: false };
  }
  const page = (state.comments[args.data?.issue] ??= []);
  const id = `comment-${page.length}`;
  page.push({ documentId: id, createdAt: at(), body: args.data?.body });
  return { documentId: id };
};
const { tracker, env: ENV } = await trackerFor(state);
after(() => tracker.close());
const env = { ...ENV, FORGE_SESSION_ID: "skipped-holds-session" };
const ask = (...argv) => ranAsync(FORGE, argv, env);

/* The page carries comments this session has not been shown, so the first claim is held and the
   second takes the lease; that the hold fires is not this file's to test. */
before(async () => {
  await ask("claim", "ISS-7", "--unheld");
  const claimed = await ask("claim", "ISS-7", "--unheld");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
});

test("an issue at awaiting_release keeps that status when a skip is written, and closed is refused", async () => {
  const run = await ask("record", "verdict", "ISS-7", "--commit", COMMIT, "--evidence", COMMIT,
    "--criterion", "2", "--verdict", "skipped", "--why", "no route in the fixture suite reaches this criterion");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(held.status, "awaiting_release", "the write moved the issue nowhere, down included");
  const moves = state.calls.filter((one) => one.name === "forge_issues" && one.args?.data?.status);
  assert.deepEqual(moves.map((one) => one.args.data.status), [], "and no status was sent at all");
  const next = await ask("advance", "ISS-7", "--owed");
  assert.match(next.stdout, /closed is next and the record does not earn it/u, next.stdout);
  assert.match(next.stdout, /criterion 2 was skipped/u, "the skip is what holds it");
});
