/* What a reopen's triage does to the verdicts already on the record. It sits apart from the rest of
   the advance suite because that file reached the line limit and this is the seam: every case here
   reads one function, and none of them spawns the CLI. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome, typedPlan } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("advance-judged").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { judgedOwed, viewFrom } = await import("../../../src/flow/earned.mjs");

let clock = 0;
const at = () => `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body, extra = {}) => ({ createdAt: at(), authorId: "agent", body, ...extra });
const recorded = (kind, fields, status = null) => comment(render(kind, fields, status));
const mark = (note) => comment(`mark_merged target=base — ${note}`);
const view = (issue, comments = []) => viewFrom("the-uuid", issue, comments);
const judging = (one) => judgedOwed(one, "ISS-3").map((item) => item.what);

const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const ATTACHED = [{ name: "run.txt" }];
const ruling = (outcome) => recorded("triage", { outcome, "would-have-caught": "a criterion naming the order" }, "0");
const SHIPPED = {
  plan: typedPlan(), acceptanceCriteria: "1. The first outcome.",
  attachments: ATTACHED, mergedAt: "2026-09-02T16:00:00.000Z",
};

/* A wrong-test triage moves the criteria and no commit with them, so every verdict on the record
   still names the merged commit: judged on those, the issue would pass back through the rung on the
   very judgement the person disagreed with. */
test("a reopen judges again, so a verdict from before its triage earns nothing", () => {
  const judged = (verdict) => recorded("verdict", { criterion: "1 — The first outcome.", verdict, commit: "43b811e", evidence: ["run.txt"] });
  const shipped = SHIPPED;
  /* The fixture clock stamps each record as it is made, so the order they are made in is the order
     the assembly reads them in — which is the whole of what this rule turns on. */
  const marked = mark("merged to master at 43b811e");
  const early = judged("pass");
  const wrong = ruling("wrong-test");
  assert.deepEqual(judging(view(shipped, [marked, early, wrong])), [
    "the verdict on criterion 1 was written before this reopen's triage, and a reopen judges again",
  ]);
  const late = judged("pass");
  assert.deepEqual(judging(view(shipped, [marked, early, wrong, late])), [],
    "a verdict written since the triage earns it again");
  assert.equal(judging(view(shipped, [marked, early, ruling("not-met")])).length, 1,
    "and not-met sends the judging back too, because the code moved under it");
  assert.deepEqual(judging(view(shipped, [marked, early, ruling("not-in-spec")])), [],
    "and not-in-spec found nothing wrong with this issue's own judging");
  /* A wrong-test correction may drop the criterion that was wrong, and a verdict cannot be written
     for a number the field no longer holds: asked for one, the issue could never reach the rung. */
  const dropped = { ...shipped, acceptanceCriteria: "2. The second outcome." };
  assert.deepEqual(judging(view(dropped, [marked, early, wrong])), ["criterion 2 has no verdict"]);
  /* A reopen re-judges every criterion at once, so the twelve ISS-289 itself carried would have come
     back as twelve items and twelve writes — the cost the batched write removed (ISS-297). */
  const all = { ...shipped, acceptanceCriteria: `${CRITERIA}\n3. The third outcome.` };
  const each = [1, 2, 3].map((number) =>
    recorded("verdict", { criterion: `${number} — an outcome`, verdict: "pass", commit: "43b811e", evidence: ["run.txt"] }));
  const stale = view(all, [marked, ...each, ruling("wrong-test")]);
  assert.deepEqual(judging(stale), [
    "the verdicts on criteria 1, 2, 3 were written before this reopen's triage, and a reopen judges again",
  ], "one item names the set");
  assert.deepEqual(judgedOwed(stale, "ISS-3").map((one) => one.command), [
    "forge record verdict ISS-3 --commit <sha> --evidence <attachment|url|sha>"
    + " --verdict <pass|fail|skipped|short> --criterion 1 --criterion 2 --criterion 3",
  ], "and one write answers it, its shared flags before the first --criterion");
  assert.deepEqual(judgedOwed(view(shipped, [marked, early, wrong]), "ISS-3").map((one) => one.command), [
    "forge record verdict ISS-3 --criterion 1 --verdict <pass|fail|skipped|short> --commit <sha> --evidence <attachment|url|sha>",
  ], "while one stale verdict keeps the item and the command it had");
});

/* A second triage repeating the first rules on nothing the first did not, so the verdict written
   between them still answers the reopen: measured from the repeat, every verdict at that reopen
   reads as written before the ruling and the judging is asked for twice (ISS-2030). */
test("a triage repeating the ruling a verdict answered leaves that verdict judged", () => {
  const shipped = SHIPPED;
  const marked = mark("merged to master at 43b811e");
  const first = ruling("wrong-test");
  const answered = recorded("verdict", { criterion: "1 — The first outcome.", verdict: "pass", commit: "43b811e", evidence: ["run.txt"] });
  assert.deepEqual(judging(view(shipped, [marked, first, answered, ruling("wrong-test")])), [],
    "the repeat rules on nothing the first did not, so the verdict since the first still stands");
  assert.deepEqual(judging(view(shipped, [marked, first, answered, ruling("not-met")])), [
    "the verdict on criterion 1 was written before this reopen's triage, and a reopen judges again",
  ], "while a ruling that moved is measured from itself, and sends the judging back");
});

