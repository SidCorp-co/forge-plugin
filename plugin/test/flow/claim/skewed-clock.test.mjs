/* What a claim says and refuses once the expiry is decided in the tracker's frame rather than in
   this device's (ISS-1212). The tracker here answers from the same machine, so the frame it hands
   back is worth about half a second; a lease's own recorded error is what the cases vary, since it
   is the writer's half of the band and the half the reader cannot measure. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, standsInNoTree, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("skewed-clock").path;
standsInNoTree("skewed-clock");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "skewed-uuid";
const OURS = "the-reclaiming-run";
const THEIRS = "the-run-that-may-be-working";
/* Twenty seconds, so the band the two errors make is wide enough that a case is not decided by how
   long the CLI took to start; a forty-second round trip is inside the deadline the transport allows. */
const WIDE = 20_000;

const ago = (millis) => new Date(Date.now() - millis).toISOString();

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1212",
  status: "in_progress",
  title: "a lease read under two clocks",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-05~1: the one outcome.",
  complexity: "s",
};

const heldBy = (holder, agoMillis, minutes, clock) => {
  ISSUE.sessionContext = {
    lease: {
      holder, agent: "a-test-agent", pid: "4242", renewedAt: ago(agoMillis), minutes, next: null, history: [],
      ...(clock === undefined ? {} : { clock }),
    },
  };
};

const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update") Object.assign(ISSUE, args.data);
      return ISSUE;
    },
    forge_comments: (args) => {
      if (args.action !== "list") return { documentId: "a-comment" };
      return { comments: state.comments[UUID] ?? [], returned: 0, hasMore: false };
    },
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const claim = (argv, who = OURS) => ranAsync(FORGE, ["claim", "ISS-1212", ...argv], { ...tracker.env, FORGE_SESSION_ID: who });
const wrote = () => state.calls
  .filter((one) => one.name === "forge_issues" && one.args.action === "update")
  .map((one) => one.args.data?.sessionContext?.lease);

test("a lease this CLI writes is stamped in the tracker's frame and carries the error that frame is known to", async () => {
  heldBy(OURS, 60_000, 60, 500);
  const run = await claim([]);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const written = wrote().at(-1);
  assert.equal(Number.isFinite(written.clock), true, "the error the stamp was taken under is on the lease");
  assert.equal(written.clock >= 500, true, "at least the second the date header is truncated to, halved");
  const drift = Math.abs(Date.parse(written.renewedAt) - Date.now());
  assert.equal(drift < 5000, true, `the stamp is the tracker's clock, and this one answers from here: ${drift}ms`);
});

test("a stamp carrying no error is said to be one this CLI cannot place, and the claim still goes as it would have", async () => {
  heldBy(THEIRS, 30 * 60_000, 60, undefined);
  const refused = await claim([]);
  assert.equal(refused.status, 1, "a live lease is still another run's");
  assert.match(refused.stderr, /stamped by a device that had not read the tracker's clock/u,
    "and the stamp it was refused on is named as that machine's time rather than this one's");
  heldBy(THEIRS, 30 * 60_000, 60, 500);
  const placed = await claim([]);
  assert.doesNotMatch(placed.stderr, /had not read the tracker's clock/u,
    "where the writer did read it, there is nothing to say");
});

