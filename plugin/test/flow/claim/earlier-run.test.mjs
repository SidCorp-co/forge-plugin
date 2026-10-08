/* One issue dispatched more than once in a session: the run before this one finished without handing
   its lease over, and every agent of that session shares the one host process the lease records, so
   the process never reads as gone. What separates the earlier run from a sibling still at work is
   the tree it took the lease in, and each case below is one reading of that tree (ISS-3254). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { chmodSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectRecord, projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { placeOf } from "../../../src/flow/lease/holder.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const HOME = tempHome("earlier-run").path;
process.env.XDG_CONFIG_HOME = HOME;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "earlier-run-uuid";
const EARLIER = "iss-3254-aaaaaaaa";
const LATER = "iss-3254-bbbbbbbb";
const MARK = "iss-3254-work-witness";
const PROJECT = { ...OWN, lease: { workingRe: MARK } };

const DECLARED = [];
const treeMinting = (id) => {
  const at = realpathSync(projectRoom(tempRoom(`earlier-run-${id ?? "none"}-`), HOME, PROJECT));
  if (id) writeFileSync(join(at, ".git", "forge-run-id"), `${id}\n`);
  DECLARED.push(at);
  return at;
};

/* The caller's own tree, minted for the later dispatch; the earlier run's, still minting it; one
   minting a run of another issue; and a checkout that mints nothing. */
const LATER_TREE = treeMinting(LATER);
const EARLIER_TREE = treeMinting(EARLIER);
const THIRD_TREE = treeMinting("iss-9-cccccccc");
const BARE = treeMinting(null);
/* A tree the earlier run's own cleanup removed, which is the correct thing for a run to do on its way out. */
const REMOVED = treeMinting(EARLIER);
rmSync(REMOVED, { recursive: true, force: true });

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-3254",
  status: "approved",
  title: "an earlier run's lease on the same issue",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-05~1: the one outcome.",
  complexity: "m",
};

/* Written from this test's own process, which every forge call below names as its host: the shape a
   session's two sub-agents leave, one lease written and the next claim made under the same process. */
