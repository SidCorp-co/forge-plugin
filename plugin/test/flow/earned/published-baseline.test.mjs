/* The published whole-tree result, its two writers and its one reader. Every case here answers the
   question the gate's own record cannot: what result exists for a commit. The store is keyed on the
   pair, so the cases that matter most are the near misses — another commit, another project — which
   a reader falling back on the newest thing published would answer with a green from nowhere. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { fakeTracker, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { render } from "../../../src/flow/record/page.mjs";

process.env.XDG_CONFIG_HOME = tempHome("published-baseline").path;
const { HELD, PART, WROTE, citationProblem, citeForm, publishBaseline, publishedFor, publishedPath, publishedSaid }
  = await import("../../../src/flow/earned/published.mjs");
const { publishes } = await import("../../../../tools/run/publish.mjs");
const { greenHeld } = await import("../../../../tools/gates/carried.mjs");
const { recordDir } = await import("../../../../tools/gates/timing.mjs");
const { recordPass } = await import("../../../../tools/gates/ledger.mjs");
const { ledgerFor } = await import("../../../../tools/gates/ledger.mjs");
const { TEST_FILE, gateSteps } = await import("../../../../tools/gates/steps.mjs");
const { gitCommonDir, gitFiles } = await import("../../../../tools/checkout.mjs");
const { slugIfAny } = await import("../../../src/resolve/settings.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const HEAD = "43b811e2c9d0f1a3b4c5d6e7f8091a2b3c4d5e6f";
const OTHER = "0f1e2d3c4b5a69788796a5b4c3d2e1f009182736";
const PROJECT = "the-project";
const RESULT = "nothing fails: all 14 gate step(s) green at this commit";
const published = (extra = {}) => publishBaseline(
  { project: PROJECT, commit: HEAD, gate: "npm run check", result: RESULT, scope: "whole", version: "1.2.3", ...extra },
);

test("a whole-tree result is published once per commit, and a scope that is not whole is not published at all", () => {
  assert.equal(published(), WROTE);
  assert.equal(published(), HELD, "a second release at the same commit appends nothing");
  const found = publishedFor(PROJECT, HEAD);
  assert.equal(found.commit, HEAD, "the record is keyed on the commit and carries it");
  assert.equal(found.gate, "npm run check", "the command the result answers for travels with it");
  assert.equal(found.result, RESULT, "and so does what already fails, or the citing run guesses it");
  assert.equal(found.scope, "whole");
  assert.equal(found.version, "1.2.3");
  const short = published({ commit: OTHER, scope: "13 of 14" });
  assert.equal(short, PART, "a ship whose record is not wholly green publishes nothing");
  assert.equal(publishedFor(PROJECT, OTHER), null, "and nothing is written for that commit");
  assert.match(publishedSaid(PART, OTHER), /does not hold every step of the whole table green/u,
    "the reason is said rather than left as a silence that reads like a pass");
});

test("the lookup is one exact commit of one project, and never the newest thing published", () => {
  assert.equal(published(), HELD, "the first case already published this head");
  assert.equal(publishedFor(PROJECT, OTHER), null, "a commit one later is a tree nothing answered for");
  assert.equal(publishedFor("another-project", HEAD), null, "and one project's ship speaks for no other");
  /* A newer publication beside the one asked for: a reader taking the last line of the store would
     answer with this and hand a run a citation its own checkout cannot earn. */
  assert.equal(published({ commit: OTHER, version: "1.2.4" }), WROTE);
  assert.equal(publishedFor(PROJECT, HEAD).version, "1.2.3", "the older commit still answers with its own");
  assert.equal(citeForm("ISS-3", PROJECT, null), null, "a checkout with no readable head cites nothing");
  assert.equal(citeForm("ISS-3", PROJECT, "9f9f9f9"), null, "and neither does one at an unpublished head");
  const form = citeForm("ISS-3", PROJECT, HEAD);
  assert.match(form, /^forge record baseline ISS-3 /u);
  assert.match(form, new RegExp(`--commit ${HEAD} --scope whole`, "u"), "the write names the commit published");
  assert.match(form, /--cited "the ship's gate at release 1\.2\.3"/u, "and says whose result it is");
  assert.match(form, /--result "nothing fails/u, "carrying what already fails, from the record and not from memory");
});

