/* A transition the tracker refuses is worded by the caller and not printed bare by the transport:
   where those words claim something about the issue's own status — `NO_OP: issue already in
   toStatus`, met on four projects, ISS-1422 — a run with nothing beside them reads the claim as true,
   and both statuses that disprove it are values the call holds. Spawned: a run acts on the whole
   line the verb printed. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

const { AMBIGUOUS } = await import("../../../src/tracker/rest.mjs");

process.env.XDG_CONFIG_HOME = tempHome("advance-refused-move").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const NO_OP = "NO_OP: issue already in toStatus";
const HOLDER = "this-run";
/* A status this far up with an empty lease field is a refusal of its own, short of the move. */
const LEASE = { holder: HOLDER, agent: "claude-code_2-1-258_agent", pid: String(process.pid), renewedAt: new Date().toISOString(), minutes: 30 };
const PARKED = {
  documentId: "parked-uuid",
  issueId: "ISS-99",
  status: "awaiting_release",
  title: "the issue every route to closed refused",
  description: "no mark here",
  releaseNotes: { section: "Skip", userFacing: "-" },
  sessionContext: { lease: LEASE },
};
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true } },
  issues: [PARKED],
  comments: { "parked-uuid": [] },
  answer: {},
};
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: [PARKED], returned: 1, hasMore: false };
  if (args.action === "get") return PARKED;
  if (args.action === "transition") {
    if (state.refuses) return { refused: state.refuses };
    PARKED.status = args.data.status;
    return { ...PARKED };
  }
  return Object.assign(PARKED, args.data ?? {});
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
const advance = (...argv) =>
  ranAsync(FORGE, ["advance", "ISS-99", ...argv], { ...ENV, FORGE_SESSION_ID: HOLDER });

test("a refused move names the status the issue holds and the status it was asked for, above what refused it", async () => {
  state.refuses = NO_OP;
  PARKED.status = "awaiting_release";
  const run = await advance();
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /ISS-99 is awaiting_release and the move to closed was refused, so nothing was written\./u,
    run.stderr);
  /* The envelope is the transport's: the framing adds nothing inside the words and leaves them last. */
  const under = run.stderr.split("What refused it:\n")[1] ?? "";
  assert.ok(under.trimEnd().endsWith(NO_OP), `the refusal goes under that line whole: ${run.stderr}`);
});

test("a move the tracker takes prints the pair it moved between and nothing about a refusal", async () => {
  state.refuses = null;
  PARKED.status = "awaiting_release";
  const run = await advance();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /ISS-99 {2}awaiting_release -> closed/u, run.stdout);
  assert.doesNotMatch(run.stdout, /was refused/u, "and nothing of the refused path reaches a move that landed");
});

/* A project that enables `awaiting_release` and names no `closed` closes exactly as one that names
   neither — the control that killed four filings' reading — so nothing reads that key to decide what
   the next status is owed (ISS-1422). */
test("--owed answers the same whatever pipelineConfig.states holds", async () => {
  state.refuses = null;
  PARKED.status = "awaiting_release";
  const bare = await advance("--owed");
  state.config.pipelineConfig = {
    autoProdDeploy: true,
    states: { open: { enabled: true, mode: "auto" }, needs_info: { enabled: true }, awaiting_release: { enabled: true } },
  };
  const configured = await advance("--owed");
  assert.equal(configured.stdout, bare.stdout, configured.stdout);
  assert.match(bare.stdout, /closed is next/u, bare.stdout);
});

test("a move that neither landed nor failed claims nothing about the status and sends the run to read it", async () => {
  state.refuses = `Forge did not answer POST /api/issues/parked-uuid/transition: socket hang up\n${AMBIGUOUS}`;
  PARKED.status = "awaiting_release";
  const run = await advance();
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /neither landed nor failed cleanly/u, run.stderr);
  assert.match(run.stderr, /forge issue ISS-99 --fields status/u, "the read that settles it comes first");
  assert.doesNotMatch(run.stderr, /nothing was written/u, "and nothing asserts a move the transport could not see");
});