test("a reclaim whose cutoff the two clocks cannot order is refused, and the flag that says the run stopped takes it", async () => {
  heldBy(THEIRS, 121_000, 1, WIDE);
  const before = state.calls.length;
  const refused = await claim([]);
  assert.equal(refused.status, 1, `the reclaim should have been refused:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /cannot order the moment the lease on ISS-1212 becomes anybody's against now/u);
  assert.match(refused.stderr, /Past \d{4}-\d\d-\d\dT\d\d:\d\d they can/u,
    "and names the instant past which they can, which is what a caller waits for");
  assert.match(refused.stderr, new RegExp(`session ${THEIRS}`, "u"), "and the run it would be taking from");
  assert.match(refused.stderr, /forge claim ISS-1212 --stopped/u);
  assert.deepEqual(state.calls.slice(before).filter((one) => one.args?.action === "update"), [],
    "and writes nothing, the field holding what the refusal read");

  heldBy(THEIRS, 121_000, 1, WIDE);
  const taken = await claim(["--stopped"]);
  assert.equal(taken.status, 0, `--stopped should have taken it:\n${taken.stdout}${taken.stderr}`);
  assert.equal(wrote().at(-1)?.history.at(-1)?.how, "reclaim");
});

test("the same reclaim goes through once the cutoff is outside the band, so the refusal is the doubt and not the lapse", async () => {
  heldBy(THEIRS, 121_000, 1, 500);
  const run = await claim([]);
  assert.equal(run.status, 0, `a cutoff a second past and a band of one is orderable:\n${run.stdout}${run.stderr}`);
  assert.doesNotMatch(run.stderr, /cannot order the moment/u);
});

test("an expiry inside the band is named whichever way the claim then goes", async () => {
  heldBy(THEIRS, 60 * 60_000 + 1000, 60, WIDE);
  const refused = await claim([]);
  assert.equal(refused.status, 1, "the lapse is fresh, so this is refused as it was before");
  assert.match(refused.stderr, /cannot order the expiry of the lease on ISS-1212 against now/u);
  assert.match(refused.stderr, /ran out .* ago/u, "the refusal it would have got anyway, unchanged");

  heldBy(THEIRS, 60 * 60_000 + 1000, 60, WIDE);
  const taken = await claim(["--stopped"]);
  assert.equal(taken.status, 0, `${taken.stdout}${taken.stderr}`);
  assert.match(taken.stderr, /cannot order the expiry of the lease on ISS-1212 against now/u,
    "and said on the claim that went through as well as on the one refused");
});

test("the instant a live-lease refusal prints as the lease becoming anybody's moves with neither error", async () => {
  const renewedAt = new Date(Date.now() - 10 * 60_000).toISOString();
  /* Renewed ten minutes ago for sixty, so it is live and anybody's a duration past its expiry:
     two hours from the renew time, rounded up to the minute, whatever either end measured. */
  const owed = new Date(Math.ceil((Date.parse(renewedAt) + 120 * 60_000) / 60_000) * 60_000)
    .toISOString().slice(0, 16);
  const minute = async (clock) => {
    ISSUE.sessionContext = {
      lease: { holder: THEIRS, agent: "a-test-agent", pid: "4242", renewedAt, minutes: 60, next: null, history: [], clock },
    };
    const run = await claim([]);
    assert.equal(run.status, 1, `a live lease is refused:\n${run.stdout}${run.stderr}`);
    return /anybody's from (\d{4}-\d\d-\d\dT\d\d:\d\d)/u.exec(run.stderr)?.[1] ?? `no such line in:\n${run.stderr}`;
  };
  assert.equal(await minute(500), owed, "the renew time and two durations, and no measurement in it");
  assert.equal(await minute(WIDE), owed, "and a writer whose error is forty times as wide prints the same minute");
});

test("a tracker whose answers carry no readable time leaves the comparison this device's own, said and not refused", async () => {
  state.noDate = true;
  heldBy(THEIRS, 121_000, 1, 500);
  const run = await claim([]);
  state.noDate = false;
  assert.equal(run.status, 0, `nothing is refused for a header nobody sent:\n${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /compared against this device's own clock/u,
    "and the claim says which clock decided it rather than presenting the answer as settled");
});

/* The end-to-end half, and the one that goes red if either production default goes back to this
   device's own clock: the tracker answers from a clock an hour behind this machine's, which is what
   a machine an hour fast meets, and every instant the CLI reads and writes has to follow it. */
const HOUR = 60 * 60_000;
const trackerAgo = (millis) => new Date(Date.now() - HOUR - millis).toISOString();

test("a device an hour out from the tracker reads a live lease as live and stamps its own writes in the tracker's clock", async () => {
  state.dateOffset = -HOUR;
  ISSUE.sessionContext = {
    lease: {
      holder: THEIRS, agent: "a-test-agent", pid: "4242", renewedAt: trackerAgo(30 * 60_000),
      minutes: 60, next: null, history: [], clock: 500,
    },
  };
  const refused = await claim([]);
  assert.equal(refused.status, 1,
    `thirty minutes into a sixty-minute lease on the tracker's clock, so it is live:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, new RegExp(`ISS-1212 is claimed: session ${THEIRS}`, "u"),
    "read on this device's own clock the lease is an hour and a half old and would be reclaimed");

  ISSUE.sessionContext = {
    lease: {
      holder: OURS, agent: "a-test-agent", pid: "4242", renewedAt: trackerAgo(60_000),
      minutes: 60, next: null, history: [], clock: 500,
    },
  };
  const renewed = await claim([]);
  state.dateOffset = 0;
  assert.equal(renewed.status, 0, `${renewed.stdout}${renewed.stderr}`);
  const written = wrote().at(-1);
  const behind = Date.now() - Date.parse(written.renewedAt);
  assert.equal(Math.abs(behind - HOUR) < 5000, true,
    `the stamp is the tracker's clock and this device is an hour off it: ${behind}ms behind local`);
});

test("a take reaching an expiry the two clocks cannot order is told so, on the route that returns before every branch below it", async () => {
  ISSUE.sessionContext = {
    lease: {
      holder: THEIRS, agent: "a-test-agent", pid: "4242", renewedAt: ago(60 * 60_000 + 1000),
      minutes: 60, next: null, history: [], clock: WIDE,
    },
    landing: { state: "ready", builder: THEIRS, branch: "b", head: "a".repeat(40), base: "b".repeat(40), files: ["one.mjs"] },
  };
  const run = await claim(["--take"]);
  assert.match(run.stderr, /cannot order the expiry of the lease on ISS-1212 against now/u,
    "the take reads the expiry to decide who may take it, so it is owed the same sentence");
  delete ISSUE.sessionContext.landing;
});

test("a run renewing its own lease within the band is told the expiry cannot be ordered, and renews anyway", async () => {
  ISSUE.sessionContext = {
    lease: {
      holder: OURS, agent: "a-test-agent", pid: "4242", renewedAt: ago(60 * 60_000 + 1000),
      minutes: 60, next: null, history: [], clock: WIDE,
    },
  };
  const run = await claim([]);
  assert.equal(run.status, 0, `a run's own lapsed lease is its own:\n${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /cannot order the expiry of the lease on ISS-1212 against now/u,
    "whichever way the claim goes, and mine against lapsed is a comparison like any other");
});
