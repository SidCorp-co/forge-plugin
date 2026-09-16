/* The landing checkpoint a release leaves behind. `ship` wrote no landing state at all, so a branch
   its own run released still read `ready` — the state whose turn is the lander's at the first step —
   and the next `land-ready` naming no issue found it there (ISS-1654). */
import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { landIn, noBacklog, runIn, seen, switched, worktreeRoom } from "./run-fixtures.mjs";
import { mintRunId } from "../../../tools/run/workspace/run-id.mjs";
import { RUN_ID, besideGit } from "../../src/resolve/session/run-id.mjs";

const KEY = "ISS-673";
const UUID = "landing-uuid";
const NEXT_KEY = "ISS-674";
const NEXT_UUID = "landing-uuid-two";
const BRANCH = "iss-673";

const lease = (holder) => ({ holder, agent: "a-test-agent", pid: "4242",
  renewedAt: new Date().toISOString(), minutes: 60, next: null, history: [] });

const checkpoint = (extra = {}) => ({
  state: "ready",
  builder: "the-builder-run",
  branch: BRANCH,
  head: "0".repeat(40),
  base: "1".repeat(40),
  files: [join("plugin", "src", "one.mjs")],
  at: new Date().toISOString(),
  ...extra,
});

/** The backlog one room's cases are run against: whatever checkpoint and lease each is about. */
const seeded = ({ landing = checkpoint(), holder, mine = holder, batch = false }) => noBacklog({
  issues: [
    row(UUID, KEY, landing, holder),
    ...(batch ? [row(NEXT_UUID, NEXT_KEY, checkpoint(), mine)] : []),
  ],
});

/** A room whose worktree names the run `start` would have minted for it, with one issue on the
 *  tracker carrying whatever checkpoint and lease the case is about. */
const row = (documentId, issueId, landing, holder) => ({
  documentId,
  issueId,
  status: "developed",
  title: "the change this release ships",
  description: "a body.\n",
  sessionContext: { ...(landing ? { landing } : {}), lease: lease(holder) },
});

const released = ({ landing = checkpoint(), holder = null, batch = false } = {}) => {
  const room = worktreeRoom("finishes-the-checkpoint", KEY);
  const id = mintRunId(room.tree, batch ? [KEY, NEXT_KEY] : [KEY]);
  seeded({ landing, holder: holder ?? id, mine: id, batch });
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change this release ships");
  const env = { ...room.env };
  delete env.FORGE_SESSION_ID;
  return { ...room, id, env };
};

/** Every landing state this release sent to the tracker, in the order it sent them. */
const sent = () => seen("update")
  .map((one) => one.args.data?.sessionContext?.landing?.state)
  .filter(Boolean);

/** Which issue each of those was sent about. */
const about = () => seen("update")
  .filter((one) => one.args.data?.sessionContext?.landing)
  .map((one) => one.args.documentId);

test("a release finishes the ready checkpoint of the branch it landed", () => {
  const room = released();
  const run = runIn(room.tree, ["ship"], room.env);
  assert.match(run.stdout, /step 10\/10/u, `the release stopped short:\n${run.stdout}${run.stderr}`);
  assert.deepEqual(sent(), ["done"],
    `the release left the checkpoint where the build put it:\n${run.stdout}${run.stderr}`);
  assert.match(run.stdout, new RegExp(`${KEY} reads \`done\`: ${BRANCH} is landed and released`, "u"),
    `the release did not say whose checkpoint it finished:\n${run.stdout}${run.stderr}`);
});

test("a checkpoint naming another branch is named and left where it stands", () => {
  const room = released({ landing: checkpoint({ branch: "iss-999" }) });
  const run = runIn(room.tree, ["ship"], room.env);
  assert.match(run.stdout, /step 10\/10/u, `${run.stdout}${run.stderr}`);
  assert.deepEqual(sent(), [], `a checkpoint of another branch was written:\n${run.stdout}`);
  assert.match(run.stdout, new RegExp(`${KEY} stays \`ready\`: its checkpoint names iss-999 `
    + `and this release landed ${BRANCH}`, "u"), `it was left standing in silence:\n${run.stdout}`);
});