test("a citation names a commit something published, or it is refused before the payload is sent", () => {
  const bare = { cited: "the ship's gate", commit: OTHER, gate: "npm run check" };
  assert.equal(citationProblem("ISS-3", PROJECT, { ...bare, commit: HEAD }), null, "a published commit passes");
  assert.equal(citationProblem("ISS-3", PROJECT, { cited: undefined, commit: "9f9f9f9" }), null,
    "and a baseline citing nothing is no citation to judge");
  const said = citationProblem("ISS-3", "no-such-project", bare);
  assert.match(said, /Nothing is published for 0f1e2d3c/u, "the refusal names the commit it looked for");
  assert.match(said, /only a ship publishes one/u, "and why a run cannot supply one itself");
  assert.match(said, /forge record baseline ISS-3 --gate "npm run check"/u, "with the fresh run to spend instead");
});

/* A repository of its own with a bare remote behind it, so the head the ship speaks for is a head
   something else really holds. The whole-table reading is a parameter of the ship's own step, because
   `greenHeld` reads the step table of this repository and the ledger every worktree of it shares: a
   case driving the whole outcome through the live reader would have to write into that shared record
   to reach it, and the case above proves that reader against the record instead. */
const repo = () => {
  const room = tempRoom("published-ship-");
  const bare = tempRoom("published-remote-");
  const as = (...args) => spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", "--bare", bare], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", "-b", "master", room], { encoding: "utf8" });
  writeFileSync(join(room, "package.json"), JSON.stringify({ name: "shipped", version: "9.9.9" }));
  as("add", ".");
  as("commit", "-qm", "base");
  as("remote", "add", "origin", bare);
  as("push", "-q", "origin", "HEAD:master");
  return { room, as, at: as("rev-parse", "HEAD").stdout.trim() };
};

const shipSays = (room, held) => {
  const lines = [];
  publishes(room, "master", "9.9.9", { say: lines.push.bind(lines), read: () => held });
  return lines.join("\n");
};

test("the ship publishes the whole-tree result for the head it pushed, and nothing where a step is not green", () => {
  const { room, at } = repo();
  assert.match(shipSays(room, { green: 13, of: 14 }), /nothing is published for/u,
    "a table one step short publishes nothing and says which commit went without");
  assert.equal(publishedFor(null, at), null, "and the store holds nothing for that head");
  assert.match(shipSays(room, { green: 14, of: 14 }), /whole-tree result is published/u);
  const stored = readFileSync(publishedPath(), "utf8").trim().split("\n").map((one) => JSON.parse(one));
  const wrote = stored.findLast((one) => one.commit === at);
  assert.equal(wrote.commit, at, "the commit is the head the ship's own git answered with");
  assert.equal(wrote.scope, "whole", "the ship is the only writer that may say the word");
  assert.equal(wrote.gate, "npm run check", "and it records the command its own gate step runs");
  assert.match(wrote.result, /all 14 gate step\(s\) green/u, "so a citing run inherits the list and guesses none of it");
  assert.equal(wrote.version, "9.9.9");
  assert.match(shipSays(room, { green: 14, of: 14 }), /already holds a published result/u,
    "and a second ship at that head writes nothing");
});

/* The leg that makes the record the ship's rather than the run's: `--from` past the push reaches this
   step with the gate green over a commit the remote has never seen. */
test("a commit the remote does not hold is published by no resume, however green the table is", () => {
  const { room, as } = repo();
  writeFileSync(join(room, "after.txt"), "committed after the push, and never pushed\n");
  as("add", "after.txt");
  as("commit", "-qm", "the resume's own commit");
  const unpushed = as("rev-parse", "HEAD").stdout.trim();
  const said = shipSays(room, { green: 14, of: 14 });
  assert.match(said, /the remote holds \w{7} for master and this tree is at/u,
    "the refusal names both heads rather than saying only that it declined");
  assert.equal(publishedFor(null, unpushed), null, "and no run's own commit becomes the next run's authority");
  as("push", "-q", "origin", "HEAD:master");
  assert.match(shipSays(room, { green: 14, of: 14 }), /whole-tree result is published/u,
    "once the remote holds it, the same tree and the same reading publish");
});

