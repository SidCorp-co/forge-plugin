/* The cache a write-time gate reads instead of calling the tracker. Driven through its own writers
   and reader over an injected tree and clock, so no case depends on where this suite is run. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, readdirSync, statSync, utimesSync } from "node:fs";
import { dirname, join } from "node:path";

import { tempRoom } from "../../../fixtures.mjs";
import { OWN } from "../../../fixtures/own-project.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

process.env.XDG_CONFIG_HOME = join(tempRoom("plan-scope-cache-"), "config");

const { SCOPE_KEPT_MS, dropScope, noteScope, scopeDir, scopeFrom, scopeHeld, scopePath } =
  await import("../../../../src/flow/record/plan-scope.mjs");
const { namesPath } = await import("../../../../src/flow/record/merged.mjs");

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
});

/* The answer the caller acts on: `record.mjs` prints a warning naming the file and offering to turn
   the gate off, so a drop with nothing to remove has to read as the success it is. */
test("a drop with nothing to remove answers as the drop that removed something did", () => {
  noteScope("ISS-802", "gone.mjs", { tree: "/twice", now: NOW });
  assert.equal(dropScope("ISS-802", { tree: "/twice", now: NOW }), true);
  assert.equal(dropScope("ISS-802", { tree: "/twice", now: NOW }), true);
  assert.equal(dropScope("ISS-803", { tree: "/never", now: NOW }), true);
});

/* Read off the file's own mtime and not the stamp inside it, which is the branch `stale` takes. */
test("an entry the sweep already owns is dropped as a success, and left for the sweep", () => {
  noteScope("ISS-804", "old.mjs", { tree: "/swept", now: NOW });
  const at = scopePath("/swept", "ISS-804");
  const aged = (Date.now() - SCOPE_KEPT_MS - 60_000) / 1000;
  utimesSync(at, aged, aged);
  assert.equal(dropScope("ISS-804", { tree: "/swept" }), true);
  assert.ok(statSync(at, { throwIfNoEntry: false }), "the sweep owns it, so the drop leaves it standing");
});

/* A directory where the entry's file has to be: `rmSync` without `recursive` refuses it, and so
   does the second removal in the catch, which is the one shape the caller is told about. */
test("a removal the filesystem refuses is the one answer the caller is told", () => {
  const at = scopePath("/refused", "ISS-805");
  mkdirSync(join(at, "in the way"), { recursive: true });
  assert.equal(dropScope("ISS-805", { tree: "/refused" }), false);
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
  const before = readdirSync(scopeDir()).length;
  noteScope("ISS-411", "a.mjs", { tree: null, now: NOW });
  noteScope("", "a.mjs", { tree: TREE, now: NOW });
  dropScope("", { tree: TREE, now: NOW });
  assert.equal(readdirSync(scopeDir()).length, before);
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
const { realpathSync, rmSync, writeFileSync } = await import("node:fs");
const { fakeTracker, projectRecord, ranAsync, typedPlan } = await import("../../../fixtures.mjs");

/* This machine's record of the project the room belongs to, under the home the child is handed:
   every call below is project-scoped and the record is no longer a file in the tree. */
const workedUnder = (at, tracker) => {
  projectRecord(at, tracker.env.XDG_CONFIG_HOME, OWN);
  return realpathSync(at);
};

const childEnv = (tracker) => ({ ...tracker.env, HOME: tracker.env.XDG_CONFIG_HOME });

const PLANNED = "plugin/src/planned.mjs";
const GREW = "plugin/src/grew.mjs";

const scopeHeldUnder = (tracker, tree) => {
  const was = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = tracker.env.XDG_CONFIG_HOME;
  const rows = scopeHeld(tree);
  process.env.XDG_CONFIG_HOME = was;
  return rows;
};

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
  execFileSync("git", ["init", "-q", at], { cwd: dirname(at) });
  mkdirSync(join(at, "plugin", "src"), { recursive: true });
  const worked = workedUnder(at, tracker);
  const held = () => scopeHeldUnder(tracker, worked);
  try {
    for (const again of [1, 2]) {
      assert.ok(again && (await ranAsync(FORGE, ["claim", "ISS-77", "--unheld"], childEnv(tracker), worked)).status === 0);
    }
    assert.deepEqual(held().map((one) => one.ref), ["ISS-77"], "the claim is what first holds the scope");
    assert.equal(namesPath(held()[0].named, GREW), false, "and the plan does not name the file yet");
    const wrote = await ranAsync(FORGE, ["record", "correction", "ISS-77",
      "--moved", `the change also wrote ${GREW}`, "--why", "the helper had no home",
      "--also", "decision", "--decision", "a reading | its assumption | its undo"],
    childEnv(tracker), worked);
    assert.notEqual(wrote.status, 0, "the call failed");
    assert.equal(namesPath(held()[0].named, GREW), true, "and the correction that landed is held all the same");
  } finally {
    tracker.close();
  }
});

