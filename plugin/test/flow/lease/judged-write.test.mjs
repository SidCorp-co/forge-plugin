/* A judge's verdict past a lease its dispatcher still holds. The lease guards the writes that replace
   something, and a verdict replaces nothing, so the judge writes it under an id of its own and the
   dispatcher's lease reads back exactly as it stood — which is what every case here weighs, because
   a write that merely renewed the dispatcher's lease would still read as the dispatcher's (ISS-1494). */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { join } from "node:path";
import test, { after, before } from "node:test";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("judged-write").path;
/* Away from this checkout, whose git directory names the run this suite is written under. */
const AWAY = projectRoom(tempRoom("judged-write-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);
const { parseAll } = await import("../../../src/flow/record/page.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "judged-write-uuid";
const COMMIT = "43b811e";
const DISPATCHER = "the-session-that-dispatched-the-judge";
const JUDGE = "iss-7-0a1b2c3d";

const LEASE = {
  holder: DISPATCHER,
  agent: "a-test-agent",
  pid: "4242",
  renewedAt: new Date().toISOString(),
  minutes: 60,
  next: null,
  history: [{ holder: DISPATCHER, at: new Date().toISOString(), how: "claim", status: "developed" }],
};

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-7",
  status: "developed",
  title: "the change being judged",
  description: "no mark here",
  acceptanceCriteria: "1. The first outcome.\n2. The second outcome.",
  mergedAt: "2026-09-07T09:00:00.000Z",
  attachments: [],
  sessionContext: { lease: structuredClone(LEASE) },
};

let clock = 0;
const at = () => `2026-09-07T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const state = { calls: [], issues: [ISSUE], comments: { [UUID]: [] }, answer: {} };
state.answer.forge_config = () => ({ config: { baseBranch: "master" } });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "update" || args.action === "transition") return Object.assign(ISSUE, args.data);
  return ISSUE;
};
state.answer.forge_comments = (args) => {
  if (args.action === "list") {
    const held = state.comments[args.filters?.issue] ?? [];
    return { comments: held, returned: held.length, hasMore: false };
  }
  const held = (state.comments[args.data?.issue] ??= []);
  const id = `comment-${held.length}`;
  held.push({ documentId: id, createdAt: at(), authorDeviceId: "agent", body: args.data?.body });
  return { documentId: id, authorDeviceId: "agent" };
};

const sink = createServer((request, response) => {
  request.resume();
  request.on("end", () => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ id: "up", name: "n", url: "/api/attachments/up/download" }));
  });
});
await new Promise((ready) => sink.listen(0, "127.0.0.1", ready));
state.answer.forge_uploads = (args) =>
  ({ uploadUrl: `http://127.0.0.1:${sink.address().port}/put/${args?.data?.name ?? "unnamed"}` });

/* A checkout of its own, so the flags that read git reach the judge's refusal rather than stopping at
   a directory that is no checkout. */
const CHECKOUT = tempRoom("judged-write-checkout-");
for (const argv of [["init", "-q", "-b", "iss-7"], ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "a head"]]) {
  spawnSync("git", argv, { cwd: CHECKOUT });
}

const { tracker, env: ENV } = await trackerFor(state, [AWAY, CHECKOUT]);
after(() => {
  tracker.close();
  sink.close();
});

/* The judge's id is set in the variable; the one it did not set is the dispatching session's. */
const BARE = Object.fromEntries(Object.entries(ENV).filter(([name]) => name !== "FORGE_SESSION_ID"));
const asJudge = (...argv) => ranAsync(FORGE, argv, { ...BARE, FORGE_SESSION_ID: JUDGE }, CHECKOUT);
const asInherited = (...argv) => ranAsync(FORGE, argv, { ...BARE, CLAUDE_CODE_SESSION_ID: "the-wave-id" }, CHECKOUT);

const posted = () => state.comments[UUID].length;
const uploads = () => state.calls.filter((one) => one.name === "forge_uploads").length;
const leaseWrites = () => state.calls.filter((one) => one.name === "forge_issues"
  && (one.args?.action === "update" || one.args?.action === "transition")).length;

state.comments[UUID].push({
  documentId: "the-mark",
  createdAt: at(),
  authorDeviceId: "agent",
  body: `mark_merged target=base — merged to master at ${COMMIT}`,
});

const room = tempRoom("judged-write-files-");

before(async () => {
  /* The thread read the comment-delivery hold keys by, made under each id a case writes from. */
  for (const ask of [asJudge, asInherited]) await ask("comment", "ISS-7");
});

test("a judge's verdict posts under its own id while the dispatcher's lease is live, and the lease reads back as it stood", async () => {
  const path = join(room, "judged.txt");
  writeFileSync(path, "what the judge saw\n");
  const [before, sent, writes] = [posted(), uploads(), leaseWrites()];
  const run = await asJudge("record", "verdict", "ISS-7", "--commit", COMMIT,
    "--criterion", "1", "--verdict", "pass", "--evidence", path);
  assert.equal(run.status, 0, `the judge's verdict should have gone up:\n${run.stdout}${run.stderr}`);
  assert.equal(posted() - before, 1, "one verdict comment posted");
  const [record] = parseAll(state.comments[UUID].at(-1).body);
  assert.equal(record.fields.judge, JUDGE, "criterion 1: the Judge line reads the id the judge set");
  assert.equal(uploads() - sent, 1, "criterion 3: the evidence file went up");
  assert.equal(leaseWrites(), writes, "criterion 2: no field write and no status move reached the tracker");
  assert.deepEqual(ISSUE.sessionContext.lease, LEASE,
    "criterion 2: holder, renew time, duration and claim history exactly as they stood");
  assert.match(run.stderr, new RegExp(`The lease on ISS-7 stands as it was, session ${DISPATCHER}`, "u"),
    "and the write says whose lease stood");
  assert.match(run.stderr, new RegExp(`this one went up under ${JUDGE}, read from FORGE_SESSION_ID`, "u"),
    "and under which id the verdict went");
});

/* The admission reaches a lease lapsed inside its own duration as it reaches a live one: nothing
   proves that holder gone, so the lease is still another run's, and the verdict replaces nothing. */
test("a judge's verdict posts past a lease inside its duration and past one lapsed inside it, and each reads back as it stood", async () => {
  const minute = 60_000;
  const lapsed = { ...structuredClone(LEASE), renewedAt: new Date(Date.now() - 70 * minute).toISOString() };
  try {
    for (const [name, lease] of [["live", structuredClone(LEASE)], ["lapsed inside its duration", lapsed]]) {
      ISSUE.sessionContext.lease = structuredClone(lease);
      const [before, writes] = [posted(), leaseWrites()];
      const run = await asJudge("record", "verdict", "ISS-7", "--commit", COMMIT, "--evidence", COMMIT,
        "--criterion", "1", "--verdict", "pass");
      assert.equal(run.status, 0, `${name}: the judge's verdict should have gone up:\n${run.stdout}${run.stderr}`);
      assert.equal(posted() - before, 1, `${name}: one verdict comment posted`);
      assert.equal(leaseWrites(), writes, `${name}: no field write and no status move reached the tracker`);
      assert.deepEqual(ISSUE.sessionContext.lease, lease, `${name}: the lease reads back exactly as it stood`);
    }
  } finally {
    ISSUE.sessionContext.lease = structuredClone(LEASE);
  }
});

test("a judge's record that earns the next status moves none, and names the holder's advance", async () => {
  const writes = leaseWrites();
  const run = await asJudge("record", "verdict", "ISS-7", "--commit", COMMIT, "--evidence", COMMIT,
    "--criterion", "1", "--verdict", "pass", "--criterion", "2", "--verdict", "pass");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(ISSUE.status, "developed", "criterion 4: the status did not move");
  assert.equal(leaseWrites(), writes, "criterion 4: no transition was sent");
  assert.match(run.stderr, /ISS-7's record now earns testing, and the move is the holder's/u,
    `criterion 5: the move it earned is named:\n${run.stderr}`);
  assert.match(run.stderr, /The holder takes it with:\n {2}forge advance ISS-7/u, "criterion 5: with the holder's call");
  assert.deepEqual(ISSUE.sessionContext.lease, LEASE, "and the lease still reads as it stood");
});

test("any other kind past the live lease is refused as before, and so is a verdict beside one", async () => {
  const before = posted();
  const decision = await asJudge("record", "decision", "ISS-7", "--none", "nothing was decided");
  assert.equal(decision.status, 1, decision.stdout);
  assert.match(decision.stderr, /ISS-7 is held by another run: .*Its payload writes are that run's/u,
    "criterion 6: the live-lease refusal it met before");
  const beside = await asJudge("record", "verdict", "ISS-7", "--commit", COMMIT, "--evidence", COMMIT,
    "--criterion", "1", "--verdict", "pass", "--also", "decision", "--none", "nothing");
  assert.equal(beside.status, 1, beside.stdout);
  assert.match(beside.stderr, /ISS-7 is held by another run: .*Its payload writes are that run's/u,
    "criterion 7: a verdict riding another kind meets that kind's refusal");
  assert.equal(posted(), before, "and nothing was posted");
  assert.deepEqual(ISSUE.sessionContext.lease, LEASE, "nor the lease touched");
});

test("a verdict under an id the caller did not set is refused, naming the variable that clears it", async () => {
  const before = posted();
  const run = await asInherited("record", "verdict", "ISS-7", "--commit", COMMIT, "--evidence", COMMIT,
    "--criterion", "1", "--verdict", "pass");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /This call holds the-wave-id, read from CLAUDE_CODE_SESSION_ID/u,
    "criterion 8: the id it holds and where it came from");
  assert.match(run.stderr, /FORGE_SESSION_ID=<an id of its own> forge record verdict ISS-7 --commit/u,
    "criterion 8: the one command that clears it");
  assert.equal(posted(), before, "and nothing was posted");
});

