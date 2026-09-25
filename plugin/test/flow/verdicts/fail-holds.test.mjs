/* A failed verdict holds every rung from the judging one to the close. The builder's records turn
   writes its verdicts after the landing has already entered `testing`, and a fail read by that rung
   alone was judged by nothing once the issue had passed it: ISS-2507 went on to `awaiting_release`
   with a failed criterion on its page (ISS-2511). */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("fail-holds").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { CHECKS, viewFrom } = await import("../../../src/flow/earned.mjs");
const { foldedBody } = await import("../../../src/flow/earned/findings.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const COMMIT = "43b811e";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const HANDLE = "6bd04311";

let clock = 0;
const at = () => `2026-09-25T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body, extra = {}) => ({ documentId: `c-${clock + 1}`, createdAt: at(), authorId: "agent", body, ...extra });
const mark = () => comment(`mark_merged target=base — merged to master at ${COMMIT}`);
const entered = (status, from) => comment(`**Moved to ${status}** — moved from \`${from}\``);
const verdict = (number, value, extra = {}) => comment(render("verdict", {
  criterion: `${number} — text`, verdict: value, commit: COMMIT, evidence: [COMMIT], ...extra,
}));
const pass = (number) => verdict(number, "pass");
const fail = (number) => verdict(number, "fail", { why: "35 test files against a ceiling of 30" });
const short = (number) => verdict(number, "short", { why: "one column rounds", filed: "ISS-9" });

const ISSUE = { acceptanceCriteria: CRITERIA, mergedAt: "2026-09-25T09:00:00.000Z", attachments: [] };
const owed = (status, comments, issue = {}) =>
  CHECKS[status](viewFrom("the-uuid", { ...ISSUE, ...issue }, comments), "ISS-7");
const naming = (status, comments, number, issue) =>
  owed(status, comments, issue).filter((one) => one.what.includes(`criterion ${number}`));

test("a whole fail standing on a criterion refuses awaiting_release and closed, naming the criterion", () => {
  const page = [mark(), pass(1), fail(2)];
  for (const status of ["awaiting_release", "closed"]) {
    assert.deepEqual(naming(status, page, 2).map((one) => one.what), ["criterion 2 failed its verdict"],
      `${status} is refused on the failed criterion, by name`);
    assert.deepEqual(naming(status, page, 1), [], `${status}: and the passing criterion beside it is not named`);
  }
});

test("the item a failed verdict raises past the judging carries the verdict write for that criterion", () => {
  const page = [mark(), pass(1), fail(2)];
  for (const status of ["awaiting_release", "closed"]) {
    const [item] = naming(status, page, 2);
    assert.match(item?.command ?? "", /^forge record verdict ISS-7 --criterion 2 --verdict <pass\|fail\|skipped\|short> --commit 43b811e /u,
      `${status}: the one write that answers it, at the commit the mark names`);
  }
});

test("a fail written after the issue entered testing refuses awaiting_release as one written before it", () => {
  const earlier = [mark(), pass(1), fail(2), entered("testing", "developed")];
  const later = [mark(), pass(1), entered("testing", "developed"), fail(2)];
  const said = (page) => naming("awaiting_release", page, 2).map((one) => one.what);
  assert.deepEqual(said(later), ["criterion 2 failed its verdict"], "the records turn's own fail holds the rung");
  assert.deepEqual(said(later), said(earlier), "exactly as a fail the judging rung read");
});

test("a whole short verdict carrying its row holds neither awaiting_release nor closed", () => {
  const page = [mark(), pass(1), short(2)];
  assert.deepEqual(naming("awaiting_release", page, 2), [], "awaiting_release: the shortfall released the change");
  assert.deepEqual(naming("closed", page, 2), [], "closed: and it went to the row it names, not onto this rung");
});

test("a fail superseded by a later pass on the same criterion holds nothing past the judging", () => {
  assert.deepEqual(naming("awaiting_release", [mark(), pass(1), fail(2), pass(2)], 2), [],
    "the latest verdict is the one standing");
});

test("a failed carrier of a folded finding is named by exactly one item past the judging", () => {
  const carried = { acceptanceCriteria: `1. The first outcome.\n2. Takes the name — finding ${HANDLE}.` };
  const folded = comment(foldedBody("the attach verb refuses a name", "## Outcome\n\nit takes it\n"),
    { documentId: `${HANDLE}-be5c-4f45-81fb-32e3c05c1886` });
  const page = [folded, mark(), pass(1), fail(2)];
  assert.deepEqual(naming("awaiting_release", page, 2, carried).map((one) => one.what), ["criterion 2 failed its verdict"],
    "one reading of the failed verdict, not a second for the finding it carries");
});

test("at testing a failed verdict raises the one item it always raised", () => {
  const items = owed("testing", [mark(), pass(1), fail(2)]).map((one) => one.what);
  assert.deepEqual(items, ["criterion 2 failed its verdict"], "the judging rung's refusal did not double");
});

/* Spawned from here down: whether a write moves the status is the tracker's to count. */
const held = {
  documentId: "held-uuid",
  issueId: "ISS-7",
  status: "awaiting_release",
  title: "the change past its judging",
  description: "no mark here",
  acceptanceCriteria: CRITERIA,
  mergedAt: "2026-09-25T09:00:00.000Z",
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
const env = { ...ENV, FORGE_SESSION_ID: "fail-holds-session" };
const ask = (...argv) => ranAsync(FORGE, argv, env);

/* The page carries comments this session has not been shown, so the first claim is held and the
   second takes the lease; that the hold fires is not this file's to test. */
before(async () => {
  await ask("claim", "ISS-7", "--unheld");
  const claimed = await ask("claim", "ISS-7", "--unheld");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
});

test("an issue at awaiting_release keeps that status when a fail is written, and closed is refused", async () => {
  const run = await ask("record", "verdict", "ISS-7", "--commit", COMMIT, "--evidence", COMMIT,
    "--criterion", "2", "--verdict", "fail", "--why", "35 test files against a ceiling of 30");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(held.status, "awaiting_release", "the write moved the issue nowhere, down included");
  const moves = state.calls.filter((one) => one.name === "forge_issues" && one.args?.data?.status);
  assert.deepEqual(moves.map((one) => one.args.data.status), [], "and no status was sent at all");
  const next = await ask("advance", "ISS-7", "--owed");
  assert.match(next.stdout, /closed is next and the record does not earn it/u, next.stdout);
  assert.match(next.stdout, /criterion 2 failed its verdict/u, "the fail is what holds it");
});
