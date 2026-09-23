/* The brief this verb stores for a project, written and read back through the one report that
   holds it: the whole-file refresh, the per-source confirm and the per-line write. Its own file
   because the report's rows and its brief are two subjects, and one of them is now full. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeStore, fakeTracker, projectRecord, ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;
const { store, knowledge } = fakeStore();
const ISSUE = "22222222-2222-4222-8222-222222222222";
const PASSWORD = "correct-horse-battery";

const deploy = {
  live: { url: "https://shop.example.test" },
  limits: "a budget the tracker holds for this project",
  preview: { url: "https://beta.example.test",
    urls: [{ label: "shop", url: "https://beta.example.test/shop" }] },
  testCredentials: [{ username: "qa@example.test", password: PASSWORD }],
};

const held = { documentId: ISSUE, issueId: "ISS-1", status: "in_progress", title: "one" };

/* A refusal that came after the write reads exactly like one that came before it, so the store's
   own writes are counted and a guard is judged on the count rather than on the body it left. */
let upserts = 0;
const counted = (args) => {
  if (args.action === "upsert") upserts += 1;
  return knowledge(args);
};

const state = {
  issues: [held],
  comments: { [ISSUE]: [] },
  answer: {
    /* The lease is the write's own gate, so the fixture keeps what the claim puts on the issue. */
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [held], returned: 1, hasMore: false };
      if (args.action === "get") return held;
      if (args.action === "update") return Object.assign(held, args.data);
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_config: () => ({
      config: { baseBranch: "staging", releaseModel: "promote", liveBranch: "master", pipelineConfig: { autoProdDeploy: false } },
    }),
    "forge_projects.get": () => ({ project: { environments: state.deploy } }),
    forge_knowledge: counted,
    /* One handler for the three, because the fake routes every `pm/<what>` path to this tool. */
    forge_project_pm: ({ action }) => (action === "snapshot" ? state.snapshot
      : action === "runner_load" ? { runners: [{ id: "r-1" }] } : state.graph),
  },
  deploy,
  graph: { nodes: [{ id: ISSUE }], edges: [], depth: 2, truncated: false, remainingNodes: 0 },
  snapshot: { countsByStatus: { open: 3 }, activeJobs: [], stalledIssues: [], queuedCount: 0, recentFailures: [] },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());
/* Every call below stands in this checkout, so this machine's record of THIS project is what it
   resolves: written under the home these calls run against, keyed by the repository's root folder
   the way the resolver keys it (ISS-1403). */
projectRecord(ROOT, tracker.env.XDG_CONFIG_HOME, { slug: "forge-plugin" });
const ask = (...argv) => ranAsync(FORGE, argv, tracker.env, ROOT);
await ask("claim", "ISS-1", "--unheld");


/* The brief. Its sources are this repository's own files, because that is what the verb resolves a
   line's source against — a stubbed hash would prove the arithmetic and not the resolution. */
const BRIEF = [
  "# The map",
  "",
  "Test and lint, and the gate: `npm run check`.  ← `CLAUDE.md`",
  "Prose language: *not stated*.",
  "",
].join("\n");

const briefAt = (room, text = BRIEF) => {
  const path = join(room.path, "brief.md");
  writeFileSync(path, text);
  return path;
};

test("the brief is absent until one is written, and the absence names the write", async () => {
  store.clear();
  const run = await ask("doctor");
  assert.match(run.stdout, /^project brief: none stored/mu, run.stderr);
  assert.match(run.stdout, /forge doctor --refresh <brief\.md>/u);
});

test("a refresh writes the brief and stamps a digest for each source its own lines name", async () => {
  store.clear();
  const room = tempHome("project-brief");
  const run = await ask("doctor", "--refresh", briefAt(room), "--title", "The map",
    "--confidence", "inferred", "--meta", "written-by=ISS-147");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^created {2}project-brief/mu, run.stdout);
  assert.match(run.stdout, /^ {2}digests: CLAUDE\.md$/mu,
    `only the source a line names is hashed: ${run.stdout}`);
  const held = store.get("project-brief");
  assert.equal(held.kind, "overview");
  assert.equal(held.injection, "always", "a brief a session has to ask for is the call it removes");
  assert.equal(held.metadata["written-by"], "ISS-147");
  assert.deepEqual(Object.keys(held.metadata.digests), ["CLAUDE.md"]);
});