/* The live reading, proved against the one repository whose step table it is: a read and no write,
   so nothing here reaches the shared record the case above declines to touch. */
test("the whole-table reading the ship publishes from counts every step of this repository's gate", () => {
  const here = new URL("../../../../", import.meta.url).pathname;
  const files = gitFiles(here);
  const steps = gateSteps(files.filter((one) => TEST_FILE.test(one)));
  /* Against the record read independently rather than against `green <= of`, which a reader wired to
     answer zero would satisfy and which would let the ship's own default go unproven. */
  const { entries } = ledgerFor(steps, { root: here, files, runner: join(here, "tools", "gates.mjs") });
  assert.deepEqual(greenHeld(here), { green: entries.filter((step) => step.green).length, of: entries.length },
    "the live reading is the whole table's own count of green, step for step");
  assert.equal(entries.length, steps.length, "and the table it counts is the gate's whole one");
  assert.equal(recordDir(here), join(gitCommonDir(here), "gate-ledger"),
    "out of the record every worktree of this checkout shares, which is why the case above writes none");
});

/* The refusal reaching a caller, which is the half no unit test of `citationProblem` answers for:
   the record write has to ask before it posts, or the citation is up and the refusal is advice. */
const ISSUE = {
  documentId: "cited-uuid",
  issueId: "ISS-3",
  status: "approved",
  title: "the issue whose baseline cites",
  description: "no mark here",
  complexity: "m",
};
const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { "cited-uuid": [] },
  answer: {},
};
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
  if (args.action === "get") return ISSUE;
  if (args.action === "update") return Object.assign(ISSUE, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
state.answer.forge_comments = (args) => {
  if (args.action === "list") return { comments: state.comments["cited-uuid"], returned: 0, hasMore: false };
  return { documentId: `posted-${state.calls.length}`, createdAt: "2026-09-02T10:00:00.000Z", body: args.body };
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const env = { ...tracker.env, FORGE_SESSION_ID: "the-citing-run" };
const writing = (commit) => ranAsync(FORGE, ["record", "baseline", "ISS-3", "--gate", "npm run check",
  "--result", "nothing fails", "--commit", commit, "--scope", "whole", "--cited", "the ship's gate"], env);

test("a citation for a commit nothing published is refused at the write, and the refusal names the fresh run", async () => {
  assert.ok(await ranAsync(FORGE, ["claim", "ISS-3"], env), "the lease every payload write needs");
  const bad = await writing("7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c");
  assert.equal(bad.status, 1, bad.stdout);
  const both = bad.stdout + bad.stderr;
  assert.match(both, /Nothing is published for 7c7c7c7/u, "the commit it looked for is named");
  assert.match(both, /forge record baseline ISS-3 --gate "npm run check"/u, "and the run that answers instead");
  assert.equal(state.comments["cited-uuid"].length, 0, "and no citation was posted before the refusal");
  /* The same write against a commit that store does hold, under the project the CLI resolves from the
     checkout it runs in: the refusal is the lookup's and not the flag's. Published into the config
     home the subprocess is given rather than this process's, the store being one file per home. */
  const mine = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = env.XDG_CONFIG_HOME;
  assert.equal(publishBaseline(
    { project: slugIfAny(), commit: HEAD, gate: "npm run check", result: RESULT, scope: "whole" },
  ), WROTE);
  process.env.XDG_CONFIG_HOME = mine;
  const good = await writing(HEAD);
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.match(good.stdout, new RegExp(`commit: ${HEAD}`, "u"), "so the payload goes up carrying the commit cited");
});

/* Watched failing: the reader the cases above lean on, over a store that holds the near miss alone. */
test("the near-miss store the cases above are read against really is a near miss", () => {
  assert.equal(render("baseline", { gate: "g", result: "r", commit: HEAD, scope: "whole" }).includes(HEAD), true,
    "the record kind still renders the commit, which is what a citation is matched on");
  assert.notEqual(publishedFor(PROJECT, HEAD), null, "the fixture published this head");
  assert.equal(publishedFor(PROJECT, `${HEAD.slice(0, 39)}0`), null,
    "and a commit differing in one character is a different tree, so no prefix match creeps in");
});

/* The publisher's own reading, with nothing injected: a repository of its own has its own common git
   directory, so its `gate-ledger` is its own too and recording a pass in it reaches nothing this
   checkout shares. That is what makes the real `greenHeld` drivable here, and it is the only case
   that would notice that default rewired to answer zero while `greenHeld` itself stayed right. */
const WHOLE_TREE = ["plugin/test/checks/cited-paths.test.mjs", "plugin/test/checks/docs/one.test.mjs",
  "plugin/test/checks/sources-are-text.test.mjs", "plugin/test/checks/surface/level-boundary.test.mjs",
  "plugin/test/guides/contract.test.mjs"];

/* A slug this checkout's own `.forge.json` does not carry, so a publication filed under the invoking project rather than the released tree's is visible as a wrong answer and not as a coincidence. */
const SHIPPED = "a-project-that-is-not-this-one";

const gated = () => {
  const { room, as } = repo();
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: SHIPPED }));
  for (const rel of [...WHOLE_TREE, "plugin/test/flow/one.test.mjs"]) {
    mkdirSync(dirname(join(room, rel)), { recursive: true });
    writeFileSync(join(room, rel), "// a file the step table has to find\n");
  }
  as("add", ".");
  as("commit", "-qm", "the tests the table claims");
  as("push", "-q", "origin", "HEAD:master");
  return { room, as, at: as("rev-parse", "HEAD").stdout.trim() };
};

