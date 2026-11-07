/* A tracker whose release note takes no title refused the whole note over it, and the verb refuses a
   note without one, so no note could be written there at all (FB-59, ISS-83). */
import assert from "node:assert/strict";
import test from "node:test";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { OWN, trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("untitled-note").path;
const AWAY = projectRoom(tempRoom("untitled-note-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const UUID = "untitled-note-uuid";
const OURS = "iss-83-run";
const ISSUE = { documentId: UUID, issueId: "ISS-976", status: "in_progress", title: "a change", description: "no mark here", complexity: "s" };

const heldByUs = () => {
  delete ISSUE.releaseNotes;
  const at = new Date().toISOString();
  ISSUE.sessionContext = { lease: { holder: OURS, agent: "a-test-agent", pid: "4242", renewedAt: at, minutes: 60, next: null,
    history: [{ holder: OURS, at, how: "claim", status: "in_progress", next: null }] } };
};

const state = {
  calls: [],
  takesTitle: false,
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update" && args.data?.releaseNotes?.title && !state.takesTitle) {
        return { refused: "The field releaseNotes.title is not one this call takes." };
      }
      if (args.action === "update") Object.assign(ISSUE, args.data);
      return ISSUE;
    },
    forge_comments: (args) => (args.action === "list" ? { comments: [], returned: 0, hasMore: false } : { documentId: "a-comment" }),
  },
};

const { tracker, env: ENV } = await trackerFor(state, [AWAY]);
test.after(() => tracker.close());

const note = () => ranAsync(FORGE, ["record", "note", "ISS-976", "--section", "Added", "--title", "Bonus taxed by month paid",
  "--user", "A bonus paid next month is taxed in the month it is paid."], { ...ENV, FORGE_SESSION_ID: OURS });

test("on a tracker refusing releaseNotes.title the note is written without it, and the run is told", async () => {
  heldByUs();
  state.takesTitle = false;
  const run = await note();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(ISSUE.releaseNotes, { section: "Added", userFacing: "A bonus paid next month is taxed in the month it is paid.", technical: null });
  assert.match(run.stderr, /This tracker takes no releaseNotes\.title, so the note was written without its title "Bonus taxed by month paid"\./u);
});

test("on a tracker taking the title the note is sent with it, once", async () => {
  heldByUs();
  state.takesTitle = true;
  state.calls = [];
  const run = await note();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(ISSUE.releaseNotes?.title, "Bonus taxed by month paid");
  assert.equal(state.calls.filter((one) => one.args?.action === "update" && one.args.data?.releaseNotes).length, 1);
  assert.doesNotMatch(run.stderr, /takes no releaseNotes\.title/u);
});