test("a checkpoint past ready is named and left where it stands", () => {
  const room = released({ landing: checkpoint({ state: "builder-owed" }) });
  const run = runIn(room.tree, ["ship"], room.env);
  assert.match(run.stdout, /step 10\/10/u, `${run.stdout}${run.stderr}`);
  assert.deepEqual(sent(), [], `a state the landing owns was written over:\n${run.stdout}`);
  assert.match(run.stdout, new RegExp(`${KEY} stays \`builder-owed\`: this release finishes a `
    + "checkpoint reading `ready` and no other state", "u"), `it was left standing in silence:\n${run.stdout}`);
});

test("an issue carrying no checkpoint leaves the release saying there was none", () => {
  const room = released({ landing: null });
  const run = runIn(room.tree, ["ship"], room.env);
  assert.match(run.stdout, /step 10\/10/u, `${run.stdout}${run.stderr}`);
  assert.deepEqual(sent(), [], run.stdout);
  assert.match(run.stdout, new RegExp(`${KEY} carries no landing checkpoint`, "u"),
    `a read that found nothing and one that judged read alike:\n${run.stdout}`);
});

/* The lease is another live run's, which is the refusal a release meets when the run that built the
   change is not the one shipping it. The release is already pushed and installed by then. */
test("a write the tracker refuses leaves the release green and names the call that finishes it", () => {
  const room = released({ holder: "iss-673-someoneelse" });
  const run = runIn(room.tree, ["ship"], room.env);
  assert.equal(run.status, 0, `the refusal ended a release that had already shipped:\n${run.stderr}`);
  assert.match(run.stdout, /step 10\/10/u, `${run.stdout}${run.stderr}`);
  assert.deepEqual(sent(), [], run.stdout);
  assert.match(run.stderr, new RegExp(`${KEY} stays \`ready\``, "u"), `the refusal is silent:\n${run.stderr}`);
  assert.match(run.stderr, /finish it: node .*run\.mjs ship --from 10/u,
    `the refusal carries no way out:\n${run.stderr}`);
});

test("a release from a tree whose git directory names no run finishes no checkpoint", () => {
  const room = released();
  rmSync(besideGit(room.tree, RUN_ID), { force: true });
  const run = runIn(room.tree, ["ship"], room.env);
  assert.match(run.stdout, /step 10\/10/u, `${run.stdout}${run.stderr}`);
  assert.deepEqual(sent(), [], run.stdout);
  assert.match(run.stdout, /names no run, so this release answers for no issue key/u,
    `a release that could name no issue said nothing about it:\n${run.stdout}`);
});

/* The step is the release's last, so nothing reaches it before the push: a checkpoint finished by a
   run whose gate or whose clean-tree check refused would say a branch is landed that is not. */
test("a release that stops before its push leaves the checkpoint reading ready", () => {
  const room = released();
  writeFileSync(join(room.tree, "plugin", "src", "one.mjs"), "uncommitted\n");
  const run = runIn(room.tree, ["ship"], room.env);
  assert.notEqual(run.status, 0, `the release was meant to stop:\n${run.stdout}`);
  assert.deepEqual(sent(), [], `a checkpoint was finished for a release that never pushed:\n${run.stdout}`);
});

/* A batch is one tree under one id, and the release answers for every key that id names. A write one
   of them refuses is that member's own: the rest of the set is still landed and still released. */
