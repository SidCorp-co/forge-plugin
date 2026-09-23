/* A wave is a record on its headline issue, so a restarted dispatcher reads the wave off the tracker
   rather than out of a conversation it no longer has. Each case below fails without its part of the
   change: the kinds, the finder's write, the refusals, and the resume's reading (ISS-818). */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempRoom } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("wave-");
const { render } = await import("../../../../src/flow/record/page.mjs");
const { waveLines, waveLive, waveOf } = await import("../../../../src/flow/record/wave.mjs");

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const MINE = "wave-test-session";

let clock = 0;
const stamp = () => `2026-09-23T03:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const posted = (kind, fields) => ({ documentId: `c-${clock}`, createdAt: stamp(), authorDeviceId: "d", body: render(kind, fields) });
const dispatch = (member, session, extra = {}) => posted("wave", { member, role: "forge:runner", session, ...extra });

const lease = (holder) => ({ lease: {
  holder, agent: "claude-code_agent", pid: "1", minutes: 60, renewedAt: new Date().toISOString(),
  history: [{ holder, at: new Date().toISOString(), how: "claim", status: "in_progress" }],
} });

/* Keyed by sequence, so the key resolution's offset read lands on the row whose number it asked for. */
const row = (n, status, extra = {}) => ({
  documentId: `uuid-${n}`, issueId: `ISS-${n}`, title: `issue ${n}`, status,
  createdAt: `2026-09-01T00:${String(n).padStart(2, "0")}:00.000Z`, ...extra,
});

const ISSUES = [
  row(1, "in_progress", { sessionContext: lease("another-run") }),
  row(2, "closed"),
  row(3, "waiting", { sessionContext: lease("run-three") }),
  row(4, "closed"),
  row(5, "dropped"),
  row(6, "open"),
  row(7, "needs_info"),
  row(8, "open"),
  row(9, "open"),
  row(10, "in_progress", { sessionContext: lease(MINE) }),
  row(11, "open"),
  row(12, "open"),
];

const two = [dispatch(["ISS-2", "ISS-3"], "run-a", { tree: "/trees/a" }), dispatch(["ISS-4"], "run-b")];
const project = {
  calls: [],
  config: { baseBranch: "master" },
  issues: ISSUES,
  comments: {
    "uuid-1": two,
    "uuid-8": [...two, posted("fold", { summary: "two runs landed" })],
    "uuid-9": [dispatch(["ISS-2"], "old"), posted("fold", { summary: "the first wave" }), dispatch(["ISS-4", "ISS-5"], "new")],
    "uuid-11": [dispatch(["ISS-2"], "only"), posted("fold", { summary: "done" })],
    "uuid-12": [dispatch(["ISS-2", "ISS-99"], "reads-one")],
  },
  answer: {
    /* The update is kept on the row, since a renewal reads its own write back. */
    forge_issues: (args) => {
      if (args.action !== "update") return undefined;
      project.calls.push(args);
      return Object.assign(ISSUES.find((one) => one.documentId === args.documentId), args.data);
    },
    forge_comments: (args) => {
      if (args.action !== "list") return undefined;
      const held = project.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: project.cut ? true : false };
    },
  },
};

const { tracker, env: BASE } = await trackerFor(project);
test.after(() => tracker.close());
const ENV = { ...BASE, FORGE_SESSION_ID: MINE };
const forge = (...argv) => ranAsync(FORGE, argv, ENV);
const leaseWrites = () => project.calls.filter((one) => one.data && "sessionContext" in one.data);
/* The read-before-write hold delivers an unread thread once and asks for the command again. */
const write = async (...argv) => {
  const first = await forge(...argv);
  return first.status === 0 ? first : forge(...argv);
};

test("a wave record posts and reads back every member, the role, the tree and the session", async () => {
  const run = await write("record", "wave", "ISS-6", "--member", "ISS-2", "--member", "ISS-3",
    "--role", "forge:runner", "--tree", "/trees/six", "--session", "iss-2-abc");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^member: ISS-2\nmember: ISS-3$/mu);
  assert.match(run.stdout, /^role: forge:runner$/mu);
  assert.match(run.stdout, /^tree: \/trees\/six$/mu);
  assert.match(run.stdout, /^session: iss-2-abc$/mu);
  assert.match(run.stdout, /forge-record: wave · contract \d+/u);
});

test("a wave record with no tree posts and reads back with none", async () => {
  const run = await write("record", "wave", "ISS-6", "--member", "ISS-4", "--role", "forge:qa", "--session", "judge-1");
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /^tree:/mu, "a judging run is given no tree, and the record says none");
});

test("a wave with no member, or a member that is no issue key, is refused by --member before any call", async () => {
  const before = tracker.calls?.length ?? 0;
  const none = await forge("record", "wave", "ISS-6", "--role", "r", "--session", "s");
  assert.equal(none.status, 1);
  assert.match(none.stderr, /record wave needs --member\./u);
  const prose = await forge("record", "wave", "ISS-6", "--member", "the parser issue", "--role", "r", "--session", "s");
  assert.equal(prose.status, 1);
  assert.match(prose.stderr, /--member takes an issue key/u);
  const twice = await forge("record", "wave", "ISS-6", "--member", "ISS-2", "--member", "ISS-2", "--role", "r", "--session", "s");
  assert.match(twice.stderr, /each --member once/u, "and one dispatch carries an issue once");
  assert.equal(tracker.calls?.length ?? 0, before, "nothing was asked of the tracker");
});

test("UC-03-2: a wave or a fold on a headline another session holds is posted and writes no lease", async () => {
  project.calls.length = 0;
  const run = await write("record", "wave", "ISS-1", "--member", "ISS-2", "--role", "forge:runner", "--session", "s-1");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /No lease on ISS-1 is yours, so this post is a finder's and renewed none\./u);
  const fold = await write("record", "fold", "ISS-1", "--summary", "folded while a run held it");
  assert.equal(fold.status, 0, fold.stderr);
  assert.deepEqual(leaseWrites(), [], "the other session's lease is not touched");
});

test("a wave on a headline holding no lease leaves it holding none", async () => {
  project.calls.length = 0;
  const run = await write("record", "wave", "ISS-6", "--member", "ISS-2", "--role", "forge:runner", "--session", "s-2");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(leaseWrites(), [], "a free headline is not leased by the dispatcher");
  assert.equal(ISSUES[5].sessionContext, undefined);
});

test("a wave on a headline the writer holds renews that lease", async () => {
  project.calls.length = 0;
  const run = await write("record", "wave", "ISS-10", "--member", "ISS-2", "--role", "forge:runner", "--session", "s-3");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /The lease on ISS-10 is yours and this post renewed it\./u);
  assert.equal(leaseWrites().length, 1, "one renewal of the writer's own lease");
  assert.equal(leaseWrites()[0].data.sessionContext.lease.holder, MINE);
});

test("--also and every run flag beside a wave or a fold are refused before any call", async () => {
  for (const argv of [
    ["record", "wave", "ISS-6", "--member", "ISS-2", "--role", "r", "--session", "s", "--next", "the fold"],
    ["record", "wave", "ISS-6", "--member", "ISS-2", "--role", "r", "--session", "s", "--open", "a line"],
    ["record", "wave", "ISS-6", "--member", "ISS-2", "--role", "r", "--session", "s", "--pushed"],
    ["record", "fold", "ISS-1", "--summary", "s", "--review"],
    ["record", "fold", "ISS-1", "--summary", "s", "--also", "gap", "--none", "met none"],
    ["record", "gap", "ISS-1", "--none", "met none", "--also", "wave", "--member", "ISS-2", "--role", "r", "--session", "s"],
  ]) {
    const run = await forge(...argv);
    assert.equal(run.status, 1, argv.join(" "));
    assert.match(run.stderr, /is written alone and takes no lease/u, argv.join(" "));
  }
});

test("a wave or a fold on a headline a comment would answer is refused before anything is posted", async () => {
  for (const [ref, kind, rest] of [
    ["ISS-3", "wave", ["--member", "ISS-2", "--role", "r", "--session", "s"]],
    ["ISS-7", "fold", ["--summary", "s"]],
  ]) {
    const run = await forge("record", kind, ref, ...rest);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /reads a comment as the reply to its park and reopens the issue/u);
    assert.match(run.stderr, /Nothing was sent\./u);
  }
});

test("a fold closing no dispatch is refused, and a cut page says it is cut", async () => {
  const empty = await forge("record", "fold", "ISS-11", "--summary", "a second fold");
  assert.equal(empty.status, 1, empty.stdout);
  assert.match(empty.stderr, /holds no wave record after its latest fold, so this fold would close nothing\. Nothing was sent\./u);
  project.cut = true;
  const cut = await forge("record", "fold", "ISS-11", "--summary", "a second fold");
  project.cut = false;
  assert.equal(cut.status, 1, cut.stdout);
  assert.match(cut.stderr, /page is cut, and no dispatch after a fold is on the part that was read/u);
});

test("resume prints every member of an open wave live, which dispatch is complete, the runs and the fold owed", async () => {
  const run = await forge("resume", "ISS-1");
  assert.equal(run.status, 0, run.stderr);
  const lines = run.stdout.split("\n");
  const at = lines.indexOf("Wave");
  assert.ok(at > 0 && at < lines.findIndex((one) => one.startsWith("Lane")), "under the header, ahead of the lane");
  assert.match(run.stdout, /open: 2 dispatch\(es\), 2 run\(s\), 3 member issue\(s\)/u, "a run per dispatch, not per member");
  assert.match(run.stdout, /dispatch 1, \S+: forge:runner, session run-a, tree \/trees\/a/u);
  assert.match(run.stdout, /^ {4}ISS-2 {2}closed {2}no lease$/mu);
  assert.match(run.stdout, /^ {4}ISS-3 {2}waiting {2}leased by run-three, \w+$/mu);
  assert.match(run.stdout, /^ {4}not complete: ISS-3 still owed$/mu, "a parked member keeps its dispatch open");
  assert.match(run.stdout, /^ {4}complete: every member is at closed or dropped$/mu, "the dispatch of ISS-4 alone is done");
  assert.match(run.stdout, /the fold is owed/u, "every member closed or not, the fold is still owed");
  assert.match(run.stdout, /forge record fold ISS-1 --summary "<the fold's line>"/u);
});

test("the resume's json carries the open wave with each member's live status", async () => {
  const run = await forge("resume", "ISS-1", "--json");
  assert.equal(run.status, 0, run.stderr);
  const { wave } = JSON.parse(run.stdout);
  assert.equal(wave.state, "open");
  assert.equal(wave.runs, 2);
  assert.deepEqual(wave.dispatches.map((one) => one.members.map((two) => `${two.key}=${two.status}`)),
    [["ISS-2=closed", "ISS-3=waiting"], ["ISS-4=closed"]]);
  assert.deepEqual(wave.dispatches.map((one) => one.complete), [false, true]);
});

test("a wave whose latest record is a fold prints the fold and its runs and no member", async () => {
  const run = await forge("resume", "ISS-8");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}folded [^,]+, closing 2 run\(s\): two runs landed$/mu);
  assert.doesNotMatch(run.stdout, /^ {4}ISS-\d+ /mu, "no member line");
  assert.doesNotMatch(run.stdout, /the fold is owed/u);
});

test("a dispatch after a fold opens a wave without the dispatches before it", async () => {
  const run = await forge("resume", "ISS-9");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /open: 1 dispatch\(es\), 1 run\(s\), 2 member issue\(s\)/u);
  assert.match(run.stdout, /session new/u);
  assert.doesNotMatch(run.stdout, /session old/u, "the folded wave's dispatch is no member of this one");
  assert.match(run.stdout, /^ {4}ISS-5 {2}dropped {2}no lease$/mu);
});

test("an issue with no wave record prints no wave block and its json carries no wave key", async () => {
  const run = await forge("resume", "ISS-6");
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /^Wave$/mu, "a headline no wave was written on prints no block");
  const empty = await forge("resume", "ISS-2");
  assert.doesNotMatch(empty.stdout, /^Wave$/mu, "an issue holding neither kind prints no block");
  const json = await forge("resume", "ISS-2", "--json");
  assert.equal(Object.hasOwn(JSON.parse(json.stdout), "wave"), false, "and carries no key");
});

test("a member the tracker will not answer for is printed with its words in place of a status", async () => {
  const run = await forge("resume", "ISS-12");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {4}ISS-99 {2}unreadable: .+$/mu);
  assert.match(run.stdout, /not complete: ISS-99 still owed/u, "and an unread member is not a finished one");
});

test("the report prints every wave and fold record, oldest first", async () => {
  const run = await forge("resume", "ISS-9", "--report");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /2 Wave dispatch records, oldest first\nWave dispatch[^\n]+\n {2}Member: ISS-2\n[\s\S]*Session granted: old[\s\S]*Session granted: new/u);
  assert.match(run.stdout, /^Wave fold {2}\([^)]+\)\n {2}Summary: the first wave$/mu);
});

test("the reading is the page's, in time order, whatever order the page came in", async () => {
  const page = [...project.comments["uuid-9"]].reverse();
  const wave = waveOf(page);
  assert.equal(wave.state, "open");
  assert.deepEqual(wave.dispatches.map((one) => one.session), ["new"]);
  assert.equal(waveOf([]), null, "a page holding neither kind has no wave");
  const live = await waveLive(wave, async (key) => ({ body: { status: key === "ISS-4" ? "closed" : "developed" } }));
  assert.equal(live.dispatches[0].complete, false, "developed is not an end");
  assert.ok(waveLines(live, "ISS-9").some((one) => /ISS-5 {2}developed {2}no lease/u.test(one)));
});
