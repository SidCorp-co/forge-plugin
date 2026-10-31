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
const { render } = await import("../../../src/flow/record/page.mjs");

process.env.XDG_CONFIG_HOME = tempHome("advance-refused-move").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const NO_OP = "NO_OP: issue already in toStatus";
const HOLDER = "this-run";
/* A status this far up with an empty lease field is a refusal of its own, short of the move. */
const LEASE = { holder: HOLDER, agent: "claude-code_2-1-258_agent", pid: String(process.pid), renewedAt: new Date().toISOString(), minutes: 30 };
/* At the judging place, as core holds it, so the move up the ladder is the one to awaiting_release. */
const JUDGED = { status: "in_progress", workState: { step: "release" } };
const PARKED = {
  documentId: "parked-uuid",
  issueId: "ISS-99",
  ...JUDGED,
  title: "the issue every route up the ladder refused",
  description: "no mark here",
  releaseNotes: { section: "Skip", userFacing: "-" },
  sessionContext: { lease: LEASE },
};
/* The place above asks for a verification naming the deployment (ISS-1480), which is no part of what
   any case below refuses on, so it is on the page before the tracker's own answer is ever consulted. */
const VERIFIED = [{ createdAt: "2026-09-04T10:00:00.000Z", authorId: "agent",
  body: render("verification",
    { where: "the installed plugin", commit: "43b811e", evidence: ["https://app.example/build/9"] }) }];
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true } },
  issues: [PARKED],
  comments: { "parked-uuid": VERIFIED },
  answer: {},
};
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: [PARKED], returned: 1, hasMore: false };
  if (args.action === "get") return PARKED;
  if (args.action === "transition") {
    if (state.refuses) return { refused: state.refuses, ...(state.code ? { code: state.code } : {}) };
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
  Object.assign(PARKED, JUDGED);
  const run = await advance();
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr,
    /ISS-99 on project \S+ \(from [^)]*config\.json\) is in_progress:release and the move to awaiting_release was refused, so nothing was written\./u,
    "with the project the key was resolved in and where that came from (ISS-2910)");
  /* The envelope is the transport's: the framing adds nothing inside the words and leaves them last. */
  const under = run.stderr.split("What refused it:\n")[1] ?? "";
  assert.ok(under.trimEnd().endsWith(NO_OP), `the refusal goes under that line whole: ${run.stderr}`);
});

/* Core closes from awaiting_release only on its own release path, and its answer to a run's own set
   there is about the status alone (ISS-1992). `forge advance` offers no close, so a set is the one
   route that asks for one. */
const CLOSE_ONLY = "CLOSE_ONLY_BY_RELEASE: an issue that ships code closes only through the release that claimed it";
test("a refused close from awaiting_release names the release record as the route, above the tracker's own words", async () => {
  state.refuses = CLOSE_ONLY;
  Object.assign(PARKED, { status: "awaiting_release", workState: null });
  const run = await advance("--set", "closed", "--why", "it shipped");
  assert.equal(run.status, 1, run.stdout);
  const [above, under = ""] = run.stderr.split("What refused it:\n");
  assert.match(above, /forge release-batch record ISS-99 --commit <sha> --account "<how it was released>"/u, run.stderr);
  assert.match(above, /`forge release-batch readiness`/u, run.stderr);
  assert.ok(under.trimEnd().endsWith(CLOSE_ONLY), `the tracker's words stay last: ${run.stderr}`);
});

test("a move the tracker takes prints the pair it moved between and nothing about a refusal", async () => {
  state.refuses = null;
  Object.assign(PARKED, JUDGED);
  const run = await advance();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /ISS-99 {2}in_progress:release -> awaiting_release/u, run.stdout);
  assert.doesNotMatch(run.stdout, /was refused/u, "and nothing of the refused path reaches a move that landed");
});

/* A project that enables `awaiting_release` and names no `closed` moves exactly as one that names
   neither — the control that killed four filings' reading — so nothing reads that key to decide what
   the next status is owed (ISS-1422). */
test("--owed answers the same whatever pipelineConfig.states holds", async () => {
  state.refuses = null;
  Object.assign(PARKED, JUDGED);
  const bare = await advance("--owed");
  state.config.pipelineConfig = {
    autoProdDeploy: true,
    states: { open: { enabled: true, mode: "auto" }, needs_info: { enabled: true }, awaiting_release: { enabled: true } },
  };
  const configured = await advance("--owed");
  assert.equal(configured.stdout, bare.stdout, configured.stdout);
  assert.match(bare.stdout, /awaiting_release is next/u, bare.stdout);
});

test("a move that neither landed nor failed claims nothing about the status and sends the run to read it", async () => {
  state.refuses = `Forge did not answer POST /api/issues/parked-uuid/transition: socket hang up\n${AMBIGUOUS}`;
  Object.assign(PARKED, JUDGED);
  const run = await advance();
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /neither landed nor failed cleanly/u, run.stderr);
  assert.match(run.stderr, /forge issue ISS-99 --fields status/u, "the read that settles it comes first");
  assert.doesNotMatch(run.stderr, /nothing was written/u, "and nothing asserts a move the transport could not see");
});

/* The tracker's work-evidence refusal names fields and never a verb, so the line the verb prints ends
   on the capture that meets it, and the move stays refused with nothing written (ISS-2775). */
test("a move refused for want of work evidence ends on the capture of the issue it was sent for", async () => {
  state.refuses = "no branch, commit or code handoff is recorded for this issue";
  state.code = "NO_WORK_EVIDENCE";
  Object.assign(PARKED, JUDGED);
  const before = state.calls.length;
  try {
    const run = await advance();
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /the move to awaiting_release was refused, so nothing was written\./u, run.stderr);
    const under = run.stderr.split("What refused it:\n")[1] ?? "";
    assert.match(under, /^NO_WORK_EVIDENCE: no branch, commit or code handoff is recorded for this issue\n/u, under);
    assert.match(under, /`forge claim parked-uuid --pushed`/u, under);
    assert.equal(PARKED.status, "in_progress", "the status the refusal left is the one it found");
    const wrote = state.calls.slice(before).filter((one) => one.method === "POST" && /comment/u.test(`${one.name} ${one.path}`));
    assert.deepEqual(wrote, [], "and no comment went up behind the refused move");
  } finally {
    state.code = null;
  }
});
