/* What a project's `qa` line changes is what `forge advance` does, and only the verb reads that
   policy off the tracker, so this half stands on a tracker fixture where the reading half stands on
   objects. Two sessions write on one issue, each under its own lease, and the judge on each verdict
   is the one the CLI resolved rather than one a fixture supplied (ISS-673). */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-independent-verb").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const BUILDER = "the-builder-session";
const QA = "the-qa-session";
const LANDER = "the-lander-session";
const MERGED = "c8c35500000000000000000000000000000000ab";
const DEPLOYED = "9e24c2af00000000000000000000000000000cde";
const AT = "2026-09-07T12:00:00.000Z";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const PLAN = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.";
const CHECKPOINT = {
  state: "judged",
  builder: BUILDER,
  branch: "iss-673-8",
  head: MERGED,
  base: "6e4ecb10000000000000000000000000000000ff",
  candidate: DEPLOYED,
  deployment: DEPLOYED,
  files: ["plugin/src/flow/earned.mjs"],
  at: AT,
};

/* One clock for the whole file, so a record written later reads later: the tracker fixture stores
   what it is handed and the flow reads these stamps in order. */
let clock = 0;
const at = () => `2026-09-07T13:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const judging = {
  documentId: "judging-uuid",
  issueId: "ISS-8",
  status: "developed",
  title: "the change two sessions judged",
  description: "no mark here",
  plan: PLAN,
  acceptanceCriteria: CRITERIA,
  mergedAt: AT,
  attachments: [],
  sessionContext: { landing: CHECKPOINT },
};
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true, qa: "independent" } },
  issues: [judging],
  comments: { "judging-uuid": [] },
  answer: {},
};
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "get") return judging;
  if (args.action === "update" || args.action === "transition") return Object.assign(judging, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
state.answer.forge_comments = (args) => {
  if (args.action === "list") {
    const held = state.comments[args.filters?.issue] ?? [];
    return { comments: held, returned: held.length, hasMore: false };
  }
  const held = (state.comments[args.data?.issue] ??= []);
  const id = `comment-${held.length}`;
  held.push({ documentId: id, createdAt: at(), body: args.data?.body });
  return { documentId: id };
};
const { tracker, env: ENV } = await trackerFor(state);
after(() => tracker.close());

const asks = (holder) => (...argv) => ranAsync(FORGE, argv, { ...ENV, FORGE_SESSION_ID: holder });
const builder = asks(BUILDER);
const qa = asks(QA);
/* A write's first send is held to deliver the comments the session has not read, and the same
   command sent again lands: what a test asserts is the second, the hold being another rule's. */
const twice = async (who, ...argv) => {
  const first = await who(...argv);
  return first.status === 0 ? first : who(...argv);
};

/* The lease is the only thing between two sessions here: a lapsed one is the next run's to reclaim,
   which is what the handoff at `qa-owed` does once a session can prove it is the QA run. */
const lapse = () => {
  judging.sessionContext.lease.renewedAt = "2026-09-07T09:00:00.000Z";
};

state.comments["judging-uuid"].push({
  documentId: "the-mark",
  createdAt: at(),
  body: `mark_merged target=base — merged to master at ${MERGED}`,
});
before(async () => {
  await builder("claim", "ISS-8", "--unheld");
  const claimed = await builder("claim", "ISS-8", "--unheld");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
});

test("advance to the rung is refused while the standing verdicts are the builder's own", async () => {
  const wrote = await builder("record", "verdict", "ISS-8", "--commit", MERGED, "--evidence", DEPLOYED,
    "--verdict", "pass", "--criterion", "1", "--criterion", "2");
  assert.equal(wrote.status, 0, wrote.stderr);
  const run = await builder("advance", "ISS-8");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(judging.status, "developed", "and nothing moved");
  const said = `${run.stdout}\n${run.stderr}`;
  assert.match(said, /criteria 1, 2 carries the builder's own id/u, said);
  assert.doesNotMatch(said, /criterion 2 carries the builder's own id/u,
    "one line names both, rather than one line for each burying the fact to act on");
  assert.match(said, /forge record verdict ISS-8 --commit \S+ --evidence 9e24c2a --verdict <pass\|fail\|skipped\|short> --criterion 1 --criterion 2$/mu,
    "and the item carries the write that answers it, citing the identity to judge against");
});

test("once the QA session has judged every criterion against the deployment, advance earns the rung", async () => {
  lapse();
  /* The builder's own verdicts are comments this QA session has not been shown, so its first write
     is held to deliver them and the second is the one that takes the lapsed lease. */
  const held = await qa("claim", "ISS-8");
  assert.match(held.stderr, /has not been shown/u, "the page the builder judged is what the QA run reads first");
  const taken = await qa("claim", "ISS-8");
  assert.equal(taken.status, 0, taken.stderr);
  const wrote = await qa("record", "verdict", "ISS-8", "--commit", MERGED, "--evidence", DEPLOYED,
    "--verdict", "pass", "--criterion", "1", "--criterion", "2");
  assert.equal(wrote.status, 0, wrote.stderr);
  assert.equal(wrote.stdout.match(new RegExp(`^judge: ${QA}$`, "gmu")).length, 2, wrote.stdout);
  assert.match(wrote.stderr, /^ISS-8 {2}developed -> testing$/mu, "the verdicts earn the judging rung in their own call");
  /* One rung, two records: the judging leaves the release rung owed, and this session writes both of the records that rung cites in one call, so that call is what moves it (ISS-1103). */
  const proved = await qa("record", "verification", "ISS-8", "--where", "the deployed app",
    "--commit", MERGED, "--evidence", "https://ci.example.test/9",
    "--also", "note", "--section", "Fixed", "--user", "it works");
  assert.equal(proved.status, 0, proved.stderr);
  assert.match(proved.stderr, /^ISS-8 {2}testing -> awaiting_release$/mu, "both records, one call, one move");
  const run = await qa("advance", "ISS-8");
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(judging.status, "closed", "every rung moved on the call that earned it, and the close is what is left");
});

/* The third move of the handoff these criteria name — builder readies, lander takes, QA takes,
   lander takes back — which no session could make while the QA turn was refused to everybody. The
   two cases above reach the judge's lease by letting the lander's lapse; this one takes it. */
test("at qa-owed the judging run takes a live lander lease, and the builder is refused its own work", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "qa-owed" };
  judging.sessionContext.lease = { ...judging.sessionContext.lease, holder: LANDER, renewedAt: at() };
  const first = await qa("claim", "ISS-8", "--take");
  const taken = first.status === 0 ? first : await qa("claim", "ISS-8", "--take");
  assert.equal(taken.status, 0, `${taken.stdout}\n${taken.stderr}`);
  assert.equal(judging.sessionContext.lease.holder, QA,
    "the turn the state hands the judge is taken while the lander's lease is still live");
  const refused = await builder("claim", "ISS-8", "--take");
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(`${refused.stdout}\n${refused.stderr}`, /no run may judge its own work/u,
    "and the one session qa-owed cannot mean is the one that built the change");
});

/* The fourth move, and the one the state had no writer for: `qa-owed` was where a landing went to
   die, its only successor unreachable and the taker at it holding no command to discharge the turn.
   The state written, the judge named, and the lander's way back in are one reading. */
test("the judging run hands the turn back, and the lander takes the lease it left live", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "qa-owed" };
  judging.sessionContext.lease = { ...judging.sessionContext.lease, holder: QA, renewedAt: at() };
  const back = await twice(qa, "claim", "ISS-8", "--judged");
  assert.equal(back.status, 0, `${back.stdout}\n${back.stderr}`);
  assert.equal(judging.sessionContext.landing.state, "judged", back.stdout);
  assert.equal(judging.sessionContext.landing.judge, QA, "the checkpoint names who judged it");
  assert.match(back.stdout, /landing `judged`/u, back.stdout);
  const lander = asks(LANDER);
  const took = await twice(lander, "claim", "ISS-8", "--take");
  assert.equal(took.status, 0, `${took.stdout}\n${took.stderr}`);
  assert.equal(judging.sessionContext.lease.holder, LANDER,
    "the judge's own live lease is taken back from, as the builder's is at the handoff before it");
  const again = await qa("claim", "ISS-8", "--judged");
  assert.equal(again.status, 1, again.stdout);
  assert.match(`${again.stdout}\n${again.stderr}`, /reads `judged`/u,
    "and the hand-back is refused a second time, naming the state it read");
});

/* The other half of the round ISS-1260 removed: a payload write takes a field holding no lease where a bare claim would have been granted, and this write never can, every landing state being past the statuses a run is dispatched at. So what it owes is the claim that does clear the state, and not the one refused there in turn (ISS-1252). */
test("the hand-back on a field holding no lease names the claim that clears that state", async () => {
  const was = judging.status;
  judging.status = "testing";
  judging.sessionContext.landing = { ...CHECKPOINT, state: "qa-owed" };
  delete judging.sessionContext.lease;
  try {
    const refused = await twice(qa, "claim", "ISS-8", "--judged");
    assert.equal(refused.status, 1, refused.stdout);
    assert.match(`${refused.stdout}\n${refused.stderr}`, /forge claim ISS-8 --unheld/u,
      "and not the bare claim, which is itself refused at a status past the dispatch ones");
    assert.equal(judging.sessionContext.landing.state, "qa-owed", "with the turn still owed to a judge");
  } finally {
    judging.status = was;
  }
});

/* The independence `--take` refuses one move earlier, asked again of the move that writes the
   judgement down: reaching `--judged` needs no take, so a builder holding its own lease signed
   itself onto the checkpoint as judge, and before-merge reads that state alone to push (ISS-673). */
test("the builder is refused the hand-back, on the reading the take before it is refused on", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "qa-owed" };
  judging.sessionContext.lease = {
    ...judging.sessionContext.lease, holder: BUILDER, renewedAt: new Date().toISOString(),
  };
  const refused = await twice(builder, "claim", "ISS-8", "--judged");
  assert.equal(refused.status, 1, `${refused.stdout}\n${refused.stderr}`);
  assert.match(`${refused.stdout}\n${refused.stderr}`, /no run may judge its own work/u,
    "the same sentence the take is refused with, because it is the same rule read once");
  assert.equal(judging.sessionContext.landing.state, "qa-owed", "and the turn is still owed to a judge");
  assert.ok(!judging.sessionContext.landing.judge, "with nobody named as having taken it");
});

/* The hole the take-back cuts in the live-lease guard, closed by the take that used it: a lander
   inheriting the judge's id, or the judge landing under its own lease, would otherwise be takeable
   by any third run for the rest of the landing. */
test("the take at judged spends the judge's name, so the lease the taker holds is nobody else's", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "qa-owed" };
  judging.sessionContext.lease = { ...judging.sessionContext.lease, holder: QA, renewedAt: at() };
  assert.equal((await twice(qa, "claim", "ISS-8", "--judged")).status, 0);
  assert.equal(judging.sessionContext.landing.judge, QA);
  const lander = asks(LANDER);
  assert.equal((await twice(lander, "claim", "ISS-8", "--take")).status, 0);
  assert.equal(judging.sessionContext.landing.judge, "",
    "the name licensed one hand-back, and the take that used it blanked the field `landingOf` drops");
  /* Real time and not the fixture's clock: the CLI reads liveness against `Date.now()`, and a stamp
     from the counter above is already lapsed there — which is any run's, proving nothing. */
  judging.sessionContext.lease = {
    ...judging.sessionContext.lease, holder: QA, renewedAt: new Date().toISOString(),
  };
  const asking = asks("a-third-lander");
  await asking("claim", "ISS-8", "--take");
  const third = await asking("claim", "ISS-8", "--take");
  assert.equal(third.status, 1, third.stdout);
  assert.match(`${third.stdout}\n${third.stderr}`, /is already on it/u,
    "so a judge that went on to land holds a lander's live lease, which no third run may take");
});

/* The same hole, entered by the judge itself: J hands back and then lands its own change, which the
   state permits because J is not the builder. Its take is licensed by the lease it already holds, so
   the marker has to go there too — left set, the lander lease J now holds would be any run's. */
test("the judge that lands its own hand-back spends the marker too, before any state moves", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "qa-owed" };
  judging.sessionContext.lease = { ...judging.sessionContext.lease, holder: QA, renewedAt: at() };
  assert.equal((await twice(qa, "claim", "ISS-8", "--judged")).status, 0);
  judging.sessionContext.lease = {
    ...judging.sessionContext.lease, holder: QA, renewedAt: new Date().toISOString(),
  };
  assert.equal((await twice(qa, "claim", "ISS-8", "--take")).status, 0, "the judge takes the lander's turn");
  assert.equal(judging.sessionContext.landing.judge, "",
    "and its own take spent the marker, the lease it holds now being an ordinary lander's");
  assert.equal(judging.sessionContext.landing.state, "judged", "with no state moved yet");
  const third = asks("a-fourth-lander");
  await third("claim", "ISS-8", "--take");
  const refused = await third("claim", "ISS-8", "--take");
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(`${refused.stdout}\n${refused.stderr}`, /is already on it/u,
    "so the interval between the judge's take and the next transition is not a window either");
});

test("the hand-back is refused where no QA turn is owed, and refused beside a turn's own flag", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "reconciled" };
  const early = await qa("claim", "ISS-8", "--judged");
  assert.equal(early.status, 1, early.stdout);
  assert.match(`${early.stdout}\n${early.stderr}`, /reads `reconciled`/u, early.stdout);
  const both = await qa("claim", "ISS-8", "--judged", "--take");
  assert.equal(both.status, 1, both.stdout);
  assert.match(`${both.stdout}\n${both.stderr}`, /--take and --judged/u,
    "each flag is a different turn's move, so two of them name no turn at all");
});
