/* An independent judge writes its failing verdict first, and the reopen and the not-met triage are
   written after it by whoever read it. Measured from the triage, that verdict was always too early,
   and the builder was sent to write a copy it may not write (ISS-2952). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("route-judge-first").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { viewFrom } = await import("../../../src/flow/earned.mjs");
const { targetOf } = await import("../../../src/flow/route.mjs");
const { releaseFrom } = await import("../../../src/tracker/project-config.mjs");

const released = (qa) => releaseFrom({
  baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false, qa },
});
const JUDGED_APART = released("independent");
const BUILDER_JUDGES = released("builder");

const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const PLAN = "Screen change: no. Schema coupling: no.\n\nThe plan itself.";
const MARKED = "2026-09-02T16:00:00.000Z";
const SHA = "c8c35500000000000000000000000000000000ab";

const minute = (n) => `2026-09-03T11:${String(n).padStart(2, "0")}:00.000Z`;
const stamped = (kind, fields, when, status = "0") => ({ createdAt: when, authorId: "agent", body: render(kind, fields, status) });
const verdict = (verdictSaid, when) => stamped("verdict", {
  criterion: "1 — The first outcome.", verdict: verdictSaid, commit: "43b811e", evidence: ["run.txt"],
  ...(verdictSaid === "fail" ? { why: "the column came back in the order it was filed" } : {}),
}, when, null);
const FOUND = {
  expected: "the list sorted by name", seen: "sorted by id", evidence: ["run.txt"], criterion: "1 — The first outcome.",
};
const NOT_MET = { outcome: "not-met", "would-have-caught": "a verdict taken against the running deployment" };
/* The pair the reopen is made of, written after whatever the judge wrote. */
const ruled = (from) => [stamped("finding", FOUND, minute(from)), stamped("triage", NOT_MET, minute(from + 1))];
const byTime = (one, two) => one.createdAt.localeCompare(two.createdAt);
const mark = (when) => ({ createdAt: when, authorId: "agent", body: `mark_merged target=base — merged to master at ${SHA}` });

const routed = (comments, { release = null, issue = {} } = {}) => targetOf(viewFrom("the-uuid", {
  status: "reopen", mergedAt: MARKED, plan: PLAN, acceptanceCriteria: CRITERIA, attachments: [{ name: "run.txt" }], ...issue,
}, comments, null, release), "ISS-3");

test("a failing verdict the judge wrote before the triage answers a not-met reopen", () => {
  for (const release of [JUDGED_APART, BUILDER_JUDGES, null]) {
    const first = routed([verdict("fail", minute(1)), ...ruled(2)], { release });
    assert.deepEqual(first.missing, [], "the judge's fail came first, as an independent judgement always writes it");
    assert.equal(first.next, "in_progress");
  }
  /* A fail from a round before this landing answers nothing: it judged code this landing replaced. */
  const stale = routed([verdict("fail", "2026-09-02T15:00:00.000Z"), ...ruled(2)]);
  assert.equal(stale.missing.length, 1, "a fail older than the landing is no answer");
  assert.match(stale.missing[0].what, /no failing verdict since the landing it reopens, at 2026-09-02T16:00, on criterion 1/u,
    stale.missing[0].what);
  /* The tracker keeps a row's first stamp, so after a second landing it is the mark on the page that
     says when the change being judged landed. */
  const relanded = (when) => routed([verdict("fail", when), mark(minute(5)), ...ruled(10)].sort(byTime));
  assert.equal(relanded(minute(4)).missing.length, 1, "a fail before the second landing judged the first");
  assert.deepEqual(relanded(minute(6)).missing, [], "and one after it, still before the triage, answers it");
  /* The page keeps the latest verdict on a criterion, so a pass written after the fail is what stands. */
  const passed = routed([verdict("fail", minute(1)), verdict("pass", minute(2)), ...ruled(3)]);
  assert.equal(passed.missing.length, 1, "a fail a later pass superseded answers nothing");
});

/* A reopened drop landed nothing, so no landing says when a verdict could start answering, and the
   ruling stays the line it always was. */
test("a reopened drop still measures the failing verdict from its triage", () => {
  const dropped = stamped("park", { kind: "dropped", why: "the premise was false", evidence: [] }, minute(0), "approved");
  const drop = (comments) => routed([dropped, ...comments], { issue: { mergedAt: null } });
  const before = drop([verdict("fail", minute(1)), ...ruled(2)]);
  assert.equal(before.missing.length, 1, "a fail before the triage of a drop answers nothing");
  assert.match(before.missing[0].what, /no failing verdict since it on criterion 1/u, before.missing[0].what);
  assert.deepEqual(drop([...ruled(2), verdict("fail", minute(4))]).missing, [], "and one after it does");
});

test("under an independent judgement a not-met reopen asks the builder for no verdict", () => {
  const apart = routed(ruled(2), { release: JUDGED_APART });
  assert.equal(apart.missing.length, 1);
  assert.match(apart.missing[0].what, /judgement is another run's, so the failing verdict is the judge's to write/u);
  assert.doesNotMatch(apart.missing[0].command, /forge record verdict/u, apart.missing[0].command);
  assert.match(apart.missing[0].command,
    /^forge claim ISS-3 --give-back --next "the judge's failing verdict on criterion 1, which the not-met triage waits on"$/u,
    "the hand-back, which leaves the reopen to the run whose verdict counts");
  const own = routed(ruled(2), { release: BUILDER_JUDGES });
  assert.match(own.missing[0].command, /^forge record verdict ISS-3 --criterion 1 --verdict fail /u,
    "where the builder judges, it is still sent to write the fail");
  assert.doesNotMatch(own.missing[0].what, /another run's/u);
});