test("the report then prints the brief it wrote, with no stale line while the sources hold", async () => {
  const run = await ask("doctor");
  assert.match(run.stdout, /^project brief {2}← the knowledge store, slug project-brief/mu, run.stderr);
  assert.match(run.stdout, /^1 {2}# The map$/mu);
  assert.doesNotMatch(run.stdout, /stale:|gone:/u);
});

test("a source that moved under a stored brief is named, and only that source", async () => {
  const held = store.get("project-brief");
  store.set("project-brief", {
    ...held,
    metadata: { ...held.metadata, digests: { ...held.metadata.digests, "CLAUDE.md": "0000000000000000" } },
  });
  const run = await ask("doctor");
  assert.match(run.stdout, /^ {2}stale: CLAUDE\.md — moved since the brief was read\./mu, run.stdout);
});

test("a source the checkout no longer holds is gone rather than stale", async () => {
  const held = store.get("project-brief");
  store.set("project-brief", { ...held, metadata: { digests: { "docs/was-here.md": "0000000000000000" } } });
  const run = await ask("doctor");
  assert.match(run.stdout, /^ {2}gone: docs\/was-here\.md — named as a source and not in this checkout$/mu);
});

test("a refresh naming nothing keeps the kind, title and confidence the stored entry holds", async () => {
  const room = tempHome("project-brief-again");
  const run = await ask("doctor", "--refresh", briefAt(room, "# A second map\n\nBuild: none.  ← `README.md`\n"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^replaced {2}project-brief/mu, run.stdout);
  assert.match(run.stdout, /title The map/u, `the title nobody typed was dropped: ${run.stdout}`);
  assert.deepEqual(Object.keys(store.get("project-brief").metadata.digests), ["README.md"],
    "the digests of a body nobody carried forward are the new body's, never the old body's");
});

test("a brief citing no source stores an empty digest map rather than the one it replaced", async () => {
  const room = tempHome("project-brief-bare");
  const run = await ask("doctor", "--refresh", briefAt(room, "# A map with nothing to check\n"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}digests: none — /mu, run.stdout);
  assert.deepEqual(store.get("project-brief").metadata.digests, {},
    "carrying the old digests here would freshen a hash over prose nobody corrected");
});

test("a brief carrying this project's credential is refused before anything is sent", async () => {
  const room = tempHome("project-brief-secret");
  const before = store.get("project-brief").body;
  const run = await ask("doctor", "--refresh",
    briefAt(room, `# The map\n\nCredentials: sign in with ${PASSWORD}.  ← \`CLAUDE.md\`\n`));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries this project's test credentials · password/u);
  assert.equal(store.get("project-brief").body, before, "and the stored brief is untouched");
});

/* Longer than its row: what a stale line means and what --refresh takes have nowhere else to go, and
   that place is the brief subject's own cap rather than the verb's, which had nine bytes left of
   2,500 (ISS-1692). The verb still names the flag, being the set its parse refuses against. */
test("the brief subject's help names the refresh and what it takes", async () => {
  const verb = await ask("doctor", "-h");
  assert.equal(verb.status, 0, verb.stderr);
  assert.match(verb.stdout, /--refresh <file\.md\|@file\|->/u);
  const run = await ask("doctor", "brief", "-h");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /forge doctor --refresh <body>/u);
  assert.match(run.stdout, /stale:/u);
});

test("a named source this checkout lacks is kept and read back as gone, not dropped", async () => {
  const room = tempHome("project-brief-missing");
  const run = await ask("doctor", "--refresh",
    briefAt(room, "# The map\n\nBuild: none.  ← `docs/was-here.md`\n"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}named and not here: docs\/was-here\.md/mu, run.stdout);
  const said = await ask("doctor");
  assert.match(said.stdout, /^ {2}gone: docs\/was-here\.md/mu, said.stdout);
  assert.doesNotMatch(said.stdout, /no line of this brief names a source/u,
    "a brief naming only what this checkout lacks is not a brief naming nothing");
});

/* The reserved slug: a write through the store's own verb would replace the body and keep the
   digests of the body it replaced, and the stale line would then say nothing had moved. */
test("the brief's slug is refused by the generic writer, which names the verb that owns it", async () => {
  const room = tempHome("project-brief-reserved");
  const before = store.get("project-brief").body;
  const run = await ask("knowledge", "write", "project-brief", briefAt(room), "--kind", "overview");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /forge doctor --refresh/u);
  assert.equal(store.get("project-brief").body, before, "and nothing was written");
});

