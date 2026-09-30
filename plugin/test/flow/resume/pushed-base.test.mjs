/* A `--pushed` capture measured its base against the remote's default branch while the landing read
   the branch the project declares a change lands on, so on a project landing on `staging` every file
   between the two branches was recorded as touched and copied into the landing checkpoint
   (ISS-1217). Each case stands a checkout up whose `origin/master` and `origin/staging` diverge, so a
   base read off the wrong one names files this change never touched. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, git, projectRecord, tempRoom } from "../../fixtures.mjs";

const state = {
  declared: null,
  model: "publish",
  unread: false,
  answer: {
    /* `unread` answers with no config on it, which is how a reading that did not happen reaches the policy. */
    forge_config: (args) => {
      if (args.action !== "get") return undefined;
      if (state.unread) return {};
      return { config: { baseBranch: state.declared, releaseModel: state.model, pipelineConfig: { autoProdDeploy: false } } };
    },
  },
};
const SLUGS = ["declares-staging", "staging-unfetched", "declares-none", "record-too", "config-unread",
  "merge-landed", "synced-landed", "two-forks", "just-cut", "promotes", "ready-landed"];
state.answer["forge_projects.list"] = () => ({
  projects: SLUGS.map((slug, at) => ({ slug, id: `1e1c1a1e-0000-4000-8000-00000000000${at + 1}` })),
});
const tracker = await fakeTracker(state);
for (const [name, value] of Object.entries(tracker.env)) process.env[name] = value;
test.after(() => tracker.close());

const { patchFrom, unwrittenSaid } = await import("../../../src/flow/worklog.mjs");
const { pullRun } = await import("../../../src/flow/record/rung.mjs");
const { refusing, useProject } = await import("../../../src/resolve/settings.mjs");
const { readyCheckpoint } = await import("../../../src/flow/landing/written.mjs");

const commit = (cwd, file) => {
  writeFileSync(join(cwd, file), `${file}\n`);
  git(cwd, "add", file);
  git(cwd, "commit", "-qm", file);
  return git(cwd, "rev-parse", "HEAD").stdout.trim();
};

/* master carries one commit staging does not, and the branch is cut from staging: the files a change
   touches are `change.txt` alone, and a base read off master adds `staging-only.txt` to them. */
const diverged = (slug, { fetched = true } = {}) => {
  const at = tempRoom(`pushed-base-${slug}-`);
  git(at, "init", "--bare", "-q", "origin.git");
  git(at, "clone", "-q", join(at, "origin.git"), "work");
  const work = join(at, "work");
  commit(work, "root.txt");
  git(work, "push", "-q", "origin", "HEAD:master");
  git(work, "checkout", "-q", "-b", "staging");
  const fork = commit(work, "staging-only.txt");
  git(work, "push", "-q", "origin", "staging");
  git(work, "checkout", "-q", "-b", "iss-1217", "staging");
  commit(work, "change.txt");
  git(work, "remote", "set-head", "origin", "master");
  if (!fetched) git(work, "update-ref", "-d", "refs/remotes/origin/staging");
  projectRecord(work, process.env.XDG_CONFIG_HOME, { slug });
  return { work, fork };
};

const standingIn = async (room, slug, take) => {
  const was = process.cwd();
  process.chdir(room);
  useProject({ slug, from: `the project record under ${room}` });
  try {
    return await take();
  } finally {
    process.chdir(was);
  }
};

test("on a project declaring the branch a change lands on, the capture's base and touched set are read against it", async () => {
  state.declared = "staging";
  const { work, fork } = diverged("declares-staging");
  const block = await standingIn(work, "declares-staging", () => patchFrom({ pushed: true }));
  assert.equal(block.base, fork, "the merge-base with origin/staging, not with the remote's default");
  assert.equal(block.touched, "change.txt", "and only the file the change touched");
  assert.equal(block.files, 1);
});

test("a declared branch this checkout holds no ref of leaves no base and no touched set, and says to fetch", async () => {
  state.declared = "staging";
  const { work } = diverged("staging-unfetched", { fetched: false });
  const said = [];
  const error = console.error;
  console.error = (line) => said.push(String(line));
  let block;
  try {
    block = await standingIn(work, "staging-unfetched", async () => {
      const made = await patchFrom({ pushed: true });
      unwrittenSaid();
      return made;
    });
  } finally {
    console.error = error;
  }
  assert.equal(block.base, null, "no base guessed from the remote's default");
  assert.equal(block.touched, null, "and no touched set measured from one");
  assert.ok(said.some((line) => line.includes("no base") && line.includes("git fetch origin")),
    `the --pushed line names what settles it:\n${said.join("\n")}`);
});

test("a project read to declare no branch measures the base against the remote's recorded default, as before", async () => {
  state.declared = null;
  const { work } = diverged("declares-none");
  const master = git(work, "rev-parse", "refs/remotes/origin/master").stdout.trim();
  const block = await standingIn(work, "declares-none", () => patchFrom({ pushed: true }));
  assert.equal(block.base, master, "origin/HEAD names master here, and that is what it reads");
  assert.deepEqual(block.touched.split(", ").sort(), ["change.txt", "staging-only.txt"]);
});

/* A capture is not terminal, so an unsettled reading keeps the guess it always made rather than
   refusing every `--pushed` the way a landing refuses to end over one (AC-03-6-20). */
