/* `default` serves a project with no screen, and was asking every plan on it what a person witnesses
   on one and then demanding a park nobody could answer (ISS-1694). The boundary held here is ISS-902's:
   the flow is read where a plan is written and at no rung. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome, typedPlan } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("no-screen-flow").path;
const { DEFAULT, SCREEN, screensOf } = await import("../../../src/guides/flow.mjs");
const { screensRefusal } = await import("../../../src/flow/record/fields.mjs");
const { WITNESSED, planFlags, planSections, sectionsOwed } = await import("../../../src/flow/machine.mjs");
const { CHECKS, deployedOwed, viewFrom } = await import("../../../src/flow/earned.mjs");
const { lookAhead } = await import("../../../src/flow/route.mjs");
const { render } = await import("../../../src/flow/record/page.mjs");

let clock = 0;
const at = () => `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body, extra = {}) => ({ createdAt: at(), authorId: "agent", body, ...extra });

const refusal = (flow, plan) => {
  const held = planSections(plan);
  return screensRefusal(flow, planFlags(plan), held, screensOf(flow));
};

test("the flow that has screens asks every plan about one, and the flow that has none refuses the claim", () => {
  assert.equal(screensOf(SCREEN), true, "the shipped flow whose projects have a screen says so");
  assert.equal(screensOf(DEFAULT), false, "and the one they do not");

  const silent = typedPlan({ [WITNESSED]: null });
  assert.equal(refusal(DEFAULT, silent), null,
    "a plan on a project with no screen is asked nothing about one, which is the whole of the defect");
  const asked = refusal(SCREEN, silent);
  assert.match(asked, /serves projects with a screen/u);
  assert.match(asked, /## Witnessed on screen/u, "and the refusal names the section it wants");
  assert.equal(refusal(SCREEN, typedPlan()), null, "a plan that answered it is not refused");
  assert.equal(refusal(SCREEN, typedPlan({ Declarations: "Screen change: no\nSchema coupling: no" })), null,
    "and the question is put whichever way the plan declared, a considered `none` being an answer");

  const claimed = typedPlan({ Declarations: "Screen change: yes\nSchema coupling: no" });
  const said = refusal(DEFAULT, claimed);
  assert.match(said, /serves projects with no screen and this plan declares a screen change/u);
  assert.match(said, /screen change: no/u, "and names the line to write");
  assert.match(said, /forge doctor/u, "and the other way out, which is to run a flow that has one");
});

/* The rung's half of the same boundary. `sectionsOwed` takes no flow and is given none: the section
   is owed by the declaration that has always owed a person a look, the way the way back is owed by
   its couplings, so a project switching flows reinterprets no plan already written. */
test("the witnessed section is owed at a rung by a declared screen change and by nothing else", () => {
  const silent = typedPlan({ [WITNESSED]: null });
  assert.deepEqual(sectionsOwed(silent, planFlags(silent)), [],
    "a plan declaring no screen change owes the section at no rung, on either flow");
  const claimed = typedPlan({ [WITNESSED]: null, Declarations: "Screen change: yes\nSchema coupling: no" });
  assert.deepEqual(sectionsOwed(claimed, planFlags(claimed)), [WITNESSED],
    "and one declaring a screen change still cannot reach `approved` without saying what a person witnesses");

  const owed = (plan) => CHECKS.approved(viewFrom("the-uuid", {
    plan, acceptanceCriteria: "1. The first outcome.\n2. The second outcome.",
  }, [comment(render("decision", { decision: "one | two | three" }))]), "ISS-3").map((one) => one.what);
  assert.ok(!owed(silent).some((one) => one.includes(WITNESSED)),
    "which is what the entry check reads, so a plan on a flow with no screens is not turned back for it");
  assert.ok(owed(claimed).some((one) => one.includes(WITNESSED)),
    "and a declared screen change is");
});

const WAITS = { staging: "main", production: "main", autoProd: false, from: "the fixture" };
const LANDED = "merged to master at 43b811e; reviewed head 43b811e; judged head 43b811e; "
  + "landing moved nothing; landing wrote nothing";
const shipped = () => [
  comment(`mark_merged target=base — ${LANDED}`),
  comment(render("verification", { where: "https://app.example", commit: "43b811e", evidence: ["https://app.example/build/9"] })),
];
const parked = (kind) => [
  comment(render("park", { kind, why: "a person reads it", evidence: ["run.txt"] }, "awaiting_release")),
  { createdAt: at(), authorId: "a-person", body: "read it, and it is right." },
];
const DECLARES = (screen, look) => `## Declarations\n\nScreen change: ${screen}\nUser-facing outcome: ${look}\n`;
const at_ = (plan, comments) => viewFrom("the-uuid",
  { plan, attachments: [{ name: "run.txt" }], releaseNotes: { section: "Fixed" } },
  [...shipped(), ...comments], null, WAITS);
const looks = (plan, comments = []) => deployedOwed(at_(plan, comments), "ISS-3");

/* Which park is asked for follows the declaration and never the flow. */
test("a user-facing outcome that is no screen change is answered by a code review, and a screen change by a screen one", () => {
  const output = looks(DECLARES("no", "yes"));
  assert.equal(output.length, 1, `the person's look is the one thing owed: ${JSON.stringify(output)}`);
  assert.match(output[0].what, /the plan declares a user-facing outcome/u);
  assert.match(output[0].command, /--park code-review /u,
    "a change with no screen is asked for the review kind that speaks to a reader, not to a looker");

  const screen = looks(DECLARES("yes", "no") + `\n## ${WITNESSED}\n\ncriteria: 1\n`);
  assert.equal(screen.length, 1);
  assert.match(screen[0].command, /--park screen-review /u, "and a declared screen change still asks for the screen");

  assert.deepEqual(looks(DECLARES("no", "no")), [], "a plan declaring neither is owed no look at all");
});

/* The rehearsal names what the rung will ask for, so it names the same kind: a line naming one park
   and a refusal naming another is a run told twice and right once. */
test("the line ahead of the rung names the park the rung refuses on", () => {
  const ahead = (plan) => lookAhead(at_(plan, []), "ISS-3");
  assert.match(ahead(DECLARES("no", "yes")), /--park code-review /u);
  assert.match(ahead(DECLARES("yes", "no") + `\n## ${WITNESSED}\n\ncriteria: 1\n`), /--park screen-review /u);
});

/* Either kind is a person answering the same question, so neither is refused for its name. */
test("a person who answered either review kind has answered the look", () => {
  for (const kind of ["code-review", "screen-review"]) {
    assert.deepEqual(looks(DECLARES("no", "yes"), parked(kind)), [],
      `a person's answer under a ${kind} park is a person's answer`);
  }
});

/* The plan already answered this question in the field this project's own checker asks for: a run
   told to ask anyway has to invent something for that person to read (ISS-1607, on ISS-1694). */
test("a plan whose witnessed section answered none is owed no person's look", () => {
  assert.deepEqual(looks(DECLARES("no", "yes") + `\n## ${WITNESSED}\n\nnone — nothing here is a thing a person could look at.\n`), [],
    "the answer stands whichever declaration asked the question");
  assert.equal(looks(DECLARES("no", "yes")).length, 1,
    "and a plan carrying no such section answered nothing, an absence being the one thing that section exists to tell from a `none`");
});