/* The two narrow writes. A stale line is one line whose source moved, and the whole-file form is
   how a brief with one stale line stayed stale: two runs declined to race a Phase 0 reading it. */
const SHARED = [
  "# The map",
  "",
  "Test and lint, and the gate: `npm run check`.  ← `CLAUDE.md`",
  "Layout: the CLI in seven trees under plugin/src.  ← `README.md`",
  "Language: English for what a developer reads.  ← `CLAUDE.md`",
  "",
].join("\n");

const ZERO = "0000000000000000";

/* Returned as it was written, not as it was read: the entry is what the narrow write is judged
   against, so a stale digest a test set has to be the one the assertion compares to. */
const stale = (...paths) => {
  const held = store.get("project-brief");
  const digests = { ...held.metadata.digests };
  for (const path of paths) digests[path] = ZERO;
  const next = { ...held, metadata: { ...held.metadata, digests } };
  store.set("project-brief", next);
  return next;
};

const writeShared = async (name) => {
  store.clear();
  const room = tempHome(name);
  const run = await ask("doctor", "--refresh", briefAt(room, SHARED), "--title", "The map");
  assert.equal(run.status, 0, run.stderr);
};

test("a confirm re-stamps the named source and leaves the body byte-identical", async () => {
  await writeShared("brief-confirm");
  const before = stale("CLAUDE.md");
  const run = await ask("doctor", "--confirm", "CLAUDE.md");
  assert.equal(run.status, 0, run.stderr);
  const after = store.get("project-brief");
  assert.equal(after.body, before.body, "a confirm changes no prose");
  assert.notEqual(after.metadata.digests["CLAUDE.md"], ZERO);
  assert.equal(after.metadata.digests["README.md"], before.metadata.digests["README.md"],
    "and no digest but the named one");
  assert.match(run.stdout, /^ {2}confirmed: CLAUDE\.md 0{16} → [0-9a-f]{16}$/mu, run.stdout);
  assert.match(run.stdout, /^ {2}read again and still holding: lines 3, 5/mu,
    "a digest is a path's and the caller vouched for lines, so the call says which");
});

test("a confirm of a source that has not moved writes nothing", async () => {
  const before = store.get("project-brief");
  const run = await ask("doctor", "--confirm", "README.md");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /README\.md holds the bytes the brief was read from, so nothing moved/u);
  assert.deepEqual(store.get("project-brief").metadata.digests, before.metadata.digests);
});

test("a confirm of a source the brief does not name is refused with the ones it does", async () => {
  const run = await ask("doctor", "--confirm", "docs/FORGE-CLI.md");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /No source of this brief named docs\/FORGE-CLI\.md/u);
  assert.match(run.stderr, /CLAUDE\.md/u);
});

test("a confirm of a source this checkout no longer holds reports it gone and writes nothing", async () => {
  store.clear();
  const room = tempHome("brief-confirm-gone");
  await ask("doctor", "--refresh", briefAt(room, "# The map\n\nBuild: none.  ← `docs/was-here.md`\n"),
    "--title", "The map");
  const before = store.get("project-brief");
  const run = await ask("doctor", "--confirm", "docs/was-here.md");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^gone: docs\/was-here\.md is named as a source and is not in this checkout/mu);
  assert.equal(store.get("project-brief").updatedAt, before.updatedAt, "and nothing was written");
});

