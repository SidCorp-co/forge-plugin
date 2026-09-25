/* The rig the landing's verb cases run on: a fake tracker holding one issue, two pushed branches to
   capture, and the runner that sends a claim twice past the read-before-write gate. Apart from the
   cases because the rig and the cases grew past one file's ceiling together (ISS-2439). */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import test from "node:test";

import { projectRecord, projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("landing-take").path;
/* Away from this checkout, whose git directory names the run this suite is written under: a
   checkout of its own names none, and its project is a record beside the machine's own keys
   rather than a file in the tree. */
const AWAY = projectRoom(tempRoom("landing-take-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);
const { leaseOf } = await import("../../../src/flow/lease.mjs");
const { landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
export const BUILDER = "the-builder-run";
export const LANDER = "the-lander-run";

export const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: room, encoding: "utf8" });

/* What `--pushed` reads: a base a remote head names, and a diff above it. The remote ref is written
   by hand because a fixture with a real remote is a second repository for one merge-base. */
const pushedRepo = (files) => {
  const room = tempRoom("landing-repo-");
  spawnSync("git", ["init", "-q", "-b", "iss-673-6", room], { cwd: dirname(room), encoding: "utf8" });
  writeFileSync(join(room, "base.txt"), "the base\n");
  git(room, "add", "base.txt");
  git(room, "commit", "-qm", "base");
  git(room, "update-ref", "refs/remotes/origin/master", git(room, "rev-parse", "HEAD").stdout.trim());
  for (const one of files) writeFileSync(join(room, one), `${one}, changed\n`);
  if (files.length) {
    git(room, "add", ...files);
    git(room, "commit", "-qm", "the change");
  }
  return room;
};

export const CHANGED = pushedRepo(["one.mjs", "two.mjs"]);
export const NOTHING = pushedRepo([]);

const ISSUE = {
  documentId: "landing-uuid",
  issueId: "ISS-673",
  status: "developed",
  title: "one flow: the ready checkpoint and the handoff",
  description: "no mark here",
};
export const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { "landing-uuid": [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "update" || args.action === "transition") {
        state.issues[0] = { ...state.issues[0], ...args.data };
      }
      return state.issues[0];
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        state.comments["landing-uuid"].push({ documentId: `c-${state.comments["landing-uuid"].length + 1}`, createdAt: "2026-09-07T12:00:00.000Z", authorId: "agent", body: args.data.body });
        return { documentId: `c-${state.comments["landing-uuid"].length}` };
      }
      const held = state.comments["landing-uuid"];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state, [AWAY]);
const CHILD_HOME = ENV.HOME;
for (const one of [CHANGED, NOTHING]) projectRecord(one, CHILD_HOME, { slug: "forge-plugin" });
test.after(() => tracker.close());

const asRun = (id) => ({ ...ENV, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: id });
/* The id a whole wave carries: no `FORGE_SESSION_ID`, so every run of it reads the dispatcher's. */
export const asWave = (id) => {
  const env = { ...asRun(id), CLAUDE_CODE_SESSION_ID: id };
  delete env.FORGE_SESSION_ID;
  return env;
};
export const held = () => leaseOf(state.issues[0].sessionContext);
export const checkpoint = () => landingOf(state.issues[0].sessionContext);

export const lease = (holder, minutes = 30) => ({
  holder, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes, next: null, history: [],
});

/* Each case starts from the field it is about, so no case reads through the one before it. */
export const field = (landing, leased) => {
  state.issues[0] = { ...ISSUE };
  if (landing || leased) state.issues[0].sessionContext = { ...(leased ? { lease: leased } : {}), ...(landing ? { landing } : {}) };
  state.comments["landing-uuid"] = [];
};

export const BUILT = {
  state: "ready",
  builder: BUILDER,
  branch: "iss-673-6",
  head: "9e24c2af0000000000000000000000000000abcd",
  base: "c4890050000000000000000000000000000dcba",
  files: ["one.mjs", "two.mjs"],
  at: "2026-09-07T12:00:00.000Z",
};

/* The read-before-write gate delivers a comment this session has not been shown and refuses once;
   the same command sent again lands. That hold is not this file's subject, and neither is the
   other: every case here starts from a field holding no lease at `developed`, which is the record
   a claim refuses without `--unheld` (ISS-1184), and the flag says nothing about any state a
   checkpoint names. */
export const ran = async (argv, id, cwd = process.cwd(), env = asRun) => {
  const sent = argv[0] === "claim" ? [...argv, "--unheld"] : argv;
  let run = null;
  for (const again of [1, 2]) {
    run = await ranAsync(FORGE, sent, env(id), cwd);
    if (run.status === 0 || again === 2) return run;
  }
  return run;
};
