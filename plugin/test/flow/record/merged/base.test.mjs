/* `--at` is checked against the base branch as this checkout has it fetched — `origin/<branch>`, and
   never a local branch that may be stale — so a sha that exists only on the builder's own branch
   cannot pass as a merge to master (ISS-2841, ISS-1480). Where this checkout has not fetched that
   branch at all there is nothing to read the ancestry off, and the mark stands exactly as it did
   before this fix; where it has, and the sha is not there, the mark is refused and told the route a
   project's ship mode leaves the builder — the checkpoint under `ready`, landing it for real under
   any other mode. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { git, projectRecord, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { OWN, trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("record-merged-base").path;

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

/* A base commit, a branch merged onto master for real (`AT`), and a commit that stays on the
   branch alone (`UNLANDED`) — the shape ISS-1480 hit, where a mark named a sha that existed only
   there. */
const ROOM = tempRoom("record-merged-base-repo-");
spawnSync("git", ["init", "-q", "-b", "master", ROOM], { cwd: ROOM, encoding: "utf8" });
const wrote = (file, text) => {
  writeFileSync(join(ROOM, file), text);
  git(ROOM, "add", file);
};
const commit = (message) => {
  git(ROOM, "commit", "-qm", message);
  return git(ROOM, "rev-parse", "HEAD").stdout.trim();
};
wrote("a.txt", "base\n");
commit("base");
git(ROOM, "checkout", "-qb", "change");
wrote("a.txt", "the change\n");
const JUDGED = commit("the change");
git(ROOM, "checkout", "-q", "master");
git(ROOM, "merge", "-q", "--no-ff", "-m", "merge the change", "change");
const AT = git(ROOM, "rev-parse", "HEAD").stdout.trim();
git(ROOM, "checkout", "-q", "change");
wrote("a.txt", "work the branch alone carries\n");
const UNLANDED = commit("work the branch alone carries");