test("an unsettled reading — no project named, or a configuration that did not read — keeps the remote's recorded default", async () => {
  state.declared = "staging";
  for (const [slug, unread] of [[undefined, false], ["config-unread", true]]) {
    state.unread = unread;
    const { work } = diverged(slug ?? "no-project");
    const master = git(work, "rev-parse", "refs/remotes/origin/master").stdout.trim();
    const error = console.error;
    console.error = () => {};
    try {
      const block = await standingIn(work, slug, () => patchFrom({ pushed: true }));
      assert.equal(block.base, master, `${slug ?? "no project"}: the remote's recorded default, not the declared branch`);
    } finally {
      console.error = error;
      state.unread = false;
    }
  }
});

test("`forge record --pushed` captures the same base and touched set as `forge claim --pushed`", async () => {
  state.declared = "staging";
  const { work, fork } = diverged("record-too");
  const [claimed, recorded] = await standingIn(work, "record-too", async () => [
    await patchFrom({ pushed: true }),
    (await pullRun([{ kind: "note", argv: ["--pushed"] }])).patch,
  ]);
  assert.equal(recorded.base, fork);
  assert.equal(recorded.base, claimed.base);
  assert.equal(recorded.touched, claimed.touched);
});

/* The branch the landing already took in: its own head is then its merge-base with the landing
   branch, and the base is read off the merge that brought it in (ISS-1862). */
const at = (cwd) => git(cwd, "rev-parse", "HEAD").stdout.trim();
const landed = (slug, { synced = false } = {}) => {
  const { work, fork } = diverged(slug);
  git(work, "checkout", "-q", "staging");
  const moved = commit(work, "landed-since.txt");
  git(work, "checkout", "-q", "iss-1217");
  if (synced) git(work, "merge", "-q", "--no-ff", "-m", "sync", "staging");
  commit(work, "second.txt");
  const head = at(work);
  git(work, "checkout", "-q", "staging");
  git(work, "merge", "-q", "--no-ff", "-m", "land", "iss-1217");
  git(work, "push", "-q", "origin", "staging");
  git(work, "checkout", "-q", "iss-1217");
  return { work, fork, moved, head };
};

const capturing = (work, slug) => standingIn(work, slug, () => patchFrom({ pushed: true }));

const saying = async (take) => {
  const said = [];
  const error = console.error;
  console.error = (line) => said.push(String(line));
  try {
    return { made: await take(), said: said.join("\n") };
  } finally {
    console.error = error;
  }
};

test("a branch the landing branch merged is measured from where it was cut, not from its own head", async () => {
  state.declared = "staging";
  const { work, fork, head } = landed("merge-landed");
  const block = await capturing(work, "merge-landed");
  assert.equal(block.head, head);
  assert.equal(block.base, fork, "the commit the branch was cut from, which the merge's first parent names");
  assert.deepEqual(block.touched.split(", ").sort(), ["change.txt", "second.txt"], "the branch's own files and no other");
});

test("a branch that merged the landing branch in before it landed is measured from that merge's commit", async () => {
  state.declared = "staging";
  const { work, moved } = landed("synced-landed", { synced: true });
  const block = await capturing(work, "synced-landed");
  assert.equal(block.base, moved, "the landing commit it last took in, so that commit's files stay the landing's");
  assert.deepEqual(block.touched.split(", ").sort(), ["change.txt", "second.txt"]);
});

test("merges naming different points the head stood at leave no base, and the line says why", async () => {
  state.declared = "staging";
  const { work } = landed("two-forks");
  const head = at(work);
  git(work, "checkout", "-q", "-b", "side", "master");
  commit(work, "side.txt");
  git(work, "merge", "-q", "--no-ff", "-m", "side takes it", head);
  git(work, "checkout", "-q", "staging");
  git(work, "merge", "-q", "--no-ff", "-m", "side lands", "side");
  git(work, "push", "-q", "origin", "staging");
  git(work, "checkout", "-q", "iss-1217");
  const { made, said } = await saying(() => standingIn(work, "two-forks", async () => {
    const block = await patchFrom({ pushed: true });
    unwrittenSaid();
    return block;
  }));
  assert.equal(made.base, null, "no base out of two that disagree");
  assert.equal(made.touched, null);
  assert.match(said, /different points it stood at/u, said);
});

test("a branch just cut keeps its head as its base, and the line names both readings that leave that", async () => {
  state.declared = "staging";
  const { work } = diverged("just-cut");
  git(work, "checkout", "-q", "-b", "iss-cut", "origin/staging");
  const { made, said } = await saying(() => standingIn(work, "just-cut", async () => {
    const block = await patchFrom({ pushed: true });
    unwrittenSaid();
    return block;
  }));
  assert.equal(made.base, made.head);
  assert.equal(made.touched, null);
  assert.match(said, /a branch just cut and a branch landed by a fast-forward both read/u, said);
});

/* finding 62413215: the same reading under the release model that promotes staging to the live branch. */
test("on a promote project the capture of a staging-cut branch is measured from the staging fork", async () => {
  state.declared = "staging";
  state.model = "promote";
  try {
    const { work, fork } = diverged("promotes");
    const block = await capturing(work, "promotes");
    assert.equal(block.base, fork, "the staging fork, not the live branch's");
    assert.equal(block.touched, "change.txt");
  } finally {
    state.model = "publish";
  }
});

test("--ready on a head the landing branch already carries stays refused, and says that branch carries it", async () => {
  state.declared = "staging";
  const { work, head } = landed("ready-landed");
  const patch = await capturing(work, "ready-landed");
  assert.ok(patch.touched, "the capture now holds the branch's files, so the empty set is not what refuses");
  await assert.rejects(refusing(() => readyCheckpoint("ISS-1862", "the-builder", patch, null, "in_progress")),
    (error) => error.message.includes(`already carries ${head.slice(0, 7)}`) && /--rebuilt/u.test(error.message));
});
