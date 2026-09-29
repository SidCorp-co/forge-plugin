/* The brief's insert, `forge doctor --after`: one line added below a line its `--was` names, with
   the sources of that line stamped on the rule `--line` already follows. Its own file because the
   brief's other writes fill theirs, and an insert is the one write those cannot express (ISS-362). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeStore, fakeTracker, neutralCheckout, projectRecord, ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
/* A source's digest is stamped from the checkout, so this stands in a copy of the repository's own
   files rather than the empty room `ranAsync` defaults to — one naming no run, so an isolated
   XDG_CONFIG_HOME never conflict-refuses against a dispatched worktree this file never asked about
   (ISS-2824). */
const ROOT = neutralCheckout();
const { store, knowledge } = fakeStore();
const ZERO = "0000000000000000";

/* Every call to the store is counted, reads among them, so a refusal is judged on whether it came
   before the store was asked rather than on the body it happened to leave. */
const calls = { get: 0, upsert: 0 };
const counted = (args) => {
  if (args.action in calls) calls[args.action] += 1;
  return knowledge(args);
};

const tracker = await fakeTracker({
  issues: [],
  comments: {},
  answer: {
    forge_config: () => ({ config: { baseBranch: "master" } }),
    "forge_projects.get": () => ({ project: { environments: {} } }),
    forge_knowledge: counted,
  },
});
test.after(() => tracker.close());
projectRecord(ROOT, tracker.env.XDG_CONFIG_HOME, { slug: "forge-plugin" });
const ask = (...argv) => ranAsync(FORGE, argv, tracker.env, ROOT);

/* Sources are this repository's own files, since a line's source is resolved against the checkout. */
const SHARED = [
  "# The map",
  "",
  "Test and lint, and the gate: `npm run check`.  ← `CLAUDE.md`",
  "Layout: the CLI in seven trees under plugin/src.  ← `README.md`",
  "Language: English for what a developer reads.  ← `CLAUDE.md`",
  "",
];

const written = async (name, lines = SHARED) => {
  store.clear();
  const room = tempHome(name);
  const path = join(room.path, "brief.md");
  writeFileSync(path, lines.join("\n"));
  const run = await ask("doctor", "--refresh", path, "--title", "The map");
  assert.equal(run.status, 0, run.stderr);
  return store.get("project-brief");
};

const staleAt = (path) => {
  const held = store.get("project-brief");
  store.set("project-brief",
    { ...held, metadata: { ...held.metadata, digests: { ...held.metadata.digests, [path]: ZERO } } });
};

const HOOKS_LINE = "Hooks: what they share is written down.  ← `docs/HOOKS.md`";

test("a line is added below the line named and every other line comes back as it was", async () => {
  await written("after-adds");
  const run = await ask("doctor", "--after", "4", HOOKS_LINE, "--was", "Layout: the CLI");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(store.get("project-brief").body.split("\n"),
    [...SHARED.slice(0, 4), HOOKS_LINE, ...SHARED.slice(4)]);
  assert.match(run.stdout, /^ {2}after line 4: Layout: the CLI in seven trees/mu, run.stdout);
  assert.match(run.stdout, /^ {2}line 5 added: Hooks: what they share/mu, run.stdout);
});

test("a source only the added line names is stamped from the checkout, and the output says so", async () => {
  await written("after-stamps");
  const run = await ask("doctor", "--after", "4", HOOKS_LINE, "--was", "Layout: the CLI");
  assert.equal(run.status, 0, run.stderr);
  assert.match(store.get("project-brief").metadata.digests["docs/HOOKS.md"], /^[0-9a-f]{16}$/u);
  assert.match(run.stdout, /^ {2}stamped: docs\/HOOKS\.md — no other line of the brief reads it$/mu,
    run.stdout);
});

/* The rule the insert inherits: stamping a path another line reads would clear that line's
   staleness over prose nobody looked at. */
test("a source the added line shares keeps its digest, and the lines reading it are named", async () => {
  await written("after-shared");
  staleAt("CLAUDE.md");
  const run = await ask("doctor", "--after", "4", "Comments: English.  ← `CLAUDE.md`",
    "--was", "Layout: the CLI");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(store.get("project-brief").metadata.digests["CLAUDE.md"], ZERO);
  assert.match(run.stdout, /^ {2}left stale: CLAUDE\.md is also read by lines 3, 6/mu, run.stdout);
  assert.match(run.stdout, /forge doctor --confirm CLAUDE\.md/u);
});

