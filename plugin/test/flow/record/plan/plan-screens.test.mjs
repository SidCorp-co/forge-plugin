/* A project's answer to whether its projects have a screen is the flow it wrote, and a project that
   wrote none has given no answer: its plan declaring a screen change is written, where one that wrote
   `default` is refused as before (ISS-1895). Each case stands in a checkout of its own, because the
   flow is read off that checkout's record of its project once per process. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { projectRoom, ranAsync, tempRoom, typedPlan } from "../../../fixtures.mjs";
import { OWN, trackerFor } from "../../../fixtures/own-project.mjs";
import { WITNESSED } from "../../../../src/flow/machine.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const MINE = "this-run";

const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [{ documentId: "uuid-1895", issueId: "ISS-1895", status: "confirmed", title: "no flow chosen", description: "x" }],
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

/* The consult rule is proved beside `record plan` itself; every case but the one about its order
   stands the reader down, so it measures the screen question alone. */
const env = (extra = {}) => ({
  ...ENV, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: MINE, FORGE_CODEX_DISABLE: "1", ...extra,
});

/** A checkout whose record of its project holds these keys beside the suite's own. */
const checkout = (keys) => projectRoom(tempRoom("plan-screens-"), ENV.XDG_CONFIG_HOME, { ...OWN, ...keys });

const UNSET = checkout({});
const DEFAULT = checkout({ flow: "default" });
const METHOD = checkout({ method: 1 });

const SCRATCH = tempRoom("plan-screens-file-");
const planAt = (text) => {
  const path = join(SCRATCH, "plan.md");
  writeFileSync(path, `${text}\n`);
  return path;
};

const DECLARES = (screen) => `Screen change: ${screen}\nSchema coupling: no\nDeploy coupling: no`;
const CLAIMED = typedPlan({ Declarations: DECLARES("yes") });

const wrote = async (room, text, extra = {}) => {
  delete state.issues[0].plan;
  const argv = ["record", "plan", "ISS-1895", planAt(text)];
  let run = await ranAsync(FORGE, argv, env(extra), room);
  if (run.status !== 0 && /Hold —/u.test(run.stderr)) run = await ranAsync(FORGE, argv, env(extra), room);
  return run;
};

test("a project that chose no flow writes a plan declaring a screen change", async () => {
  const run = await wrote(UNSET, CLAIMED);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.issues[0].plan, `${CLAIMED}\n`, "the declaration the run made is the one the field holds");
  assert.match(state.issues[0].plan, /^Screen change: yes$/mu);
});

test("a project that chose no flow is asked nothing about a screen its plan does not declare", async () => {
  const plan = typedPlan({ Declarations: DECLARES("no"), [WITNESSED]: null });
  const run = await wrote(UNSET, plan);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.issues[0].plan, `${plan}\n`);
});

test("a declared screen change still owes what a person witnesses where no flow was chosen", async () => {
  const run = await wrote(UNSET, typedPlan({ Declarations: DECLARES("yes"), [WITNESSED]: null }));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, new RegExp(`^ {2}## ${WITNESSED} — the plan declares screen change$`, "mu"), run.stderr);
  assert.equal(state.issues[0].plan, undefined, "the field is untouched");
});

for (const [said, room] of [["`flow: default`", DEFAULT], ["`method: 1`", METHOD]]) {
  test(`a project that wrote ${said} refuses a plan declaring a screen change, naming the file`, async () => {
    const run = await wrote(room, CLAIMED);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /^Flow default, which .+ sets, serves projects with no screen/mu, run.stderr);
    assert.match(run.stderr, /forge\/projects\/plan-screens-[^/]+\/config\.json sets/u, "the file is the room's own record");
    assert.equal(state.issues[0].plan, undefined, "the field is untouched");
  });
}

/* Before the consult: a run told by the consult refusal to pay for a read would pay for one the
   screen refusal then turns back anyway (ISS-1895 rule 4). */
test("the screen refusal comes before the consult refusal", async () => {
  const run = await wrote(DEFAULT, CLAIMED, { FORGE_CODEX_DISABLE: "0" });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /serves projects with no screen/u, run.stderr);
  assert.doesNotMatch(run.stderr, /forge codex consult/u, "and no consult is asked for a file this refuses");
});

test("the plan's help says what this project answered about its screens, and where", async () => {
  const unset = await ranAsync(FORGE, ["record", "plan", "-h"], env(), UNSET);
  assert.match(unset.stdout, /This project chose no flow, so nothing here says whether its projects have a screen: a\nplan declaring screen change is written/u,
    unset.stdout);
  const pinned = await ranAsync(FORGE, ["record", "plan", "-h"], env(), DEFAULT);
  assert.match(pinned.stdout, /This project's flow, default, set in .+config\.json, serves projects with no screen, so a plan\ndeclaring screen change is refused here\./u,
    pinned.stdout);
});
