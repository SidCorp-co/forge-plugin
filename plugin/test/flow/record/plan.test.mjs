/* The plan is a payload of the contract like the criteria, and this is the kind that writes it: the
   same field writer, the same consult rule, the same lease. What the top-level verb it replaced did
   differently was be a second surface for one write (ISS-348). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome, tempRoom, typedPlan } from "../../fixtures.mjs";
import { PLAN_SECTIONS } from "../../../src/flow/machine.mjs";

process.env.XDG_CONFIG_HOME = tempHome("record-plan").path;
const room = tempRoom("record-plan-");
const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const MINE = "this-run";
const PLAN = "# The plan\n\nScreen change: no\nSchema coupling: no\nUser-facing outcome: no\n\nOne field, one verb.";

const state = {
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [{ documentId: "uuid-348", issueId: "ISS-348", status: "clarified", title: "one verb per write", description: "x" }],
  comments: { "uuid-348": [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "update") state.issues[0] = { ...state.issues[0], ...args.data };
      return state.issues[0];
    },
    forge_comments: (args) => (args.action === "list"
      ? { comments: [], returned: 0, limit: 0, hasMore: false }
      : { documentId: "c-1", ...args.data }),
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

/* The consult rule is `record criteria`'s and is proved beside it; a case about the field writer
   stands the reader down so it is measuring one thing. */
const env = (session = MINE, extra = {}) => ({
  ...tracker.env,
  AI_AGENT: "a-test-agent",
  CLAUDE_PID: "4242",
  FORGE_SESSION_ID: session,
  FORGE_CODEX_DISABLE: "1",
  ...extra,
});

const heldBy = (who) => {
  if (!who) delete state.issues[0].sessionContext;
  else {
    state.issues[0].sessionContext = {
      lease: { holder: who, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] },
    };
  }
};

const planAt = (text = PLAN) => {
  const path = join(room, "plan.md");
  writeFileSync(path, `${text}\n`);
  return path;
};

const wrote = async (session, path, extra = {}) => {
  delete state.issues[0].plan;
  let run = await ranAsync(FORGE, ["record", "plan", "ISS-348", path], env(session, extra));
  if (run.status !== 0 && /Hold —/u.test(run.stderr)) {
    run = await ranAsync(FORGE, ["record", "plan", "ISS-348", path], env(session, extra));
  }
  return run;
};

test("the file's text is what the plan field holds", async () => {
  heldBy(MINE);
  const run = await wrote(MINE, planAt());
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.issues[0].plan, `${PLAN}\n`, "byte for byte, the declarations with it");
  assert.match(run.stdout, /Screen change: no/u, "and what was stored is printed back");
  assert.match(run.stderr, /carries none of the sections `forge record plan -h` prints/u,
    "a plan with no section is the free text this verb has always stored, and it says so");
  assert.match(run.stderr, /`forge advance` will refuse `approved` while it stays untyped/u);
});

/* Presence is the whole of the check, and it is made before the tracker is touched: a plan the
   write refuses is one nothing was spent on, which is the same rule `record criteria` follows. */
test("a typed plan missing a section is refused, with each one named", async () => {
  heldBy(MINE);
  const run = await wrote(MINE, planAt(typedPlan({ Before: null, "Verified in code": null })));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /The plan carries no 2 of the sections below, so nothing was written:/u);
  assert.match(run.stderr, /^ {2}## Before$/mu);
  assert.match(run.stderr, /^ {2}## Verified in code$/mu);
  assert.match(run.stderr, /a heading whose text is the name and nothing else/u, "and how to supply one");
  assert.equal(state.issues[0].plan, undefined, "the field is untouched");
});

test("the way back is refused only where a coupling declaration asks for it", async () => {
  heldBy(MINE);
  for (const which of ["Schema", "Deploy"]) {
    const declared = `Screen change: no\nSchema coupling: no\n${which} coupling: yes`;
    const run = await wrote(MINE, planAt(typedPlan({ Declarations: declared })));
    assert.equal(run.status, 1, which);
    assert.match(run.stderr, new RegExp(`## The way back — the plan declares ${which.toLowerCase()} coupling`, "u"),
      "the refusal names the declaration that owes it");
  }
  const answered = typedPlan({ Declarations: "Screen change: no\nSchema coupling: yes", "The way back": "Revert and ship again." });
  const held = await wrote(MINE, planAt(answered));
  assert.equal(held.status, 0, held.stderr);
});

test("a step naming no criterion is refused, and the step is quoted", async () => {
  heldBy(MINE);
  const run = await wrote(MINE, planAt(typedPlan({ Steps: "1. The one step — criteria 1\n2. The one that serves nothing" })));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^One step names no criterion, and a step serving none is one no verdict reaches, so nothing was written:$/mu);
  assert.match(run.stderr, /^ {2}2\. The one that serves nothing$/mu);
  assert.match(run.stderr, /as `criteria: 3` or `criteria: 3, 4`/u, "and the spelling that clears it");
  const both = await wrote(MINE, planAt(typedPlan({ Steps: "1. Colonless — criteria 1\n2. With one, criteria: 2" })));
  assert.equal(both.status, 0, both.stderr);
});

/* The file's own bytes reach the check, and a plan written on Windows carries a `\r` the reader kept
   until it split on both: unsplit, every heading of a complete plan was one nothing matched. */