test("a run flag beside a judge's verdict is refused, the write taking no lease for it to act on", async () => {
  const before = posted();
  for (const flag of [["--next", "the dispatcher takes it back"], ["--open", "a line left open"], ["--pushed"], ["--review"]]) {
    const run = await asJudge("record", "verdict", "ISS-7", "--commit", COMMIT, "--evidence", COMMIT,
      "--criterion", "1", "--verdict", "pass", ...flag);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, new RegExp(`this verdict is a judge's write and takes no lease, and ${flag[0]} writes onto the lease`, "u"),
      `criterion 9: ${flag[0]} is named and why nothing would act on it:\n${run.stderr}`);
  }
  assert.equal(posted(), before, "and nothing was posted");
});

test("the owed read says, before any judging, whether this caller's verdict would be written", async () => {
  const judge = await asJudge("advance", "ISS-7", "--owed");
  assert.match(judge.stdout, new RegExp(`A verdict from this call is a judge's write: ISS-7's lease is ${DISPATCHER}'s, `
    + `and \`forge record verdict\` posts past it under ${JUDGE}`, "u"), `criterion 10:\n${judge.stdout}${judge.stderr}`);
  const inherited = await asInherited("advance", "ISS-7", "--owed");
  assert.match(inherited.stdout, /A verdict from this call would be refused: .*this call holds the-wave-id/u,
    `criterion 10: and the caller that would be refused is told so:\n${inherited.stdout}${inherited.stderr}`);
  assert.match(inherited.stdout, /FORGE_SESSION_ID=<an id of its own> forge advance ISS-7 --owed/u,
    "criterion 10: with the command that sets one");
});

