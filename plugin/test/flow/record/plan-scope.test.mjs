/* The cache a write-time gate reads instead of calling the tracker. Driven through its own writers
   and reader over an injected tree and clock, so no case depends on where this suite is run. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

process.env.XDG_CONFIG_HOME = join(tempRoom("plan-scope-cache-"), "config");

const { SCOPE_KEPT_MS, dropScope, noteScope, scopeDir, scopeFrom, scopeHeld, scopePath } =
  await import("../../../src/flow/record/plan-scope.mjs");
const { namesPath } = await import("../../../src/flow/record/merged.mjs");

const TREE = "/a/tree";
const OTHER = "/another/tree";
const NOW = Date.parse("2026-09-15T00:00:00.000Z");

const refs = (tree, now = NOW) => scopeHeld(tree, now).map((one) => one.ref);

test("what one issue's plan names is held against the tree it is worked in, and nowhere else", () => {
  noteScope("ISS-411", "plugin/src/a.mjs", { tree: TREE, now: NOW });
  assert.deepEqual(scopeHeld(TREE, NOW), [
    { ref: "ISS-411", named: "plugin/src/a.mjs", at: new Date(NOW).toISOString() },
  ]);
  assert.deepEqual(scopeHeld(OTHER, NOW), []);
  assert.deepEqual(scopeHeld(null, NOW), []);
});

test("a tree holding several issues answers with every one of them, newest first", () => {
  noteScope("ISS-500", "one.mjs", { tree: OTHER, now: NOW });
  noteScope("ISS-501", "two.mjs", { tree: OTHER, now: NOW + 2000 });
  noteScope("ISS-499", "three.mjs", { tree: OTHER, now: NOW + 1000 });
  assert.deepEqual(refs(OTHER, NOW + 3000), ["ISS-501", "ISS-499", "ISS-500"]);
});

test("a reference is held once however it was spelt, so a re-claim replaces rather than doubles", () => {
  noteScope("iss-600", "first.mjs", { tree: TREE, now: NOW });
  noteScope("ISS-600", "second.mjs", { tree: TREE, now: NOW + 1000 });
  const held = scopeHeld(TREE, NOW + 2000).filter((one) => one.ref === "ISS-600");
  assert.equal(held.length, 1);
  assert.equal(held[0].named, "second.mjs");
});

test("an entry past the window it lives for is read by nothing, and neither is the tree left empty", () => {
  noteScope("ISS-700", "old.mjs", { tree: "/stale", now: NOW });
  assert.deepEqual(refs("/stale", NOW + SCOPE_KEPT_MS - 1), ["ISS-700"]);
  assert.deepEqual(refs("/stale", NOW + SCOPE_KEPT_MS), []);
  assert.deepEqual(refs("/stale", NOW + SCOPE_KEPT_MS + 1), []);
});

test("an issue dropped is gone from the tree, which is not the same answer as one holding no plan", () => {
  noteScope("ISS-800", "gone.mjs", { tree: "/dropped", now: NOW });
  noteScope("ISS-801", "", { tree: "/dropped", now: NOW });
  assert.equal(dropScope("ISS-800", { tree: "/dropped", now: NOW }), true);
  assert.deepEqual(scopeHeld("/dropped", NOW), [{ ref: "ISS-801", named: "", at: new Date(NOW).toISOString() }]);
  assert.equal(dropScope("ISS-800", { tree: "/dropped", now: NOW }), false);
});

test("a status off the ladder drops the entry and every other status writes it", () => {
  scopeFrom("in_progress", "ISS-900", "live.mjs", { tree: "/ladder", now: NOW });
  assert.deepEqual(refs("/ladder"), ["ISS-900"]);
  scopeFrom("testing", "ISS-900", "live.mjs", { tree: "/ladder", now: NOW });
  assert.deepEqual(refs("/ladder"), ["ISS-900"]);
  scopeFrom("closed", "ISS-900", "live.mjs", { tree: "/ladder", now: NOW });
  assert.deepEqual(refs("/ladder"), []);
  scopeFrom("dropped", "ISS-901", "x.mjs", { tree: "/ladder", now: NOW });
  assert.deepEqual(refs("/ladder"), []);
});

test("a call naming no tree and a call naming no reference write nothing", () => {
  assert.equal(noteScope("ISS-411", "a.mjs", { tree: null, now: NOW }), false);
  assert.equal(noteScope("", "a.mjs", { tree: TREE, now: NOW }), false);
  assert.equal(dropScope("", { tree: TREE, now: NOW }), false);
});

test("each tree has a file of its own under this machine's config directory, and never a shared one", () => {
  assert.equal(scopeDir(), join(process.env.XDG_CONFIG_HOME, "forge", "plan-scope"));
  assert.equal(join(scopePath(TREE, "ISS-1"), ".."), scopeDir());
  assert.notEqual(scopePath(TREE, "ISS-1"), scopePath(OTHER, "ISS-1"));
  assert.notEqual(scopePath(TREE, "ISS-1"), scopePath(TREE, "ISS-2"));
  assert.equal(scopePath(TREE, "iss-1"), scopePath(TREE, "ISS-1"));
});

/* Two writers: under one shared file the second saves a snapshot taken before the first wrote,
   putting back a scope the first had already corrected — whether they share a tree or not. Asserted
   on the bytes, since that is what a later save would have overwritten. */