test("a plan whose lines end in CRLF is judged by the same reading as one that does not", async () => {
  heldBy(MINE);
  const crlf = (text) => text.replace(/\n/gu, "\r\n");
  const run = await wrote(MINE, planAt(crlf(typedPlan())));
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stderr, /carries none of the sections/u, "typed, and not the free text an unsectioned plan is");
  const short = await wrote(MINE, planAt(crlf(typedPlan({ Steps: null }))));
  assert.equal(short.status, 1, "and a section it lacks is refused, as it is on the copy ending its lines with one byte");
  assert.match(short.stderr, /^ {2}## Steps$/mu);
});

/* The one input this shape could have taken away: a free-text plan quoting an example of the very
   thing it is not. A fence holds text a plan shows, so nothing in one opens a section or is a step. */
test("a section a plan quotes inside a fence is text it shows and not one it carries", async () => {
  heldBy(MINE);
  const quoted = `${PLAN}\n\nWhat a typed plan looks like:\n\n\`\`\`markdown\n## Before\n\nthe old shape\n\n## Steps\n\n1. The step — criteria 1\n\`\`\`\n`;
  const run = await wrote(MINE, planAt(quoted));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /carries none of the sections `forge record plan -h` prints/u,
    "the plan is the free text it was before this shape existed, and the write stores it");
  assert.equal(state.issues[0].plan, `${quoted}\n`, "byte for byte, the fence and all");
  const shown = typedPlan({ Steps: "1. The one step — criteria 1, 2\n\n```\n2. What a step must not be, criteria: 9\n```" });
  const held = await wrote(MINE, planAt(shown));
  assert.equal(held.status, 0, held.stderr, "and a fenced line under Steps is no step to refuse");
});

test("`record plan -h` prints every section a typed plan owes, as the question it answers", async () => {
  const run = await ranAsync(FORGE, ["record", "plan", "-h"], env());
  assert.equal(run.status, 0, run.stderr);
  for (const one of PLAN_SECTIONS) {
    assert.match(run.stdout, new RegExp(`^ {2}## ${one.name} +${one.asks.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "mu"), one.name);
  }
  assert.match(run.stdout, /The way back is owed only where the plan declares schema coupling or deploy coupling\./u);
  assert.match(run.stdout, /naming none is refused here\. At `approved`, where the criteria field is read, so is a step whose\nnumbers name no criterion the issue holds, and a criterion no step names\./u);
});

/* A field accepted and dropped answers 200 exactly like one that was stored, which is why the write
   reads it back before it reports anything: docs/cli/two-writes-that-lie.md. */
test("success is reported only once the stored plan reads back", async () => {
  heldBy(MINE);
  const held = state.answer.forge_issues;
  /* The one field dropped, and the lease it rides beside stored: a tracker that dropped both would
     be refused by the lease read-back first, and this case would prove that one instead. */
  state.answer.forge_issues = (args) => {
    if (args.action === "update") return held({ ...args, data: { ...args.data, plan: undefined } });
    return held(args);
  };
  try {
    const run = await wrote(MINE, planAt());
    assert.equal(run.status, 1, "a plan the tracker dropped is not a plan that was written");
    assert.match(run.stderr, /still has no plan/u);
  } finally {
    state.answer.forge_issues = held;
  }
});

test("an empty plan is refused rather than clearing the field", async () => {
  heldBy(MINE);
  const run = await wrote(MINE, planAt("   "));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /An empty plan would clear the field/u);
});

test("the kind takes one file and nothing after it, and says what the file holds", async () => {
  heldBy(MINE);
  const extra = await ranAsync(FORGE, ["record", "plan", "ISS-348", planAt(), "again.md"], env());
  assert.equal(extra.status, 1);
  assert.match(extra.stderr, /record plan takes one file and nothing after it/u);
  const none = await ranAsync(FORGE, ["record", "plan", "ISS-348"], env());
  assert.equal(none.status, 1);
  assert.match(none.stderr, /record plan takes the file holding the plan/u);
});

/* The lease the field writer takes is every field write's, so the option `forge comment` asks for
   reaches none of it: a plan is the holder's payload and stays one. */
test("another run's lease refuses the write, and neither field moves", async () => {
  heldBy("the-other-run");
  const before = { plan: state.issues[0].plan, lease: state.issues[0].sessionContext.lease.renewedAt };
  const run = await ranAsync(FORGE, ["record", "plan", "ISS-348", planAt()], env());
  assert.equal(run.status, 1);
  assert.match(run.stderr, /ISS-348 is held by another run/u);
  assert.equal(state.issues[0].plan, before.plan, "the plan field is as it was");
  assert.equal(state.issues[0].sessionContext.lease.renewedAt, before.lease, "and so is the lease");
});

test("the kind is on the table `forge record -h` prints, with the plan field's own cap", async () => {
  const run = await ranAsync(FORGE, ["record", "-h"], env());
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}plan {9}<file\.md>\(\d+\) {2}the plan itself, from a file a consult has read$/mu);
  const one = await ranAsync(FORGE, ["record", "plan", "-h"], env());
  assert.equal(one.status, 0, one.stderr);
  assert.match(one.stdout, /Usage: forge record plan <uuid\|ISS-45>/u);
});

/* The rule this shares with `record criteria`, which is what makes the two one payload: the file a
   consult has not read is refused before the tracker is touched. */
test("a file no answered consult has read whole is refused, as the criteria file is", async () => {
  heldBy(MINE);
  const path = planAt();
  const run = await ranAsync(FORGE, ["record", "plan", "ISS-348", path], env(MINE, { FORGE_CODEX_DISABLE: "0" }));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /consult/u);
  assert.match(run.stderr, /forge codex consult --send bodies/u, "and the command that clears it");
});