/* At a park answered by a comment the tracker itself reopens the issue on any comment, so a judge's
   verdict there would move a status no lease-less write may move. */
test("a judge's verdict at a park a comment answers is refused before anything is sent", async () => {
  const [before, sent] = [posted(), uploads()];
  for (const status of ["waiting", "needs_info"]) {
    ISSUE.status = status;
    const run = await asJudge("record", "verdict", "ISS-7", "--commit", COMMIT, "--evidence", COMMIT,
      "--criterion", "1", "--verdict", "pass");
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, new RegExp(`ISS-7 is ${status} under another run's lease, and at that status the tracker reads a comment as the reply`, "u"),
      `${status}: the refusal says why:\n${run.stderr}`);
    assert.equal(ISSUE.status, status, `${status}: the status did not move`);
    const inherited = await asInherited("record", "verdict", "ISS-7", "--commit", COMMIT, "--evidence", COMMIT,
      "--criterion", "1", "--verdict", "pass");
    assert.match(inherited.stderr, /FORGE_SESSION_ID=<an id of its own> forge record verdict ISS-7/u,
      `${status}: an id the caller did not set is still told the one command that clears it first`);
    const owed = await asJudge("advance", "ISS-7", "--owed");
    assert.match(owed.stdout, new RegExp(`A verdict from this call would be refused: ISS-7 is ${status} under another run's lease`, "u"),
      `${status}: the owed read predicts the refusal the write meets:\n${owed.stdout}${owed.stderr}`);
  }
  ISSUE.status = "developed";
  assert.equal(posted(), before, "nothing was posted");
  assert.equal(uploads(), sent, "and nothing was sent");
  assert.deepEqual(ISSUE.sessionContext.lease, LEASE, "and the lease is as it stood");
});
