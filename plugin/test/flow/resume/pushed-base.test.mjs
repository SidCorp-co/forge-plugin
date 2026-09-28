/* A `--pushed` capture measured its base against the remote's default branch while the landing read
   the branch the project declares a change lands on, so on a project landing on `staging` every file
   between the two branches was recorded as touched and copied into the landing checkpoint
   (ISS-1217). Each case stands a checkout up whose `origin/master` and `origin/staging` diverge, so a
   base read off the wrong one names files this change never touched. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectRecord, tempRoom } from "../../fixtures.mjs";

const state = {
  declared: null,
  unread: false,
  answer: {
    /* `unread` answers with no config on it, which is how a reading that did not happen reaches the policy. */
    forge_config: (args) => {
      if (args.action !== "get") return undefined;
      if (state.unread) return {};
      return { config: { baseBranch: state.declared, releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } } };
    },
  },
};
const SLUGS = ["declares-staging", "staging-unfetched", "declares-none", "record-too", "config-unread"];
state.answer["forge_projects.list"] = () => ({
  projects: SLUGS.map((slug, at) => ({ slug, id: `1e1c1a1e-0000-4000-8000-00000000000${at + 1}` })),
});
const tracker = await fakeTracker(state);
for (const [name, value] of Object.entries(tracker.env)) process.env[name] = value;
test.after(() => tracker.close());

const { patchFrom, unwrittenSaid } = await import("../../../src/flow/worklog.mjs");
const { pullRun } = await import("../../../src/flow/record/rung.mjs");
const { useProject } = await import("../../../src/resolve/settings.mjs");

const run = (cwd, ...args) => spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args],
  { cwd, encoding: "utf8" });
const commit = (cwd, file) => {
  writeFileSync(join(cwd, file), `${file}\n`);
  run(cwd, "add", file);
  run(cwd, "commit", "-qm", file);
  return run(cwd, "rev-parse", "HEAD").stdout.trim();
};

/* master carries one commit staging does not, and the branch is cut from staging: the files a change
   touches are `change.txt` alone, and a base read off master adds `staging-only.txt` to them. */
const diverged = (slug, { fetched = true } = {}) => {
  const at = tempRoom(`pushed-base-${slug}-`);
  run(at, "init", "--bare", "-q", "origin.git");
  run(at, "clone", "-q", join(at, "origin.git"), "work");
  const work = join(at, "work");
  commit(work, "root.txt");
  run(work, "push", "-q", "origin", "HEAD:master");
  run(work, "checkout", "-q", "-b", "staging");
  const fork = commit(work, "staging-only.txt");
  run(work, "push", "-q", "origin", "staging");
  run(work, "checkout", "-q", "-b", "iss-1217", "staging");
  commit(work, "change.txt");
  run(work, "remote", "set-head", "origin", "master");
  if (!fetched) run(work, "update-ref", "-d", "refs/remotes/origin/staging");
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
  const master = run(work, "rev-parse", "refs/remotes/origin/master").stdout.trim();
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
    const master = run(work, "rev-parse", "refs/remotes/origin/master").stdout.trim();
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
