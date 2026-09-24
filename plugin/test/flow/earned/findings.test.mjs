/* A filing the fold landed on an issue is a finding that issue owes an answer: a criterion naming
   its handle, or a record declining it, at the rung the criteria are written and at every rung from
   the judging to the close (ISS-167). The rule is the contract's `testing` part. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("findings").path;
const { CHECKS, viewFrom } = await import("../../../src/flow/earned.mjs");
const { render, parseAll } = await import("../../../src/flow/record/page.mjs");
const { foldedBody, foldedIn } = await import("../../../src/flow/earned/findings.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const HANDLE = "6bd04311";
const TITLE = "the attach verb refuses a name already on the issue";
const FILING = "## What happened\n\nthe attach verb refuses a name it should take\n\n## Outcome\n\nit takes it\n";

const at = (minute) => `2026-09-24T01:${String(minute).padStart(2, "0")}:00.000Z`;
const folded = (minute = 1, id = `${HANDLE}-be5c-4f45-81fb-32e3c05c1886`) =>
  ({ documentId: id, createdAt: at(minute), authorId: "agent", body: foldedBody(TITLE, FILING) });
const declined = (finding = HANDLE, minute = 2) => ({ documentId: `d-${minute}`, createdAt: at(minute), authorId: "agent",
  body: render("declined", { finding, why: "the cache owns this defect, and ISS-80 carries it" }) });
const verdict = (criterion, value, minute = 3) => ({ documentId: `v-${minute}`, createdAt: at(minute), authorId: "agent",
  body: render("verdict", { criterion, verdict: value, commit: "43b811e", evidence: ["43b811e"], why: "read" }) });

const ISSUE = {
  status: "developed",
  plan: "Screen change: no\nSchema coupling: no",
  acceptanceCriteria: "1. The first outcome.",
};
const owedAt = (status, comments, issue = {}) =>
  CHECKS[status](viewFrom("the-uuid", { ...ISSUE, ...issue }, comments), "ISS-7").map((one) => one.what);
const findingItems = (items) => items.filter((one) => one.includes(`finding ${HANDLE}`));

test("the fold's comment is the filing, then a folded record carrying its title", () => {
  const body = foldedBody(TITLE, FILING);
  assert.match(body, new RegExp(`^## ${TITLE}\\n\\n## What happened`, "u"), "the filer's own words come first");
  const [record] = parseAll(body);
  assert.equal(record.kind, "folded");
  assert.equal(record.fields.title, TITLE);
  assert.deepEqual(foldedIn([folded()]), [{ handle: HANDLE, title: TITLE }], "and it is named by the head of its id");
  /* A filing that quotes a record keeps the tag it ends on, so it is still a finding, titled off its heading. */
  const quoting = { ...folded(), body: foldedBody(TITLE, "```forge-record\nmoved: x\n```\n\n## Outcome\n\nit takes it") };
  assert.deepEqual(foldedIn([quoting]), [{ handle: HANDLE, title: TITLE }]);
  assert.deepEqual(foldedIn([{ ...folded(), documentId: undefined }]), [], "a row with no id is one nobody can name");
  assert.deepEqual(foldedIn([folded(1, "comment-uuid"), folded(1, "abc")]), [],
    "nor is one whose id heads no handle, since no declining could name it");
});

test("an unanswered finding is owed at testing and at approved, by handle and title", () => {
  const [item] = findingItems(owedAt("testing", [folded()]));
  assert.ok(item, "testing lists it");
  assert.match(item, new RegExp(`^finding ${HANDLE} \\("${TITLE}"\\) is carried by no criterion and declined by no record`, "u"));
  assert.equal(findingItems(owedAt("approved", [folded()], { status: "confirmed" })).length, 1, "approved lists it too");
  const view = viewFrom("the-uuid", ISSUE, [folded()]);
  const [need] = CHECKS.testing(view, "ISS-7").filter((one) => one.what.includes(HANDLE));
  assert.match(need.command, new RegExp(`forge record criteria ISS-7 <criteria.md>, with a line naming \`finding ${HANDLE}\``, "u"));
  assert.match(need.command, new RegExp(`forge record declined ISS-7 --finding ${HANDLE} --why`, "u"),
    "and the refusal carries both writes that answer it");
});

test("a criterion naming the handle carries the finding, and a declined record answers it", () => {
  const carried = { acceptanceCriteria: `1. The first outcome.\n2. The attach verb takes a name already on the issue (finding \`${HANDLE}\`).` };
  assert.deepEqual(findingItems(owedAt("testing", [folded()], carried)), []);
  assert.deepEqual(findingItems(owedAt("approved", [folded()], { ...carried, status: "confirmed" })), []);
  assert.deepEqual(findingItems(owedAt("testing", [folded(), declined()])), []);
  assert.deepEqual(findingItems(owedAt("testing", [folded(), declined(`${HANDLE}-be5c-4f45-81fb-32e3c05c1886`)])), [],
    "a whole comment id declines the finding it heads");
  const halfDeclined = { ...declined(), body: render("declined", { finding: HANDLE }) };
  assert.equal(findingItems(owedAt("testing", [folded(), halfDeclined])).length, 1, "a record with no reason answers nothing");
  const sibling = { acceptanceCriteria: `1. The first outcome.\n2. Names ${HANDLE}9 and no finding.` };
  assert.equal(findingItems(owedAt("testing", [folded()], sibling)).length, 1, "a longer hex run is not the handle");
});