test("an --after whose --was does not open the line named is refused before anything is sent", async () => {
  await written("after-mismatch");
  const before = calls.upsert;
  const run = await ask("doctor", "--after", "4", HOOKS_LINE, "--was", "Language: English");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(calls.upsert, before, "and nothing was sent");
  assert.match(run.stderr, /`Language: English` opens line 5, not line 4/u);
  assert.match(run.stderr, /Line 4 reads: Layout: the CLI in seven trees/u);
});

test("an --after with no --was is refused before the store is asked at all", async () => {
  await written("after-unchecked");
  const before = { ...calls };
  const run = await ask("doctor", "--after", "4", HOOKS_LINE);
  assert.equal(run.status, 1, run.stdout);
  assert.deepEqual(calls, before, "no read and no write");
  assert.match(run.stderr, /forge doctor --after <n> <text> --was <line n as it stands>/u);
});

test("an --after whose text holds a newline is refused with nothing written", async () => {
  const held = await written("after-newline");
  const run = await ask("doctor", "--after", "4", `${HOOKS_LINE}\nA second line.`,
    "--was", "Layout: the CLI");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(store.get("project-brief").body, held.body);
  assert.match(run.stderr, /--after adds one line and this text holds a newline/u);
});

test("an --after naming a line outside the stored body names the range it has", async () => {
  await written("after-range");
  const run = await ask("doctor", "--after", "99", HOOKS_LINE, "--was", "# The map");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--after takes a line of the stored brief, 1 to 6/u);
});

test("an --after beside another write of the brief is refused as two writes in one call", async () => {
  await written("after-two-writes");
  const before = calls.upsert;
  for (const [flag, value] of [["--line", "4"], ["--confirm", "CLAUDE.md"]]) {
    const run = await ask("doctor", flag, value, "--after", "4", HOOKS_LINE, "--was", "Layout");
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, new RegExp(`${flag} and --after each write the brief a different way`, "u"));
  }
  assert.equal(calls.upsert, before);
});

/* A blank line opens with nothing a --was can quote, so replacing one is no longer a route at all:
   filling a blank was always an insert, and the refusal aims the insert that can be made. */
test("a --line aimed at a blank line names the --after anchored on the nearest line above", async () => {
  await written("after-blank-route");
  const run = await ask("doctor", "--line", "2", HOOKS_LINE, "--was", "Layout: the CLI");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /forge doctor --after 1 <text> --was <line 1 as it stands>/u);
});

test("the anchor named for a blank line skips a line no --was prefix can open alone", async () => {
  await written("after-blank-duplicate", ["# The map", "Build: none.", "Build: none.", "", "End."]);
  const run = await ask("doctor", "--line", "4", HOOKS_LINE, "--was", "End.");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /forge doctor --after 1 <text> --was <line 1 as it stands>/u);
});

test("the anchor named for a blank line skips a line holding only whitespace", async () => {
  await written("after-blank-spaces", ["# Map", "   ", "", "End."]);
  const run = await ask("doctor", "--line", "3", HOOKS_LINE, "--was", "End.");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /forge doctor --after 1 <text> --was <line 1 as it stands>/u);
  await written("after-blank-spaces-only", ["   ", "", "End."]);
  const none = await ask("doctor", "--line", "2", HOOKS_LINE, "--was", "End.");
  assert.match(none.stderr, /no line above it can anchor an insert/u);
});

test("a blank line with no usable anchor above it names the whole-body rewrite", async () => {
  await written("after-blank-none", ["", "# The map", "End."]);
  const leading = await ask("doctor", "--line", "1", HOOKS_LINE, "--was", "End.");
  assert.equal(leading.status, 1, leading.stdout);
  assert.match(leading.stderr, /no line above it can anchor an insert/u);
  assert.match(leading.stderr, /forge doctor --refresh <brief\.md>/u);
  await written("after-blank-shadowed", ["Build: none.", "Build: none.", "", "End."]);
  const shadowed = await ask("doctor", "--line", "3", HOOKS_LINE, "--was", "End.");
  assert.match(shadowed.stderr, /no line above it can anchor an insert/u);
});

test("the brief subject's help describes --after beside --line", async () => {
  const run = await ask("doctor", "brief", "-h");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}forge doctor --line <n> <text> /mu);
  assert.match(run.stdout, /^ {2}forge doctor --after <n> <text> {2}one line added below line <n>/mu);
});

test("a goals section naming no goal points at the insert as the way to add one", async () => {
  await written("after-goals", ["# The map", "", "## What this project is for", "", "Not yet written.", ""]);
  const run = await ask("doctor");
  assert.match(run.stdout, /^ {2}goals: .*identifies no goal\. Add the goals Phase 0 discovered: forge doctor --after <n> <text>/mu,
    run.stdout);
});