test("a batch finishes every eligible checkpoint, and one refused write leaves the rest finished", () => {
  const room = released({ batch: true, holder: "iss-673-someoneelse" });
  const run = runIn(room.tree, ["ship"], room.env);
  assert.match(run.stdout, /step 10\/10/u, `${run.stdout}${run.stderr}`);
  assert.deepEqual(sent(), ["done"], `the second member was not finished:\n${run.stdout}${run.stderr}`);
  assert.deepEqual(about(), [NEXT_UUID], `the wrong member was finished:\n${run.stdout}`);
  assert.match(run.stderr, new RegExp(`${KEY} stays \`ready\``, "u"), `the refusal is silent:\n${run.stderr}`);
  assert.match(run.stdout, new RegExp(`${NEXT_KEY} reads \`done\``, "u"),
    `one member's refusal took the other with it:\n${run.stdout}`);
});

/* The step sits after the install, so a release whose cache was never written has certified nothing. */
test("a release whose install fails leaves the checkpoint reading ready", () => {
  const room = released();
  switched(room.at, "claude-update-refuses");
  const run = runIn(room.tree, ["ship"], room.env);
  assert.notEqual(run.status, 0, `the release was meant to stop at its install:\n${run.stdout}`);
  assert.deepEqual(sent(), [], `a checkpoint was finished for a release nothing installed:\n${run.stdout}`);
});

/* The checkpoint is not the status: what the record earns is the run's own to advance afterwards. */
test("a checkpoint this release finished leaves the issue at the status it held", () => {
  const room = released();
  const run = runIn(room.tree, ["ship"], room.env);
  assert.deepEqual(sent(), ["done"], `${run.stdout}${run.stderr}`);
  assert.deepEqual(seen("transition"), [], `the release moved a status:\n${run.stdout}`);
  assert.deepEqual([...new Set(seen("update").flatMap((one) => Object.keys(one.args.data ?? {})))],
    ["sessionContext"], `the release wrote a field that is not the checkpoint:\n${run.stdout}`);
});

/* The resume onto the last step starts below the install, so the step cannot take the run's word for
   it that a release was installed: it asks the install record and names the step that writes one. */
test("a resume onto the last step past a failed install leaves the checkpoint ready, and the install finishes it", () => {
  const room = released();
  switched(room.at, "claude-update-refuses");
  assert.notEqual(runIn(room.tree, ["ship"], room.env).status, 0, "the install was meant to refuse");
  const stopped = runIn(room.tree, ["ship", "--from", "10"], room.env);
  assert.deepEqual(sent(), [], `a release nothing installed finished a checkpoint:\n${stopped.stdout}`);
  assert.match(stopped.stderr, /no install record answers for this plugin, so nothing says this release was installed/u,
    `the step did not say why it finished nothing:\n${stopped.stderr}`);
  assert.match(stopped.stderr, /install it, and the checkpoints follow: node .*run\.mjs ship --from 9/u,
    `the report carries no way out:\n${stopped.stderr}`);
  rmSync(join(room.at, "claude-update-refuses"), { force: true });
  const run = runIn(room.tree, ["ship", "--from", "9"], room.env);
  assert.deepEqual(sent(), ["done"], `the install resume left the checkpoint standing:\n${run.stdout}${run.stderr}`);
});

/* The install answers for a version and not for the content: a resume onto the last step reaches it
   over a tree that grew a commit after the push, under the version the cache already holds. */
test("a resume onto the last step over a tree that moved since the push leaves the checkpoint ready", () => {
  const room = released();
  assert.deepEqual(sent(), [], "the room was seeded with something already written");
  runIn(room.tree, ["ship"], room.env);
  seeded({ holder: room.id });
  landIn(room.tree, join("plugin", "src", "two.mjs"), 2, "work the release did not carry");
  const run = runIn(room.tree, ["ship", "--from", "10"], room.env);
  assert.deepEqual(sent(), [], `a checkpoint was finished over work nothing pushed:\n${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /and this tree is at .*, so nothing says what stands here is what was released/u,
    `the step did not say why it finished nothing:\n${run.stderr}`);
  assert.match(run.stderr, /release this tree, and the checkpoints follow: node .*run\.mjs ship/u,
    `the report carries no way out:\n${run.stderr}`);
});
