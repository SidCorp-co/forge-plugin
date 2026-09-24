/* A command beside an owed item that printed one value of a closed set read as an example: a run
   sent `partly holds` for `--finding holds` and learned the six values from the second refusal
   (ISS-184). Each case plants that wrong reading once and reads the set in the first refusal, and
   the last proves the set is read off the field the write refuses against rather than copied. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("closed-set-asks").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { CHECKS, judgedOwed, viewFrom } = await import("../../../src/flow/earned.mjs");
const { FINDINGS, OUTCOMES, VERDICTS } = await import("../../../src/flow/machine.mjs");
const { judgeAsk } = await import("../../../src/flow/qa/verdicts.mjs");
const { recaptureRefusal } = await import("../../../src/flow/landing/written.mjs");
const { targetOf } = await import("../../../src/flow/route.mjs");

let clock = 0;
const at = () => `2026-09-24T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ createdAt: at(), authorId: "agent", body });
const recorded = (kind, fields, status = null) => comment(render(kind, fields, status));
const view = (issue, comments = []) => viewFrom("the-uuid", issue, comments);

const COMMIT = "c8c3550";
const HEAD = "5a1b2c3d0000000000000000000000000000f00d";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const SCREEN = "Screen change: yes.\nSchema coupling: no.\nUser-facing outcome: no.";
const mark = (note = `merged to master at ${COMMIT}`) => comment(`mark_merged target=base — ${note}`);
const set = (values) => `<${values.join("|")}>`;

/* Every command a refusal prints for these flags, in one place, so the last case asks all of them. */
const asks = () => {
  const landed = { acceptanceCriteria: CRITERIA, mergedAt: "2026-09-24T09:00:00.000Z", attachments: [] };
  const passed = (number, commit) =>
    recorded("verdict", { criterion: `${number} — text`, verdict: "pass", commit, evidence: [commit] });
  return {
    confirmation: CHECKS.confirmed(view({}), "ISS-9")[0].command,
    review: CHECKS.developed(view({ mergedAt: landed.mergedAt }, [mark()]), "ISS-9")
      .find((one) => one.command.startsWith("forge record review")).command,
    one: judgedOwed(view(landed, [mark(), passed(1, COMMIT)]), "ISS-9")[0].command,
    several: judgedOwed(view(landed, [mark()]), "ISS-9")[0].command,
    moved: judgedOwed(view(landed, [
      mark(`merged to master at ${COMMIT}; judged head bc40edc; landing moved docs/a.md`),
      passed(1, "bc40edc"), passed(2, "bc40edc"),
    ]), "ISS-9")[0].command,
    shown: judgedOwed(view({ ...landed, plan: SCREEN }, [mark(), passed(1, COMMIT), passed(2, COMMIT)]), "ISS-9")
      .find((one) => one.command.startsWith("forge attach")).command,
    judge: judgeAsk("ISS-9", [1, 2], { head: HEAD, deployment: HEAD }),
    unreviewed: recaptureRefusal("ISS-9", HEAD, { latest: {}, verdicts: new Map(), criteria: [] }, true),
    unjudged: recaptureRefusal("ISS-9", HEAD, {
      latest: { review: { record: { fields: { commit: HEAD, outcome: "approved" } } } },
      verdicts: new Map(), criteria: [{ number: 1 }, { number: 2 }],
    }, false),
  };
};

test("the confirmation's write names every finding the write accepts, not `holds` alone", () => {
  const { confirmation } = asks();
  assert.ok(confirmation.endsWith(`--finding ${set(FINDINGS)}`), confirmation);
  assert.doesNotMatch(confirmation, /--finding holds\b/u, "the literal that read as an example is gone");
});

test("every review write a refusal prints names both outcomes", () => {
  const { review, unreviewed } = asks();
  assert.ok(review.includes(`--outcome ${set(OUTCOMES)} `), review);
  assert.ok(unreviewed.includes(`--outcome ${set(OUTCOMES)}`), unreviewed);
});

test("every verdict write a refusal prints names each verdict value, and the batched one names them once", () => {
  const got = asks();
  for (const name of ["one", "moved", "shown", "judge", "unjudged", "several"]) {
    assert.ok(got[name].includes(`--verdict ${set(VERDICTS)}`), `${name}: ${got[name]}`);
    assert.doesNotMatch(got[name], /--verdict pass\b/u, `${name} prints no single value: ${got[name]}`);
  }
  assert.equal(got.several.split("--verdict").length - 1, 1, got.several);
  assert.ok(got.several.indexOf("--verdict") < got.several.indexOf("--criterion"),
    `a shared flag stands before the first --criterion: ${got.several}`);
});

/* The rule the issue states: printed from the check's own definition, never a hand-written copy. A
   value the write would take appears in every command with no second edit. */
test("a value added to a closed set appears in every command that asks for that flag", () => {
  const PROBE = "probe-value";
  const lists = [FINDINGS, OUTCOMES, VERDICTS];
  for (const list of lists) list.push(PROBE);
  try {
    for (const [name, command] of Object.entries(asks())) {
      assert.ok(command.includes(`|${PROBE}>`), `${name} reads the set it asks for: ${command}`);
    }
  } finally {
    for (const list of lists) list.pop();
  }
});

/* Where the check accepts one value only, that value is the instruction rather than an example, and a
   set there would offer values the next check refuses. */
test("a command whose check accepts one value keeps that literal", () => {
  assert.match(CHECKS.in_progress(view({}), "ISS-9").find((one) => one.command.includes("baseline")).command,
    /--scope whole$/u);
  const reopened = view({
    status: "reopen", mergedAt: "2026-09-24T09:00:00.000Z", plan: SCREEN.replace("yes", "no"),
    acceptanceCriteria: CRITERIA, attachments: [{ name: "run.txt" }],
  }, [
    recorded("finding", { expected: "sorted", seen: "unsorted", evidence: ["run.txt"], quoted: "it is unsorted" }, "0"),
    recorded("triage", { outcome: "not-met", "would-have-caught": "a criterion naming the order" }, "0"),
  ]);
  assert.match(targetOf(reopened, "ISS-9").missing[0].command, /--verdict fail /u);
});