test("past the judging, a carrying criterion owes a verdict that did not fail", () => {
  const carried = { status: "testing", acceptanceCriteria: `1. The first outcome.\n2. Takes the name — finding ${HANDLE}.` };
  for (const status of ["awaiting_release", "closed"]) {
    const owed = findingItems(owedAt(status, [folded(), verdict(1, "pass")], carried));
    assert.deepEqual(owed, [`criterion 2 carries finding ${HANDLE} and has no verdict, so the finding it carries stands unjudged`], status);
    assert.match(findingItems(owedAt(status, [folded(), verdict(2, "fail")], carried))[0] ?? "", /criterion 2 carries finding 6bd04311 and failed its verdict/u);
    assert.deepEqual(findingItems(owedAt(status, [folded(), verdict(2, "pass")], carried)), [], `${status}: a pass answers it`);
    assert.equal(findingItems(owedAt(status, [folded()], { status: "testing" })).length, 1, `${status}: and one never answered is still listed`);
  }
  assert.deepEqual(findingItems(owedAt("testing", [folded()], carried)), [],
    "at testing the verdicts check already owes the carrier its verdict, so the finding is not listed twice");
});

const OPEN = {
  documentId: "the-uuid", issueId: "ISS-7", status: "developed", title: "the attach verb",
  description: "no mark here", ...ISSUE,
};
const state = {
  calls: [],
  issues: [OPEN],
  comments: { "the-uuid": [folded()] },
  answer: {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update") return Object.assign(OPEN, args.data);
      return OPEN;
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
/* Twice, as the lease's own cases take it: the first read delivers the thread and the second claims. */
for (const again of [1, 2]) assert.ok(again && await ranAsync(FORGE, ["claim", "ISS-7", "--unheld"], ENV));
const posted = () => state.calls.filter((one) => one.name === "forge_comments" && one.args.action === "create");

test("--owed names the finding a run has to answer", async () => {
  const run = await ranAsync(FORGE, ["advance", "ISS-7", "--owed"], ENV);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, new RegExp(`finding ${HANDLE} \\("${TITLE}"\\) is carried by no criterion`, "u"));
});

test("a declined write naming no finding on the issue is refused before anything is posted", async () => {
  const before = posted().length;
  const run = await ranAsync(FORGE, ["record", "declined", "ISS-7", "--finding", "abcdef12", "--why", "not this one"], ENV);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout + run.stderr, new RegExp(`carries no folded finding with the handle \`abcdef12\`, and the finding\\(s\\) it carries: ${HANDLE}`, "u"));
  assert.equal(posted().length, before, "nothing was sent");
  const malformed = await ranAsync(FORGE, ["record", "declined", "ISS-7", "--finding", "finding 2", "--why", "not this one"], ENV);
  assert.equal(malformed.status, 1, malformed.stdout);
  assert.match(malformed.stdout + malformed.stderr, /--finding as the finding's handle/u);
  assert.equal(posted().length, before);
  const named = await ranAsync(FORGE, ["record", "declined", "ISS-7", "--finding", `${HANDLE}-be5c-4f45-81fb-32e3c05c1886`,
    "--why", "the cache owns this defect"], ENV);
  assert.equal(named.status, 0, `${named.stdout}${named.stderr}`);
  const [record] = parseAll(posted().at(-1).args.data.body);
  assert.deepEqual(record.fields, { finding: HANDLE, why: "the cache owns this defect" }, "a whole id is stored as the handle");
});

test("the verb takes declined and no folded, and the contract's testing part states the rule", async () => {
  const help = await ranAsync(FORGE, ["record", "-h"], ENV);
  assert.match(help.stdout, /^ {2}declined {5}/mu);
  assert.doesNotMatch(help.stdout, /^ {2}folded\b/mu, "a kind no verb writes is not offered to one");
  const refused = await ranAsync(FORGE, ["record", "folded", "ISS-7", "--title", "t"], ENV);
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stdout + refused.stderr, /record knows no kind `folded`/u);
  const part = await ranAsync(FORGE, ["guide", "contract", "testing"], ENV);
  assert.equal(part.status, 0, `${part.stdout}${part.stderr}`);
  assert.match(part.stdout.replace(/\s+/gu, " "), /Every finding the fold landed on the issue is answered before this rung/u);
  assert.match(part.stdout.replace(/\s+/gu, " "), /A criterion naming that handle carries it/u);
  assert.match(part.stdout.replace(/\s+/gu, " "), /`forge record declined` says why it is not fixed here/u);
});