let clock = 0;
const stamped = () => `2026-09-08T11:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const ISSUE = {
  documentId: "merged-base-uuid",
  issueId: "ISS-99",
  status: "in_progress",
  title: "a merge mark checked against the base branch as fetched",
  description: "no plan needed for this suite",
  complexity: "s",
};

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      state.calls.push(args);
      if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
      if (args.action === "get") return ISSUE;
      if (args.action === "update") return Object.assign(ISSUE, args.data);
      if (args.action === "mark_merged") {
        (state.comments[args.data.issueId] ??= []).push({
          documentId: `mark-${clock + 1}`, createdAt: stamped(), authorId: "agent",
          body: `mark_merged target=${args.data.target} — ${args.data.note}`,
        });
        return { ...ISSUE, mergedAt: stamped() };
      }
      if (args.action === "unmark") {
        state.comments[args.data.issueId] = [];
        return { ...ISSUE, mergedAt: null };
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = { documentId: `c-${clock + 1}`, createdAt: stamped(), authorId: "agent", body: args.data.body };
        (state.comments[args.data.issue] ??= []).push(one);
        return { documentId: one.documentId };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};

const { tracker, env: ENV } = await trackerFor(state, [ROOM]);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-99", "--unheld"], ENV, ROOM);

const mark = (...argv) => ranAsync(FORGE, ["record", "merged", "ISS-99", ...argv], ENV, ROOM);
const page = () => state.comments[ISSUE.documentId] ?? [];
const flagsAt = (at) => ["--at", at, "--reviewed", JUDGED, "--judged", JUDGED, "--wrote", "a.txt"];

test.beforeEach(() => {
  state.comments[ISSUE.documentId] = [];
  state.calls = [];
  git(ROOM, "update-ref", "-d", "refs/remotes/origin/master");
});

test("no origin/master fetched here: the mark stands exactly as it did before this fix", async () => {
  const run = await mark(...flagsAt(UNLANDED));
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(page().at(-1).body, /merged to master at/u);
});

test("a sha origin/master does not carry is refused, and told to land it for real", async () => {
  git(ROOM, "update-ref", "refs/remotes/origin/master", AT);
  const run = await mark(...flagsAt(UNLANDED));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--at [0-9a-f]+ is refused: origin\/master stands at [0-9a-f]{7} and does not carry it/u,
    run.stderr);
  assert.match(run.stderr, /this mark would claim a merge that never happened/u);
  assert.match(run.stderr, /Land it onto master for real — merge it and push — then mark it again/u,
    "this project's ship mode is unset, which falls back to `self`");
  assert.match(run.stderr, /forge record merged ISS-99/u, "the shape to mark it again with");
  assert.equal(state.calls.some((one) => one.action === "mark_merged"), false, "nothing was written");
  assert.deepEqual(page(), []);
});

test("a sha origin/master does carry is marked merged", async () => {
  git(ROOM, "update-ref", "refs/remotes/origin/master", AT);
  const run = await mark(...flagsAt(AT));
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(page().at(-1).body, new RegExp(`merged to master at ${AT}`, "u"));
});

test("a local branch or tag named after the remote-tracking ref does not stand in for it", async () => {
  git(ROOM, "update-ref", "refs/remotes/origin/master", AT);
  git(ROOM, "branch", "origin/master", UNLANDED);
  git(ROOM, "tag", "origin/master", UNLANDED);
  try {
    const run = await mark(...flagsAt(UNLANDED));
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /origin\/master stands at [0-9a-f]{7} and does not carry it/u, run.stderr);
    assert.equal(state.calls.some((one) => one.action === "mark_merged"), false);
  } finally {
    git(ROOM, "tag", "-d", "origin/master");
    git(ROOM, "branch", "-D", "origin/master");
  }
});

test("a remote-tracking ref that names no commit cannot tell either, and is not read as absent", async () => {
  const BLOB = git(ROOM, "hash-object", "-w", "a.txt").stdout.trim();
  git(ROOM, "update-ref", "refs/remotes/origin/master", BLOB);
  try {
    const run = await mark(...flagsAt(UNLANDED));
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /nothing here can tell whether it carries that commit/u, run.stderr);
    assert.match(run.stderr, /could not read as a commit here/u, run.stderr);
    assert.equal(state.calls.some((one) => one.action === "mark_merged"), false,
      "an unreadable ref is not the same as an unfetched one, and is not read as leave-alone");
  } finally {
    git(ROOM, "update-ref", "-d", "refs/remotes/origin/master");
  }
});

test("a shallow checkout cannot tell, and the refusal says so rather than guessing", async () => {
  git(ROOM, "update-ref", "refs/remotes/origin/master", AT);
  const shallow = tempRoom("record-merged-base-shallow-");
  spawnSync("git", ["clone", "-q", "--depth", "1", "--branch", "master", `file://${ROOM}`, shallow],
    { cwd: dirname(shallow), encoding: "utf8" });
  projectRecord(shallow, ENV.HOME, OWN);
  const run = await ranAsync(FORGE, ["record", "merged", "ISS-99",
    "--at", AT, "--reviewed", AT, "--judged", AT, "--wrote", "a.txt"], ENV, shallow);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /nothing here can tell whether it carries that commit: .*shallow/u, run.stderr);
  assert.equal(state.calls.some((one) => one.action === "mark_merged"), false);
});

test("under a project whose ship mode leaves the landing to another actor, the refusal points at the checkpoint", async () => {
  git(ROOM, "update-ref", "refs/remotes/origin/master", AT);
  projectRecord(ROOM, ENV.HOME, { ...OWN, ship: "ready" });
  try {
    const run = await mark(...flagsAt(UNLANDED));
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /This project's ship mode leaves the landing to another actor/u, run.stderr);
    assert.match(run.stderr, /marking this merged is not the builder's to do/u);
    assert.match(run.stderr, /forge claim ISS-99 --pushed --ready/u, "the one route left to the builder");
    assert.equal(state.calls.some((one) => one.action === "mark_merged"), false);
  } finally {
    projectRecord(ROOM, ENV.HOME, OWN);
  }
});