test("a record whose scope can be neither written nor removed says so, and names the way through", async () => {
  const at = tempRoom("plan-scope-blocked-");
  execFileSync("git", ["init", "-q", at], { cwd: dirname(at) });
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
  const worked = workedUnder(at, tracker);
  try {
    for (const again of [1, 2]) {
      assert.ok(again && (await ranAsync(FORGE, ["claim", "ISS-88", "--unheld"], childEnv(tracker), worked)).status === 0);
    }
    /* A file where the directory has to be: every write and every removal under it fails, which is
       the one shape that leaves a correction landed and the cache it should have cleared standing. */
    rmSync(join(tracker.env.XDG_CONFIG_HOME, "forge", "plan-scope"), { recursive: true, force: true });
    writeFileSync(join(tracker.env.XDG_CONFIG_HOME, "forge", "plan-scope"), "not a directory");
    const wrote = await ranAsync(FORGE, ["record", "correction", "ISS-88",
      "--moved", "the change also wrote grew.mjs", "--why", "the helper had no home"], childEnv(tracker), worked);
    assert.equal(wrote.status, 0, wrote.stderr);
    assert.match(wrote.stderr, /could not be written or removed/u);
    assert.match(wrote.stderr, /forge hooks --off plan-scope/u);
  } finally {
    tracker.close();
  }
});

/* The ordinary close: the entry was written from the checkout the dispatcher claimed in and the
   record is written from the run's own worktree, so there is nothing under this tree's key to
   remove. Driven through the CLI because the warning is `record.mjs`'s and not this module's. */
test("a record written while the issue is off the ladder says nothing where the tree holds no entry", async () => {
  const at = tempRoom("plan-scope-silent-");
  execFileSync("git", ["init", "-q", at], { cwd: dirname(at) });
  const issue = { documentId: "silent-uuid", issueId: "ISS-99", status: "closed",
    title: "a run posting after the close", plan: typedPlan(), acceptanceCriteria: "1. The one outcome." };
  const project = {
    issues: [issue],
    comments: { "silent-uuid": [] },
    answer: {
      forge_issues: (args) => {
        if (args.action === "list") return { issues: [issue], returned: 1, hasMore: false };
        if (args.action === "get") return issue;
        if (args.action === "update") return Object.assign(issue, args.data);
        return { documentId: args.documentId, ...(args.data ?? {}) };
      },
      forge_comments: (args) => {
        if (args.action === "list") return { comments: project.comments["silent-uuid"], returned: 0, hasMore: false };
        project.comments["silent-uuid"].push({ createdAt: "2026-09-15T00:00:00.000Z", body: args.data.body });
        return { documentId: "comment-1", authorDeviceId: "a-fake-device", ...(args.data ?? {}) };
      },
    },
  };
  const tracker = await fakeTracker(project);
  const worked = workedUnder(at, tracker);
  try {
    for (const again of [1, 2]) {
      assert.ok(again && (await ranAsync(FORGE, ["claim", "ISS-99", "--unheld"], childEnv(tracker), worked)).status === 0);
    }
    assert.equal(scopeHeldUnder(tracker, worked).length, 0, "an issue off the ladder leaves no entry to remove");
    const wrote = await ranAsync(FORGE, ["record", "gap", "ISS-99", "--none", "the method answered"], childEnv(tracker), worked);
    assert.equal(wrote.status, 0, wrote.stderr);
    assert.doesNotMatch(wrote.stderr, /could not be written or removed/u);
    assert.doesNotMatch(wrote.stderr, /hooks --off plan-scope/u);
  } finally {
    tracker.close();
  }
});

/* The other half of the same close: the entry is there and the filesystem will not give it up, which
   is the one state this module cannot leave on its own, so the escape it names is the one to take. */
test("a record whose entry cannot be removed still names the file and the way out", async () => {
  const at = tempRoom("plan-scope-stuck-");
  execFileSync("git", ["init", "-q", at], { cwd: dirname(at) });
  const issue = { documentId: "stuck-uuid", issueId: "ISS-98", status: "closed",
    title: "a run whose entry will not go", plan: typedPlan(), acceptanceCriteria: "1. The one outcome." };
  const project = {
    issues: [issue],
    comments: { "stuck-uuid": [] },
    answer: {
      forge_issues: (args) => {
        if (args.action === "list") return { issues: [issue], returned: 1, hasMore: false };
        if (args.action === "get") return issue;
        if (args.action === "update") return Object.assign(issue, args.data);
        return { documentId: args.documentId, ...(args.data ?? {}) };
      },
      forge_comments: (args) => {
        if (args.action === "list") return { comments: project.comments["stuck-uuid"], returned: 0, hasMore: false };
        project.comments["stuck-uuid"].push({ createdAt: "2026-09-15T00:00:00.000Z", body: args.data.body });
        return { documentId: "comment-1", authorDeviceId: "a-fake-device", ...(args.data ?? {}) };
      },
    },
  };
  const tracker = await fakeTracker(project);
  const worked = workedUnder(at, tracker);
  try {
    for (const again of [1, 2]) {
      assert.ok(again && (await ranAsync(FORGE, ["claim", "ISS-98", "--unheld"], childEnv(tracker), worked)).status === 0);
    }
    /* A directory where the entry's file has to be: `rmSync` without `recursive` refuses it. */
    const was = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tracker.env.XDG_CONFIG_HOME;
    const entry = scopePath(worked, "ISS-98");
    process.env.XDG_CONFIG_HOME = was;
    mkdirSync(join(entry, "in the way"), { recursive: true });
    const wrote = await ranAsync(FORGE, ["record", "gap", "ISS-98", "--none", "the method answered"], childEnv(tracker), worked);
    assert.equal(wrote.status, 0, wrote.stderr);
    assert.ok(wrote.stderr.includes(entry), wrote.stderr);
    assert.match(wrote.stderr, /could not be written or removed/u);
    assert.match(wrote.stderr, /forge hooks --off plan-scope/u);
  } finally {
    tracker.close();
  }
});
