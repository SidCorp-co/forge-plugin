/* A claim on an issue at `draft` is the first call a run dispatched there makes, so it is where that
   run learns two things: that the status is before the ones a run is dispatched at rather than past
   them, and which status puts the issue on the ladder (ISS-3093). */
import assert from "node:assert/strict";
import test from "node:test";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("claim-draft").path;
/* Away from this checkout, whose git directory names the run this suite is written under. */
const AWAY = projectRoom(tempRoom("claim-draft-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "claim-draft-uuid";
const RUN = "the-run-dispatched-onto-a-draft";

const ISSUE = { documentId: UUID, issueId: "ISS-1244", status: "draft", title: "a filing still at draft",
  description: "no mark here", complexity: "m", sessionContext: {} };

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "none",
    pipelineConfig: { autoProdDeploy: true, states: { open: { mode: "auto" } } } },
  issues: [ISSUE],
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update") Object.assign(ISSUE, args.data);
      return ISSUE;
    },
    forge_comments: (args) => (args.action === "list"
      ? { comments: [], returned: 0, hasMore: false }
      : { documentId: "a-comment" }),
  },
};

const { tracker, env: ENV } = await trackerFor(state, [AWAY]);
test.after(() => tracker.close());

const forge = (verb, argv = []) => ranAsync(FORGE, [verb, "ISS-1244", ...argv], { ...ENV, FORGE_SESSION_ID: RUN }, AWAY);

test("a claim at draft over an empty field says the status is before the dispatch statuses, and names the flag", async () => {
  ISSUE.sessionContext = {};
  const refused = await forge("claim");
  assert.equal(refused.status, 1, `${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /at `draft`, the reporter's status before the ones a run is dispatched at/u, refused.stderr);
  assert.doesNotMatch(refused.stderr, /past the statuses a run is dispatched at/u, "and it does not call it past them");
  assert.match(refused.stderr, /forge claim ISS-1244 --unheld\s*$/u, "and the one command that clears it is the last line");
});

test("the claim that takes a draft prints the owed line advance --owed prints, naming the move onto the ladder", async () => {
  ISSUE.sessionContext = {};
  const taken = await forge("claim", ["--unheld"]);
  assert.equal(taken.status, 0, `${taken.stdout}${taken.stderr}`);
  const owed = await forge("advance", ["--owed"]);
  assert.equal(owed.status, 0, owed.stderr);
  const line = owed.stdout.split("\n").find((one) => one.startsWith("ISS-1244 is draft;"));
  assert.match(line ?? "", /^ISS-1244 is draft; in_progress is next/u, owed.stdout);
  assert.ok(taken.stdout.split("\n").includes(line), `the claim prints that same line:\n${taken.stdout}`);
  assert.match(taken.stdout, /`open` is passed over: this project's pipeline declares its `open` state `auto`/u,
    "with the sentence saying why that status and not open");
});