const heldBy = (tree, { status = "approved", pid = String(process.pid), landing = null } = {}) => {
  ISSUE.status = status;
  ISSUE.sessionContext = {
    lease: {
      holder: EARLIER, agent: "a-test-agent", pid, place: placeOf(), tree,
      renewedAt: new Date().toISOString(), minutes: 60, next: "spec run done; branch landed", history: [],
    },
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

const tracker = await fakeTracker(state);
const ENV = { ...tracker.env, HOME: tracker.env.XDG_CONFIG_HOME };
for (const at of DECLARED.filter((one) => one !== REMOVED)) projectRecord(at, tracker.env.XDG_CONFIG_HOME, PROJECT);
test.after(() => tracker.close());

const claim = (argv = [], at = LATER_TREE, who = LATER) =>
  ranAsync(FORGE, ["claim", "ISS-3254", ...argv], { ...ENV, FORGE_SESSION_ID: who, CLAUDE_PID: String(process.pid) }, at);
const took = () => ISSUE.sessionContext.lease;

/* Declared work standing in a tree and in no call's ancestry but this test's, which is a sibling's shape. */
const workIn = async (at) => {
  const one = spawn(process.execPath, ["-e", "setTimeout(() => process.exit(0), 120_000)", MARK], { cwd: at, stdio: "ignore" });
  for (let waited = 0; waited < 200; waited += 1) {
    try {
      if (readlinkSync(`/proc/${one.pid}/cwd`) === at) return one;
    } catch { /* not in the table yet */ }
    await new Promise((wake) => { setTimeout(wake, 10); });
  }
  throw new Error("a spawned process never reached the process table, which is not a state this suite can run in");
};

const handed = (said, why) => {
  assert.equal(said.status, 0, `the earlier run's lease should have been taken:\n${said.stdout}${said.stderr}`);
  assert.match(said.stdout, /ISS-3254 {2}handed: session iss-3254-bbbbbbbb/u, "under the word a dispatch's take keeps");
  assert.match(said.stdout, new RegExp(`That holder was an earlier run dispatched to ISS-3254, ${why}`, "u"), "saying why");
  assert.equal(took().holder, LATER);
  assert.equal(took().history.at(-1)?.how, "handed", "and the history counts no reclaim");
};

test("an earlier run's lease is taken where the tree it records is no longer a checkout", async () => {
  heldBy(REMOVED);
  handed(await claim(), "whose tree is no longer a checkout");
});

test("an earlier run's lease is taken where its tree has since been minted for this run and nothing works there", async () => {
  heldBy(LATER_TREE);
  handed(await claim(), "whose tree has since been minted for this run");
});

test("an earlier run's lease is taken where its tree still mints it and holds no declared work", async () => {
  heldBy(EARLIER_TREE);
  handed(await claim(), "whose tree holds nothing this project calls a run's own work");
});

test("declared work in the earlier run's tree refuses the take, and the assertion takes it", async () => {
  for (const tree of [EARLIER_TREE, LATER_TREE]) {
    heldBy(tree);
    const sibling = await workIn(tree);
    try {
      const refused = await claim();
      assert.equal(refused.status, 1, `${tree}: work stands there:\n${refused.stdout}`);
      assert.match(refused.stderr, new RegExp(`pid ${sibling.pid}`, "u"), "naming the work");
      assert.match(refused.stderr, /forge claim ISS-3254 --stopped/u, "and the route that waits for no clock");
      assert.equal(took().holder, EARLIER, "and nothing was taken");
      handed(await claim(["--stopped"]), "which you have established finished");
    } finally {
      sibling.kill();
    }
  }
});

test("a tree that reads neither way is refused with the assertion as its route, and the assertion takes it", async () => {
  heldBy(THIRD_TREE);
  const refused = await claim();
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /now mints iss-9-cccccccc, which is neither that run's nor this one's/u);
  assert.match(refused.stderr, /the process every agent of one session shares/u, "and why the process proves nothing");
  assert.match(refused.stderr, /\n {2}forge claim ISS-3254 --stopped\n/u, "the route, as a command");
  handed(await claim(["--stopped"]), "which you have established finished");
});

/* A checkout this call may not look into is a reading that was not made, not a tree that has gone. */
test("a recorded tree this call cannot look into is not read as gone", { skip: process.getuid?.() === 0 && "root reads past any mode" }, async () => {
  const shut = tempRoom("earlier-run-shut-");
  const inside = join(realpathSync(shut), "tree");
  chmodSync(shut, 0o000);
  try {
    heldBy(inside);
    const refused = await claim();
    assert.equal(refused.status, 1, `an unreadable tree licensed the take:\n${refused.stdout}`);
    assert.match(refused.stderr, /\n {2}forge claim ISS-3254 --stopped\n/u, "the caller settles it instead");
    assert.equal(took().holder, EARLIER);
    handed(await claim(["--stopped"]), "which you have established finished");
  } finally {
    chmodSync(shut, 0o700);
  }
});

test("an earlier run's lease written from another host process is still a second run's", async () => {
  heldBy(REMOVED, { pid: String(process.ppid) });
  const refused = await claim();
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /already with a run it was handed to/u);
  assert.equal(took().holder, EARLIER);
});

test("a caller whose own tree does not mint its id is refused, told which id the tree holds", async () => {
  heldBy(REMOVED);
  const bare = await claim([], BARE);
  assert.equal(bare.status, 1, bare.stdout);
  assert.match(bare.stderr, /holds iss-3254-bbbbbbbb while the tree it stands in mints no id/u);
  const other = await claim([], THIRD_TREE);
  assert.equal(other.status, 1, other.stdout);
  assert.match(other.stderr, /while the tree it stands in mints iss-9-cccccccc/u);
  assert.equal(took().holder, EARLIER);
});

test("the take holds past the dispatch statuses, and a landing checkpoint naming a turn still refuses it", async () => {
  heldBy(REMOVED, { status: "in_progress" });
  handed(await claim(), "whose tree is no longer a checkout");
  heldBy(REMOVED, { landing: { state: "candidate", builder: EARLIER, branch: "iss-3254", head: "a".repeat(40), base: "b".repeat(40), files: ["one.mjs"], at: new Date().toISOString() } });
  const refused = await claim();
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /names the lander's turn/u);
  assert.equal(took().holder, EARLIER);
});
