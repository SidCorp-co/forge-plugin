/* Agenfold's ISS-28: `forge record note` on a draft was refused at the lease and never said plainly that
   nothing went up. A record's refusal leads with whether anything was written — read off what the
   transport sent, so no step can be missed — and still ends on the command that clears it. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { OWN, trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("draft-note").path;

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const ROOM = tempRoom("draft-note-");
spawnSync("git", ["init", "-q", "-b", "master", ROOM], { cwd: ROOM });
const ISSUE = { documentId: "draft-note-uuid", issueId: "ISS-28", projectId: OWN.id, status: "draft",
  title: "a filing nothing has started", description: "no mark here" };
const state = { calls: [], issues: [ISSUE], comments: { "draft-note-uuid": [] }, answer: {} };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
  return state.issues[0];
};
state.answer.forge_comments = (args) => (args.action === "list" ? { comments: [], returned: 0, hasMore: false } : { documentId: "c-1" });
const { tracker, env: ENV } = await trackerFor(state, [ROOM]);
projectRoom(ROOM, ENV.XDG_CONFIG_HOME, OWN);
test.after(() => tracker.close());

test("a note refused at the lease on a draft leads with nothing written and ends on the one command that clears it", async () => {
  const run = await ranAsync(FORGE, ["record", "note", "ISS-28", "--section", "Fixed", "--title", "a finding",
    "--user", "what was seen"], { ...ENV, FORGE_SESSION_ID: "a-run" }, ROOM);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr.split("\n")[0], /^record note on ISS-28: nothing written\.$/u, run.stderr);
  assert.match(run.stderr.trimEnd().split("\n").at(-1), /^ {2}forge claim ISS-28 --unheld$/u, run.stderr);
  const reads = ["get", "list", undefined];
  assert.deepEqual(state.calls.filter((one) => !reads.includes(one.args?.action)), [], "and nothing was sent");
});