test("a write against one issue does not touch the file another issue's scope is read from", () => {
  noteScope("ISS-950", "first.mjs", { tree: "/one", now: NOW });
  const before = readFileSync(scopePath("/one", "ISS-950"), "utf8");
  noteScope("ISS-951", "second.mjs", { tree: "/two", now: NOW + 1000 });
  noteScope("ISS-952", "third.mjs", { tree: "/one", now: NOW + 2000 });
  assert.equal(readFileSync(scopePath("/one", "ISS-950"), "utf8"), before);
  assert.deepEqual(refs("/one", NOW + 3000), ["ISS-952", "ISS-950"]);
  assert.deepEqual(refs("/two", NOW + 3000), ["ISS-951"]);
});

/* The one case driven through the CLI: what the gate refuses turns on a refresh that has to survive
   the call it was taken in, and only a real record write over a real tracker can show that. */
const { execFileSync } = await import("node:child_process");
const { copyFileSync, mkdirSync, realpathSync, rmSync, writeFileSync } = await import("node:fs");
const { fakeTracker, ranAsync, typedPlan } = await import("../../fixtures.mjs");

const PLANNED = "plugin/src/planned.mjs";
const GREW = "plugin/src/grew.mjs";

test("a correction the tracker took is held by the cache though the write after it failed", async () => {
  const issue = { documentId: "scope-uuid", issueId: "ISS-77", status: "in_progress",
    title: "a run whose change grew", plan: typedPlan(), acceptanceCriteria: "1. The one outcome." };
  issue.plan = `${issue.plan}\n\n- \`${PLANNED}\`\n`;
  let posts = 0;
  const project = {
    issues: [issue],
    comments: { "scope-uuid": [] },
    answer: {
      forge_issues: (args) => {
        if (args.action === "list") return { issues: [issue], returned: 1, hasMore: false };
        if (args.action === "get") return issue;
        if (args.action === "update") return Object.assign(issue, args.data);
        return { documentId: args.documentId, ...(args.data ?? {}) };
      },
      /* The second post refuses: the correction is on the tracker and the call that made it is not. */
      forge_comments: (args) => {
        if (args.action === "list") return { comments: project.comments["scope-uuid"], returned: 0, hasMore: false };
        posts += 1;
        if (posts > 1) return { refused: "the tracker would not take this one" };
        project.comments["scope-uuid"].push({ createdAt: "2026-09-15T00:00:00.000Z", body: args.data.body });
        return { documentId: `comment-${posts}`, authorDeviceId: "a-fake-device", ...(args.data ?? {}) };
      },
    },
  };
  const tracker = await fakeTracker(project);
  const at = tempRoom("plan-scope-run-");
  execFileSync("git", ["init", "-q", at]);
  mkdirSync(join(at, "plugin", "src"), { recursive: true });
  copyFileSync(new URL("../../../../.forge.json", import.meta.url), join(at, ".forge.json"));
  const worked = realpathSync(at);
  const held = () => {
    const was = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tracker.env.XDG_CONFIG_HOME;
    const rows = scopeHeld(worked);
    process.env.XDG_CONFIG_HOME = was;
    return rows;
  };
  try {
    for (const again of [1, 2]) {
      assert.ok(again && (await ranAsync(FORGE, ["claim", "ISS-77", "--unheld"], tracker.env, worked)).status === 0);
    }
    assert.deepEqual(held().map((one) => one.ref), ["ISS-77"], "the claim is what first holds the scope");
    assert.equal(namesPath(held()[0].named, GREW), false, "and the plan does not name the file yet");
    const wrote = await ranAsync(FORGE, ["record", "correction", "ISS-77",
      "--moved", `the change also wrote ${GREW}`, "--why", "the helper had no home",
      "--also", "decision", "--decision", "a reading | its assumption | its undo"],
    tracker.env, worked);
    assert.notEqual(wrote.status, 0, "the call failed");
    assert.equal(namesPath(held()[0].named, GREW), true, "and the correction that landed is held all the same");
  } finally {
    tracker.close();
  }
});

test("a record whose scope can be neither written nor removed says so, and names the way through", async () => {
  const at = tempRoom("plan-scope-blocked-");
  execFileSync("git", ["init", "-q", at]);
  copyFileSync(new URL("../../../../.forge.json", import.meta.url), join(at, ".forge.json"));
  const worked = realpathSync(at);
  const issue = { documentId: "blocked-uuid", issueId: "ISS-88", status: "in_progress",
    title: "a run whose config directory will not take a write", plan: typedPlan(),
    acceptanceCriteria: "1. The one outcome." };
  const project = {
    issues: [issue],
    comments: { "blocked-uuid": [] },
    answer: {
      forge_issues: (args) => {
        if (args.action === "list") return { issues: [issue], returned: 1, hasMore: false };
        if (args.action === "get") return issue;
        if (args.action === "update") return Object.assign(issue, args.data);
        return { documentId: args.documentId, ...(args.data ?? {}) };
      },
    },
  };
  const tracker = await fakeTracker(project);
  try {
    for (const again of [1, 2]) {
      assert.ok(again && (await ranAsync(FORGE, ["claim", "ISS-88", "--unheld"], tracker.env, worked)).status === 0);
    }
    /* A file where the directory has to be: every write and every removal under it fails, which is
       the one shape that leaves a correction landed and the cache it should have cleared standing. */
    rmSync(join(tracker.env.XDG_CONFIG_HOME, "forge", "plan-scope"), { recursive: true, force: true });
    writeFileSync(join(tracker.env.XDG_CONFIG_HOME, "forge", "plan-scope"), "not a directory");
    const wrote = await ranAsync(FORGE, ["record", "correction", "ISS-88",
      "--moved", "the change also wrote grew.mjs", "--why", "the helper had no home"], tracker.env, worked);
    assert.equal(wrote.status, 0, wrote.stderr);
    assert.match(wrote.stderr, /could not be written or removed/u);
    assert.match(wrote.stderr, /forge hooks --off plan-scope/u);
  } finally {
    tracker.close();
  }
});
