/* A rung that drops the plan still owes a home for what the plan declares, the witnessed answer above
   all, and that home is the plan field: a plan holding only the sections a declaration asks for is
   written whole there, and refused where the rung owes the plan whole (ISS-2275). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempHome, tempRoom, typedPlan } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";
import { PLAN_SECTIONS, WITNESSED } from "../../../../src/flow/machine.mjs";

process.env.XDG_CONFIG_HOME = tempHome("record-plan-declarations").path;
const room = tempRoom("record-plan-declarations-");
const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const MINE = "this-run";

const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [{ documentId: "uuid-2275", issueId: "ISS-2275", status: "confirmed", title: "a home", description: "x" }],
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "update") state.issues[0] = { ...state.issues[0], ...args.data };
      return state.issues[0];
    },
    forge_comments: (args) => {
      if (args.action === "list") return { comments: [], returned: 0, limit: 0, hasMore: false };
      return { documentId: "c-1", ...args.data };
    },
  },
};

const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());

state.issues[0].sessionContext = {
  lease: { holder: MINE, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] },
};

/* The consult rule is proved beside `record plan` itself; these stand the reader down. */
const env = { ...ENV, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: MINE, FORGE_CODEX_DISABLE: "1" };

const fileAt = (name, text) => {
  const path = join(room, name);
  writeFileSync(path, `${text}\n`);
  return path;
};

const ran = async (argv) => {
  let run = await ranAsync(FORGE, argv, env);
  if (run.status !== 0 && /Hold —/u.test(run.stderr)) run = await ranAsync(FORGE, argv, env);
  return run;
};

/** The plan write at a complexity, from an empty field, so a refusal is read as the field untouched. */
const wrote = (complexity, text) => {
  delete state.issues[0].plan;
  state.issues[0].complexity = complexity;
  return ran(["record", "plan", "ISS-2275", fileAt("plan.md", text)]);
};

/** A plan holding only the named sections, every other section the fixture would write left out. */
const only = (sections) => typedPlan(Object.fromEntries(PLAN_SECTIONS.map((one) => [one.name, sections[one.name] ?? null])));

const CITES = only({ [WITNESSED]: "criteria: 2\n\nThe second criterion is the screen a user sees." });
const NONE = only({ [WITNESSED]: "none — every criterion is read off the CLI's own output." });
const DECLARED = (screen) => only({
  Declarations: `Screen change: ${screen}\nSchema coupling: no\nDeploy coupling: no`,
  [WITNESSED]: "none — the change is a refusal's wording.",
});

test("a rung dropping the plan writes a plan holding only the witnessed section, citing a criterion", async () => {
  const run = await wrote("s", CITES);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.issues[0].plan, `${CITES}\n`, "the field holds the section whole");
  assert.match(state.issues[0].plan, /^criteria: 2$/mu);
});

test("a rung dropping the plan writes a plan holding only the witnessed section, answering none", async () => {
  for (const complexity of ["s", "xs"]) {
    const run = await wrote(complexity, NONE);
    assert.equal(run.status, 0, `${complexity}: ${run.stderr}`);
    assert.equal(state.issues[0].plan, `${NONE}\n`, `${complexity}: the none and its reading are what the field holds`);
  }
});

test("a rung dropping the plan writes a plan holding only the declarations and the witnessed section", async () => {
  const plan = DECLARED("no");
  const run = await wrote("s", plan);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.issues[0].plan, `${plan}\n`);
});

test("the top rung refuses a declarations-only plan, naming every section it still owes", async () => {
  const run = await wrote("m", NONE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /; ISS-2275 is a `feature`, whose plan owes every section, so nothing was written:$/mu, run.stderr);
  /* Spelled here rather than read off the source, so the case says what is owed independently of it. */
  const owed = PLAN_SECTIONS.filter((one) => !one.owed && one.name !== "Declarations").map((one) => one.name);
  for (const name of owed) assert.match(run.stderr, new RegExp(`^ {2}## ${name}$`, "mu"), `${name} is not named`);
  assert.doesNotMatch(run.stderr, new RegExp(`^ {2}## ${WITNESSED}$`, "mu"), "and the section it holds is not");
  assert.equal(state.issues[0].plan, undefined, "the field is untouched");
});

test("a fix whose declarations-only plan declares a screen change is refused for the climb", async () => {
  const run = await wrote("s", DECLARED("yes"));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr,
    /ISS-2275's complexity claims `fix`, but this plan declares a screen change, which lifts it to `feature`/u, run.stderr);
  assert.match(run.stderr, /^ {2}## Steps$/mu, "and what the climb owes is named");
  assert.equal(state.issues[0].plan, undefined, "the field is untouched");
});

test("a declarations-only plan still answers the witnessed section one way", async () => {
  const run = await wrote("s", only({ [WITNESSED]: "Nothing here is for a screen." }));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /`## Witnessed on screen` answers neither way, so nothing was written/u, run.stderr);
  assert.equal(state.issues[0].plan, undefined);
});

test("a criteria file carrying a plan section's heading is refused with the plan write named", async () => {
  const run = await ran(["record", "criteria", "ISS-2275",
    fileAt("criteria.md", `1. The refusal names the field.\n\n## ${WITNESSED}\n\nnone`)]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /Every criterion is a numbered line/u, "the criteria rule stands");
  assert.match(run.stderr,
    new RegExp(`\`## ${WITNESSED}\` is a section of the plan, which \`forge record plan ISS-2275 <plan\\.md>\` takes`, "u"),
    run.stderr);
  const prose = await ran(["record", "criteria", "ISS-2275", fileAt("prose.md", "the list is sorted by name")]);
  assert.doesNotMatch(prose.stderr, /is a section of the plan/u, "and a line that is no heading is told nothing of the plan");
});

test("the plan's help says a rung dropping the plan takes a plan holding only the declaring sections", async () => {
  const run = await ran(["record", "plan", "-h"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout.replace(/\s+/gu, " "),
    /Where the rung drops the plan, a plan holding only Declarations, Witnessed on screen and The way back is the whole of it/u,
    run.stdout);
});