test("a line replaces its own prose and leaves every other line byte-identical", async () => {
  await writeShared("brief-line");
  const before = store.get("project-brief");
  const run = await ask("doctor", "--line", "4",
    "Layout: eight trees under plugin/src.  ← `docs/FORGE-CLI.md`",
    "--was", "Layout: the CLI in seven trees");
  assert.equal(run.status, 0, run.stderr);
  const after = store.get("project-brief").body.split("\n");
  const was = before.body.split("\n");
  assert.equal(after[3], "Layout: eight trees under plugin/src.  ← `docs/FORGE-CLI.md`");
  assert.deepEqual([...after.slice(0, 3), ...after.slice(4)], [...was.slice(0, 3), ...was.slice(4)]);
  assert.match(run.stdout, /^ {2}stamped: docs\/FORGE-CLI\.md — no other line of the brief reads it$/mu, run.stdout);
  assert.match(run.stdout, /^ {2}dropped: README\.md — no line of the brief names it now$/mu, run.stdout);
});

/* The constraint the whole shape turns on: stamping a shared path here would clear the other line
   reading it over prose nobody looked at, which is the staleness the `stale:` line exists to say. */
test("a line sharing its source with another leaves that source stale and names the line", async () => {
  await writeShared("brief-line-shared");
  stale("CLAUDE.md");
  const run = await ask("doctor", "--line", "3", "The gate: `npm run check`.  ← `CLAUDE.md`",
    "--was", "Test and lint, and the gate:");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(store.get("project-brief").metadata.digests["CLAUDE.md"], ZERO,
    "the shared digest is not stamped by one line's rewrite");
  assert.match(run.stdout, /^ {2}left stale: CLAUDE\.md is also read by line 5/mu, run.stdout);
  assert.match(run.stdout, /forge doctor --confirm CLAUDE\.md/u,
    "and the route that closes it once that line holds too");
});

test("two writes in one call are refused rather than one of them silently preferred", async () => {
  const room = tempHome("brief-two-writes");
  const run = await ask("doctor", "--refresh", briefAt(room, SHARED), "--confirm", "CLAUDE.md");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--refresh and --confirm each write the brief a different way/u);
});

test("prose with no --line is refused rather than read as a verb of its own", async () => {
  const run = await ask("doctor", "A line of a brief.");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /names no flag/u);
  assert.match(run.stderr, /forge doctor --line <n> <text>/u);
});

/* The whole ground of the guard: this entry has no revision and no conditional write, so a line
   replaced is gone and the number is the one thing the caller can be wrong about (ISS-448). */
test("a line replaced with no --was is refused before the store is asked at all", async () => {
  await writeShared("brief-line-unchecked");
  const before = upserts;
  const run = await ask("doctor", "--line", "4", "Layout: eight trees.  ← `README.md`");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(upserts, before, "and no write left for the refusal to be after");
  assert.match(run.stderr, /--was <the line as it stands>/u);
  assert.match(run.stderr, /prints the brief with the numbers <n> counts down its margin/u);
});

test("prose line 4 does not begin with is refused, quoting what line 4 holds", async () => {
  await writeShared("brief-line-mismatch");
  const before = { ...store.get("project-brief"), upserts };
  const run = await ask("doctor", "--line", "4", "Layout: eight trees.  ← `README.md`",
    "--was", "Nothing in this brief opens that way");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(upserts, before.upserts, "and nothing was sent");
  assert.equal(store.get("project-brief").body, before.body);
  assert.match(run.stderr, /no line of the brief begins `Nothing in this brief opens that way`/u);
  assert.match(run.stderr, /Line 4 reads: Layout: the CLI in seven trees under plugin\/src\./u);
});

/* The case that destroyed prose twice: an in-range number read off a view that counts differently,
   with the prose the caller meant sitting on another line. The refusal is where that line is. */
test("prose that opens a different line names that line rather than spending the number", async () => {
  await writeShared("brief-line-elsewhere");
  const before = upserts;
  const run = await ask("doctor", "--line", "4", "Language: English.  ← `CLAUDE.md`",
    "--was", "Language: English for what");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(upserts, before, "and nothing was sent");
  assert.match(run.stderr, /`Language: English for what` opens line 5, not line 4/u);
  assert.match(run.stderr, /Line 4 reads: Layout: the CLI in seven trees/u);
});