test("the publisher's own reading publishes a wholly green ledger, and nothing while the tree is dirty", () => {
  const { room, at } = gated();
  assert.notEqual(recordDir(room), recordDir(new URL("../../../../", import.meta.url).pathname),
    "the fixture's record is its own, so nothing below writes the one this checkout shares");
  const before = greenHeld(room);
  assert.ok(before.of > 0 && before.green === 0, "its ledger starts empty over a whole table");
  const say = [];
  publishes(room, "master", "9.9.9", { say: say.push.bind(say) });
  assert.match(say.join("\n"), /nothing is published for/u, "an empty record publishes nothing");
  const { dir, entries } = ledgerFor(gateSteps(WHOLE_TREE.concat("plugin/test/flow/one.test.mjs")),
    { root: room, files: gitFiles(room), runner: join(room, "tools", "gates.mjs") });
  for (const step of entries) recordPass(dir, step, 1);
  assert.deepEqual(greenHeld(room), { green: entries.length, of: entries.length }, "and now it is wholly green");
  /* The dirty half, before the clean one: a reading is of the content on disk and the record names
     HEAD, so a pushed head with uncommitted work beside it would be certified from other files. */
  writeFileSync(join(room, "uncommitted.txt"), "never committed, and never pushed\n");
  const dirty = [];
  publishes(room, "master", "9.9.9", { say: dirty.push.bind(dirty) });
  assert.match(dirty.join("\n"), /holds uncommitted work, so the gate's reading is of content no commit carries/u,
    "the refusal says why rather than only that it declined");
  assert.equal(publishedFor(SHIPPED, at), null, "and nothing is published for that head");
  rmSync(join(room, "uncommitted.txt"));
  const clean = [];
  publishes(room, "master", "9.9.9", { say: clean.push.bind(clean) });
  assert.match(clean.join("\n"), /whole-tree result is published/u, "with the tree clean again, the real reader publishes");
  assert.equal(publishedFor(SHIPPED, at).scope, "whole", "off its own ledger and no injected count");
  assert.equal(publishedFor(slugIfAny(), at), null,
    "and under the released tree's project, never the one the process was invoked in");
});
