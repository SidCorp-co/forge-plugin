/* One verb for one write. `forge comment` took over what `forge new --into` did, so the lease on the
   record and not the verb typed decides what a post renews — and the reply says which, because a
   caller who thought they held the issue learns it here or not at all (ISS-348). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome, tempRoom } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("comment-verb").path;
const room = tempRoom("comment-verb-");
const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const MINE = "this-run";
const BODY = "The refusal names the flag and not the file.";

const state = {
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [{ documentId: "uuid-348", issueId: "ISS-348", status: "in_progress", title: "one verb per write", description: "x" }],
  comments: { "uuid-348": [] },
  calls: [],
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "update") state.issues[0] = { ...state.issues[0], ...args.data };
      return state.issues[0];
    },
    forge_comments: (args) => {
      if (args.action === "list") {
        const rows = state.comments["uuid-348"];
        return { comments: rows, returned: rows.length, limit: rows.length, hasMore: false };
      }
      const row = { documentId: `c-${state.comments["uuid-348"].length + 1}`, ...args.data };
      state.comments["uuid-348"] = [...state.comments["uuid-348"], row];
      return row;
    },
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const env = (session = MINE) => ({ ...tracker.env, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: session });

const heldBy = (who) => {
  if (!who) delete state.issues[0].sessionContext;
  else {
    state.issues[0].sessionContext = {
      lease: { holder: who, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] },
    };
  }
};

const bodyAt = (text = BODY) => {
  const path = join(room, "body.md");
  writeFileSync(path, `${text}\n`);
  return path;
};

/* The gate delivers what this session has not been shown and the re-send writes, which is the
   comment verb's own rule and not this file's subject. */
const posted = async (session, ...argv) => {
  state.calls = [];
  let run = await ranAsync(FORGE, ["comment", "ISS-348", bodyAt(), ...argv], env(session));
  if (run.status !== 0 && /Hold —/u.test(run.stderr)) {
    run = await ranAsync(FORGE, ["comment", "ISS-348", bodyAt(), ...argv], env(session));
  }
  return run;
};

const lastComment = () => state.comments["uuid-348"].at(-1);
const renewedAt = () => state.issues[0].sessionContext?.lease?.renewedAt ?? null;

test("a comment is posted, and its body is the file's own where no title is given", async () => {
  heldBy(null);
  const run = await posted(MINE);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(lastComment().body.trim(), BODY, "no heading is framed over a body nobody titled");
});

test("--title frames the title as a heading over the body, which is what --into did", async () => {
  heldBy(null);
  const run = await posted(MINE, "--title", "What the finder had nowhere to put");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(lastComment().body, `## What the finder had nowhere to put\n\n${BODY}\n`);
});

test("a holder's post renews the lease, and the reply says it did", async () => {
  heldBy(MINE);
  const before = renewedAt();
  const run = await posted(MINE);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /The lease on ISS-348 is yours and this post renewed it\./u);
  assert.notEqual(renewedAt(), before, "and the window started again");
});

/* The half `forge comment` refused before this issue and `forge new --into` did instead: a finding
   on an issue somebody else is working is still a finding, and it claims nothing. */
test("a finder's post is made rather than refused, and renews nothing", async () => {
  heldBy("the-other-run");
  const before = renewedAt();
  const run = await posted(MINE);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(lastComment(), "the finding landed");
  assert.equal(renewedAt(), before, "and the other run's lease is exactly as it wrote it");
});

test("the reply says a finder's post took no lease, naming the issue", async () => {
  heldBy("the-other-run");
  const run = await posted(MINE);
  assert.match(run.stdout, /No lease on ISS-348 is yours, so this post is a finder's and renewed none\./u);
  assert.doesNotMatch(run.stdout, /renewed it/u, "and never both lines at once");
});

test("the id it posted is the last line, read back from the tracker", async () => {
  heldBy(null);
  const run = await posted(MINE);
  const last = run.stdout.trimEnd().split("\n").at(-1);
  assert.match(last, /is posted on ISS-348, read back from the tracker\./u);
});

/* The one state the finder branch does not reach. A lapsed lease is the one another run may take, so
   `renew` reads the field again inside the write; between the two reads this stops being a finder
   finding something and becomes a run writing over a handoff, and it is refused for that. */
test("a lease another run holds live by the second read is refused, and nothing of theirs moves", async () => {
  const theirs = {
    holder: "the-other-run", agent: "a-test-agent", pid: "4242",
    renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [],
  };
  /* The handoff is hung on the read that saw the lapsed lease rather than on a call count, so a read
     the verb makes for some other reason cannot spend the swap before the write has taken it. */
  const held = state.answer.forge_issues;
  state.answer.forge_issues = (args) => {
    const out = held(args);
    if (out?.sessionContext?.lease?.holder !== MINE) return out;
    const snapshot = { ...out, sessionContext: { lease: { ...out.sessionContext.lease } } };
    state.issues[0].sessionContext = { lease: theirs };
    return snapshot;
  };
  const attempt = async () => {
    heldBy(MINE);
    state.issues[0].sessionContext.lease.renewedAt = new Date(Date.now() - 90 * 60_000).toISOString();
    return ranAsync(FORGE, ["comment", "ISS-348", bodyAt()], env(MINE));
  };
  try {
    const before = state.comments["uuid-348"].length;
    let run = await attempt();
    if (/Hold —/u.test(run.stderr)) run = await attempt();
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /ISS-348 is held by another run/u);
    assert.equal(state.comments["uuid-348"].length, before, "a refused post left a comment behind");
    assert.equal(renewedAt(), theirs.renewedAt, "and the other run's lease is as that run wrote it");
  } finally {
    state.answer.forge_issues = held;
  }
});

test("a flag that belongs to a filing is this verb's own unknown flag", async () => {
  heldBy(null);
  const run = await ranAsync(FORGE, ["comment", "ISS-348", bodyAt(), "--kind", "bug"], env());
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No comment flag named --kind\. The set is --title\./u);
});