test("prose two lines share is refused naming both, even where one of them is the number given", async () => {
  store.clear();
  const room = tempHome("brief-line-ambiguous");
  const body = ["# The map", "", "Build: none.  ← `CLAUDE.md`", "Build: none twice.  ← `README.md`", ""];
  await ask("doctor", "--refresh", briefAt(room, body.join("\n")), "--title", "The map");
  const before = upserts;
  const run = await ask("doctor", "--line", "3", "Build: one step.  ← `CLAUDE.md`", "--was", "Build: none");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(upserts, before, "a prefix the numbered line does begin with still writes nothing");
  assert.match(run.stderr, /`Build: none` opens lines 3, 4/u);
  assert.match(run.stderr, /name more of the line/u);
});

test("--was with no --line is refused, and writes neither the brief nor a configuration key", async () => {
  await writeShared("brief-was-orphan");
  const before = { ...store.get("project-brief"), upserts };
  const run = await ask("doctor", "--was", "# The map");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(upserts, before.upserts);
  assert.equal(store.get("project-brief").body, before.body);
  assert.match(run.stderr, /no --line was given/u);
  const set = await ask("doctor", "--set", "fact.done-means=shipped", "--was", "# The map");
  assert.equal(set.status, 1, set.stdout);
  assert.match(set.stderr, /no --line was given/u);
});

test("an empty --was is refused, since every line begins with one", async () => {
  await writeShared("brief-was-empty");
  const before = upserts;
  const run = await ask("doctor", "--line", "4", "Layout: eight trees.  ← `README.md`", "--was", "   ");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(upserts, before);
  assert.match(run.stderr, /every line begins with an empty one, so this checks nothing/u);
});

/* Two numbering schemes used in the same breath is what the workflow the brief prescribes asks
   for, so the view the stale line sends a run to carries the flag's own numbers. */
test("the printed brief numbers the body it counts and leaves the rows above it unnumbered", async () => {
  await writeShared("brief-numbered");
  const run = await ask("doctor");
  assert.match(run.stdout, /^1 {2}# The map$/mu, run.stdout);
  assert.match(run.stdout, /^2 {2}$/mu, "a blank body line carries its number too");
  assert.match(run.stdout, /^4 {2}Layout: the CLI in seven trees under plugin\/src\./mu);
  assert.match(run.stdout, /^project brief {2}← the knowledge store/mu,
    "and the rows above the body carry none");
});

test("a line number outside the stored body names the range it has", async () => {
  await writeShared("brief-line-range");
  const run = await ask("doctor", "--line", "99", "Nowhere.", "--was", "# The map");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--line takes a line of the stored brief, 1 to 6/u);
});

test("the narrow writes need a brief to be narrow about, and the absence names the write", async () => {
  store.clear();
  const run = await ask("doctor", "--confirm", "CLAUDE.md");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /no brief stored/u);
  assert.match(run.stderr, /forge doctor --refresh <brief\.md>/u);
});

/* The store takes no conditional write, so the window between a narrow write's read and its write
   cannot be closed — only made loud. Without the re-read this restores the other session's line. */
test("a brief that moved under a narrow write refuses rather than putting back what it read", async () => {
  await writeShared("brief-raced");
  stale("CLAUDE.md");
  let reads = 0;
  state.answer.forge_knowledge = (args) => {
    const answer = knowledge(args);
    if (args.action !== "get" || args.slug !== "project-brief") return answer;
    reads += 1;
    if (reads === 1) {
      const held = store.get("project-brief");
      store.set("project-brief", { ...held, body: `${held.body}Deploy: a second session wrote this.\n` });
    }
    return answer;
  };
  const run = await ask("doctor", "--confirm", "CLAUDE.md");
  state.answer.forge_knowledge = knowledge;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the brief moved between this call's read and its write/u);
  assert.match(store.get("project-brief").body, /a second session wrote this/u,
    "and what that session wrote is still in the store");
});
