/* A payload write meeting another run's lease on an issue nothing is worked at any more, watched
   through the CLI on the write the round was lost on: ISS-205 correcting ISS-42's release note, with
   ISS-42 closed and three hours left on a lease nothing was working under. A settled issue's lease
   protects no work in progress, so the write takes it and gives it back; everywhere an issue is
   still worked the refusal stands exactly as it was (ISS-491). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("settled-write").path;
/* Away from this checkout, whose git directory names the run this suite is written under. */
const AWAY = projectRoom(tempRoom("settled-write-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "settled-write-uuid";
const OURS = "iss-205-correcting";
const THEIRS = "0c3b733e-the-wave";
const LEFT = "Phase 8: nothing left";

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-42",
  status: "closed",
  title: "a release note gone false after its issue closed",
  description: "no mark here",
  complexity: "s",
};

/* Each case starts from the status and the lease it is about, so no case reads through the one before it. */
const heldAt = (status, since, minutes = 180) => {
  ISSUE.status = status;
  delete ISSUE.releaseNotes;
  ISSUE.sessionContext = {
    lease: {
      holder: THEIRS, agent: "a-test-agent", pid: "4242", renewedAt: ago(since), minutes, next: LEFT,
      history: [{ holder: THEIRS, at: ago(since), how: "claim", status: "in_progress", next: null }],
    },
  };
};

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true } },
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update") Object.assign(ISSUE, args.data);
      if (args.action === "transition") ISSUE.status = args.data.status;
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

const ran = (argv) => ranAsync(FORGE, argv, { ...ENV, FORGE_SESSION_ID: OURS });
const note = () => ran(["record", "note", "ISS-42", "--section", "Fixed", "--user", "The swipe gesture is gone."]);
const onTheRecord = () => ISSUE.sessionContext.lease;

test("a note written to a closed issue under another run's live lease lands, and the lease is reclaimed by name and given back", async () => {
  heldAt("closed", 5);
  const wrote = await note();
  assert.equal(wrote.status, 0, `the correction should have landed:\n${wrote.stdout}${wrote.stderr}`);
  assert.doesNotMatch(wrote.stderr, /held by another run/u, "with nothing sending the caller to wait");
  assert.match(JSON.stringify(ISSUE.releaseNotes ?? null), /The swipe gesture is gone\./u,
    "and the note the caller typed is the one the issue now holds");
  const row = onTheRecord().history.at(-1);
  assert.equal(row.how, "reclaim", "the take is kept under the word a reclaim keeps");
  assert.equal(row.holder, OURS, "by the run that wrote");
  assert.equal(row.from, THEIRS, "naming the run it displaced");
  assert.match(wrote.stderr, /held by a lease on an issue at `closed` and this write reclaimed it/u,
    "the caller is told the settled status is why");
  assert.match(wrote.stderr, new RegExp(`came off session ${THEIRS}`, "u"), "and which run the lease came off");
  assert.equal(onTheRecord().holder, "", "and the lease the write took went back once the write had landed");
});

test("a dropped issue's live lease, and a closed issue's lease lapsed inside its own duration, both give way to the write", async () => {
  for (const [status, since, minutes] of [["dropped", 5, 180], ["closed", 90, 60]]) {
    heldAt(status, since, minutes);
    const wrote = await note();
    assert.equal(wrote.status, 0, `${status}, ${since} of ${minutes} minutes:\n${wrote.stdout}${wrote.stderr}`);
    assert.equal(onTheRecord().history.at(-1).from, THEIRS, `${status}: taken off the run that held it`);
  }
});

test("a live lease on any status an issue is still worked at refuses the write in the words it always did", async () => {
  for (const status of ["open", "in_progress", "developed", "awaiting_release", "on_hold"]) {
    heldAt(status, 5);
    const refused = await note();
    assert.equal(refused.status, 1, `${status}: a live lease is that run's:\n${refused.stdout}${refused.stderr}`);
    assert.match(refused.stderr, /ISS-42 is held by another run/u, status);
    assert.doesNotMatch(refused.stderr, /reclaimed it/u, `${status}: and nothing was taken`);
    assert.equal(onTheRecord().holder, THEIRS, `${status}: the holder's lease stands`);
  }
});

test("a finder's comment on a closed issue under another run's live lease takes no lease", async () => {
  heldAt("closed", 5);
  const body = join(AWAY, "settled-write-comment.md");
  writeFileSync(body, "The note above has gone false.\n");
  const posted = await ran(["comment", "ISS-42", body]);
  assert.equal(posted.status, 0, `a finder's comment posts:\n${posted.stdout}${posted.stderr}`);
  assert.equal(onTheRecord().holder, THEIRS, "and the holder's lease stands untouched");
  assert.equal(onTheRecord().history.length, 1, "with no row added to its history");
});
