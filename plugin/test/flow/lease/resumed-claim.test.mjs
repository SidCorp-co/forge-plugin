/* A resume is dispatched past the statuses a run is first dispatched at, so the dispatcher's lease is
   handed there too wherever the record proves the holder is the session that sent this run: written
   from the claiming call's own host process on its own host, under an id that names no run
   (ISS-2205). Every other holder past those statuses is still a run at work. */
import assert from "node:assert/strict";
import test from "node:test";

import { escaped, projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("resumed-claim").path;
/* Away from this checkout, whose git directory names the run this suite is written under. */
const AWAY = projectRoom(tempRoom("resumed-claim-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);

const { placeOf } = await import("../../../src/flow/lease/holder.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "6d1e2f30-4a5b-4c6d-8e7f-000000002205";
const RUNNER = "iss-2205-07a3ca98";
const DISPATCHER = "aed0f3e5-5271-4817-9bf5-21f7a24efb0f";
const HOST = "51515";
const ELSEWHERE = "61616";
const LEFT = "dispatched to a run, which resumes it";

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-2205",
  status: "in_progress",
  title: "a run dispatched to resume an issue takes its dispatcher's lease",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-05~1: the one outcome.",
  complexity: "s",
};

const heldBy = (holder, { status = "in_progress", pid = HOST, place = placeOf(), landing = null } = {}) => {
  ISSUE.status = status;
  ISSUE.sessionContext = {
    lease: { holder, agent: "a-test-agent", pid, place, renewedAt: new Date().toISOString(), minutes: 60, next: LEFT, history: [] },
    ...(landing ? { landing } : {}),
  };
};

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
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

const { tracker, env: ENV } = await trackerFor(state, [AWAY]);
test.after(() => tracker.close());

/* Every call runs under the host process `HOST`, which is what an agent of the dispatching session carries. */
const claim = (who = RUNNER) => ranAsync(FORGE, ["claim", "ISS-2205"],
  { ...ENV, FORGE_SESSION_ID: who, CLAUDE_PID: HOST, CLAUDE_CODE_SESSION_ID: "" }, AWAY);
const wrote = () => state.calls
  .filter((one) => one.name === "forge_issues" && one.args.action === "update")
  .map((one) => one.args.data?.sessionContext?.lease);
const updates = () => wrote().length;

test("a run resumed at in_progress takes the lease its dispatcher holds from the same host process", async () => {
  heldBy(DISPATCHER);
  const took = await claim();
  assert.equal(took.status, 0, `the dispatcher is only holding it:\n${took.stdout}${took.stderr}`);
  assert.match(took.stdout, new RegExp(`ISS-2205 {2}handed: session ${escaped(RUNNER)}`, "u"));
  assert.match(took.stdout, /was live and session aed0f3e5/u, "saying what it took and from whom");
  assert.equal(wrote().at(-1)?.holder, RUNNER);
  assert.equal(wrote().at(-1)?.history.at(-1)?.how, "handed", "a handoff, and no dead run's reclaim");
});

test("the same take is made at developed and at draft", async () => {
  for (const status of ["developed", "draft"]) {
    heldBy(DISPATCHER, { status });
    const took = await claim();
    assert.equal(took.status, 0, `${status}:\n${took.stdout}${took.stderr}`);
    assert.match(took.stdout, /ISS-2205 {2}handed: session /u, status);
    assert.equal(wrote().at(-1)?.history.at(-1)?.how, "handed", status);
  }
});

test("a holder in another host process, or on another host, is a run at work, and the refusal says which", async () => {
  heldBy(DISPATCHER, { pid: ELSEWHERE });
  const before = updates();
  const other = await claim();
  assert.equal(other.status, 1, `another process proves no dispatch:\n${other.stdout}${other.stderr}`);
  assert.match(other.stderr, /past the statuses a run is dispatched at/u);
  assert.match(other.stderr, new RegExp(`the lease records pid ${ELSEWHERE} and this call runs under pid ${HOST}`, "u"));
  assert.match(other.stderr, /\n {2}forge claim ISS-2205 --give-back\n/u, "the holder's route, as a command");
  assert.doesNotMatch(other.stderr, /forge brief|tree cut for that run|Unset that variable/u,
    "no route through this call's id, which cannot take this lease");

  heldBy(DISPATCHER, { place: "another-boot pid:[1]" });
  const away = await claim();
  assert.equal(away.status, 1, `the same pid on another host is another process:\n${away.stdout}${away.stderr}`);
  assert.match(away.stderr, new RegExp(`the lease records pid ${HOST} on another host than this call's`, "u"));
  assert.equal(updates(), before, "and nothing was taken");
});

test("inside one host process a holder that is a run, of this issue or of another, is still at work", async () => {
  for (const [holder, said] of [["iss-2205-cccccccc", "ISS-2205"], ["iss-1084-deadbeef", "ISS-1084"]]) {
    heldBy(holder);
    const refused = await claim();
    assert.equal(refused.status, 1, `${holder} is a run:\n${refused.stdout}${refused.stderr}`);
    assert.match(refused.stderr, new RegExp(`its holder ${escaped(holder)} is the run dispatched to ${said}`, "u"));
  }
});

test("inside one host process a landing checkpoint naming a turn still governs", async () => {
  heldBy(DISPATCHER, { landing: { state: "candidate", builder: RUNNER, branch: "iss-2205", head: "a".repeat(40), base: "b".repeat(40), files: ["one.mjs"], at: new Date().toISOString() } });
  const refused = await claim();
  assert.equal(refused.status, 1, `the checkpoint governs here:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /names the lander's turn/u);
});

test("an id that is the only fault is sent to the tree at in_progress and to the verdict at the judging rungs", async () => {
  heldBy(DISPATCHER);
  const resumed = await claim("a-whole-wave-of-runs");
  assert.equal(resumed.status, 1, `${resumed.stdout}${resumed.stderr}`);
  assert.match(resumed.stderr, /which names no issue at all/u);
  assert.match(resumed.stderr, /`forge brief ISS-2205 --tree /u, "the route that now takes this lease");

  for (const status of ["developed", "testing"]) {
    heldBy(DISPATCHER, { status });
    const judged = await claim("a-whole-wave-of-runs");
    assert.equal(judged.status, 1, `${status}: ${judged.stdout}${judged.stderr}`);
    assert.match(judged.stderr, /Where this call is/u, status);
    assert.doesNotMatch(judged.stderr, /forge brief|tree cut for that run|Unset that variable/u, status);
  }
});

/* A flag the live-lease refusal did not read is named at its head, and the refusal is otherwise the unflagged one (ISS-2533). */
const flagged = (flags) => ranAsync(FORGE, ["claim", "ISS-2205", ...flags],
  { ...ENV, FORGE_SESSION_ID: RUNNER, CLAUDE_PID: HOST, CLAUDE_CODE_SESSION_ID: "" }, AWAY);
const STOPPED_SAID = /--stopped settles a holder this call can look for, and [^\n]*?, so the flag was read and settles nothing here\. /u;
const UNHELD_SAID = /--unheld takes only an issue whose lease field holds no lease, and this one holds one, so the flag was read and settles nothing here\. /u;

test("a live lease refusal names the --stopped and --unheld it did not read, and is otherwise the unflagged refusal", async () => {
  /* A holder in a process still running on this host, which is not this call's: a run at work. */
  heldBy(DISPATCHER, { status: "developed", pid: String(process.pid) });
  const before = updates();
  const bare = await flagged([]);
  assert.equal(bare.status, 1, `${bare.stdout}${bare.stderr}`);
  assert.doesNotMatch(bare.stderr, /--unheld|settles nothing here/u, "the unflagged refusal names neither");

  const stopped = await flagged(["--stopped"]);
  assert.equal(stopped.status, 1, `${stopped.stdout}${stopped.stderr}`);
  assert.match(stopped.stderr, STOPPED_SAID);
  assert.match(stopped.stderr, new RegExp(`pid ${process.pid}, which the lease records as its holder's, is still running on this host`, "u"));
  assert.doesNotMatch(stopped.stderr, UNHELD_SAID);
  assert.equal(stopped.stderr.replace(STOPPED_SAID, ""), bare.stderr, "and the rest is the bare refusal");

  const unheld = await flagged(["--unheld"]);
  assert.equal(unheld.status, 1, `${unheld.stdout}${unheld.stderr}`);
  assert.match(unheld.stderr, UNHELD_SAID);
  assert.doesNotMatch(unheld.stderr, STOPPED_SAID);
  assert.equal(unheld.stderr.replace(UNHELD_SAID, ""), bare.stderr);

  const both = await flagged(["--stopped", "--unheld"]);
  assert.equal(both.status, 1, `${both.stdout}${both.stderr}`);
  assert.equal(both.stderr.replace(STOPPED_SAID, "").replace(UNHELD_SAID, ""), bare.stderr, "each named once");
  assert.match(both.stderr, /\n {2}forge claim ISS-2205 --give-back\n/u, "the route still closes it");
  assert.equal(updates(), before, "and nothing was taken");
});

test("a --stopped at a live lease written on another host, or naming no process, says which", async () => {
  heldBy(DISPATCHER, { status: "developed", place: "another-boot pid:[1]" });
  const away = await flagged(["--stopped"]);
  assert.equal(away.status, 1, `${away.stdout}${away.stderr}`);
  assert.match(away.stderr, /--stopped settles a holder this call can look for, and the lease was written on another host than this call's/u);

  heldBy(DISPATCHER, { status: "developed", pid: "unknown" });
  const none = await flagged(["--stopped"]);
  assert.equal(none.status, 1, `${none.stdout}${none.stderr}`);
  assert.match(none.stderr, /--stopped settles a holder this call can look for, and the lease records no process on a host this call can look at/u);
});
