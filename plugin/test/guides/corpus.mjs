/* What the CLI actually prints about the flow, as units a comparison can read: the shortfall of
   every entry check, the refusals `route.mjs` raises, the rung report at each rung and every record
   kind's own usage. One synthetic issue state per family, so a message a conditional check raises on
   an otherwise whole record is here beside the one an absent payload raises — a corpus of absences
   would pass a contract that copied the conditional halves (ISS-802). */
import assert from "node:assert/strict";

import { CHECKS, viewFrom } from "../../src/flow/earned.mjs";
import { owedIn } from "../../src/flow/route.mjs";
import { KINDS, kindHelp } from "../../src/flow/record/record-rows.mjs";
import { RUNGS, complexityFor } from "../../src/ladder.mjs";
import { rungReport } from "../../src/ladder-report.mjs";
import { claims } from "../../src/checks/duplication.mjs";
import { render } from "../../src/flow/record/page.mjs";

/** Doctor's threshold, and the floor `docs-have-one-home.test.mjs` uses: three words collide in
 *  short prose, and a table cell is short prose. */
export const THRESHOLD = 0.25;
export const FLOOR = 5;

let clock = 0;
const at = () => `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const recorded = (kind, fields, reopen = null) =>
  ({ createdAt: at(), authorId: "agent", body: render(kind, fields, reopen) });
const marked = (note) => ({ createdAt: at(), authorId: "agent", body: `mark_merged target=base — ${note}` });

const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const PLANNED = "## Files touched\n\na.mjs\n";
const WHOLE = "at 43b811e; reviewed head 43b811e; judged head 43b811e; landing moved nothing";

const owed = (status, issue, comments = [], extra = {}) =>
  CHECKS[status](viewFrom("the-uuid", issue, comments, null, extra.release ?? null, null, null), "ISS-3")
    .flatMap((one) => [one.what, one.command]);

const routed = (view) => {
  const held = owedIn(view, "ISS-3");
  return [held.refused ?? "", ...held.missing.flatMap((one) => [one.what, one.command])];
};

const refusals = () => [
  viewFrom("the-uuid", { status: "reopen", plan: "", acceptanceCriteria: CRITERIA, reopenCount: 1 }, []),
  viewFrom("the-uuid", { status: "on_hold", plan: "", acceptanceCriteria: "" },
    [recorded("park", { kind: "unshippable", why: "the branch cannot build", left: "in_progress" })]),
].flatMap(routed);

/* `landedOn` refuses a reopen with neither a merged mark nor a dropped park before `reopenOwed` is reached, so the reopen payload checks reach the corpus only from a reopen that landed. */
const reopenPayloads = () => routed(viewFrom("the-uuid",
  { status: "reopen", plan: PLANNED, acceptanceCriteria: CRITERIA, mergedAt: at() }, []));

/** One entry per family: the name a failure reports, and what the CLI said in that state. */
export const FAMILIES = {
  "an absent payload": () => [
    ...owed("confirmed", { plan: "", acceptanceCriteria: "" }),
    ...owed("clarified", { plan: "", acceptanceCriteria: "" }),
    ...owed("approved", { plan: "", acceptanceCriteria: "" }),
    ...owed("in_progress", { plan: "", acceptanceCriteria: "",
      relations: { blockedBy: [{ kind: "blocks", otherDisplayId: "ISS-2", otherStatus: "open" }] } }),
    ...owed("developed", { plan: "", acceptanceCriteria: CRITERIA }),
    ...owed("awaiting_release", { plan: "", acceptanceCriteria: CRITERIA }),
  ],
  "an untyped plan": () => owed("approved", { plan: "Some free prose.", acceptanceCriteria: CRITERIA }),
  "a baseline of partial scope": () => owed("in_progress", { plan: "", acceptanceCriteria: "" },
    [recorded("baseline", { gate: "npm run check", result: "nothing fails", commit: "43b811e", scope: "part" })]),
  "a declared screen change with no attachment": () => owed("awaiting_release",
    { plan: "Screen change: yes\nSchema coupling: no", acceptanceCriteria: CRITERIA },
    [recorded("verdict", { criterion: "1. The first outcome.", verdict: "pass", commit: "43b811e", evidence: ["43b811e"] })]),
  "a project that deploys production on its own": () => owed("awaiting_release",
    { plan: "", acceptanceCriteria: CRITERIA },
    [marked(`${WHOLE}; landing wrote a.mjs`),
      recorded("verification", { where: "the host", commit: "9e1f2a3", evidence: ["9e1f2a3"] })],
    { release: { autoProd: true } }),
  "a landing that moved this change's paths": () => owed("awaiting_release",
    { plan: PLANNED, acceptanceCriteria: CRITERIA, mergedAt: at() },
    [marked("at 9e1f2a3; reviewed head 43b811e; judged head 43b811e; landing moved a.mjs; landing wrote a.mjs"),
      recorded("verdict", { criterion: "1. The first outcome.", verdict: "pass", commit: "43b811e", evidence: ["43b811e"] })]),
  "a landing outside the plan": () => owed("developed",
    { plan: PLANNED, acceptanceCriteria: CRITERIA, mergedAt: at() },
    [marked(`${WHOLE}; landing wrote b.mjs`)]),
  "a route the verb refuses": refusals,
  "a reopen owing its finding and its triage": reopenPayloads,
  "a verdict older than this reopen's triage": () => owed("awaiting_release",
    { plan: PLANNED, acceptanceCriteria: CRITERIA, attachments: [{ name: "run.txt" }], mergedAt: at() },
    [marked(WHOLE),
      recorded("verdict", { criterion: "1 — The first outcome.", verdict: "pass", commit: "43b811e", evidence: ["run.txt"] }),
      recorded("verdict", { criterion: "2 — The second outcome.", verdict: "pass", commit: "43b811e", evidence: ["run.txt"] }),
      recorded("triage", { outcome: "wrong-test", "would-have-caught": "a criterion naming the order" }, "0")]),
  "the rung report": () => RUNGS.map((rung) =>
    rungReport({ plan: "", moved: [], whole: true, complexity: complexityFor(rung) }, "ISS-3")),
  "a record kind's own usage": () => KINDS.map((kind) => kindHelp(kind)),
};

/** `[family, unit]` pairs, every family asserted to have produced text: one that produced none is a
 *  family this comparison never read, which reads exactly like a clean contract. */
export const corpusUnits = () => Object.entries(FAMILIES).flatMap(([family, make]) => {
  const held = make().filter((one) => typeof one === "string" && one.trim());
  assert.ok(held.length, `the corpus family "${family}" produced no text, so nothing was compared `
    + `against it: the synthetic state no longer reaches the check it was built for`);
  return held.flatMap((text) => claims(text).map((one) => [family, one]));
});
