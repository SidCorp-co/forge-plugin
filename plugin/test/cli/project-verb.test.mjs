/* The verb an agent asks before it plans a live walk, and the two seats that keep what it answers
   off the tracker. Spawned rather than called, because the answer is what a developer reads and the
   refusal has to arrive before the call goes out (ISS-92). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeStore, fakeTracker, ranAsync, tempHome } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;
const { store, knowledge } = fakeStore();
const ISSUE = "22222222-2222-4222-8222-222222222222";
const PASSWORD = "correct-horse-battery";

const deploy = {
  stagingUrl: "https://beta.example.test",
  testingUrls: [{ label: "shop", url: "https://shop.example.test" }],
  testCredentials: [{ username: "qa@example.test", password: PASSWORD }],
  notes: "A test account reaches the storefront only.",
};

const held = { documentId: ISSUE, issueId: "ISS-1", status: "in_progress", title: "one" };

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
      config: { baseBranch: "staging", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
    }),
    "forge_projects.get": () => ({ project: { previewDeploy: state.deploy } }),
    forge_knowledge: knowledge,
  },
  deploy,
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const ask = (...argv) => ranAsync(FORGE, argv, tracker.env, ROOT);
await ask("claim", "ISS-1");

test("the verb answers where a change lands and what it can be walked against", async () => {
  const run = await ask("project");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^project id: [0-9a-f-]{36} {2}← the slug in \.forge\.json$/mu);
  assert.match(run.stdout, /^staging branch: staging {2}← the tracker's project config$/mu);
  assert.match(run.stdout, /^production branch: master {2}← the tracker's project config$/mu);
  assert.match(run.stdout, /^production deploys on its own: no {2}← the tracker's project config$/mu);
  assert.match(run.stdout, /^staging deploy {2}← the tracker's project detail$/mu);
  assert.match(run.stdout, /^ {2}staging url: https:\/\/beta\.example\.test$/mu);
  assert.match(run.stdout, /^ {2}testing urls: https:\/\/shop\.example\.test$/mu);
  assert.match(run.stdout, /^ {2}notes: A test account reaches the storefront only\.$/mu);
});

test("the credential is named and not printed until the flag asks for it", async () => {
  const held = await ask("project");
  assert.match(held.stdout, /^ {2}test credentials: present, forge project --credentials$/mu);
  assert.doesNotMatch(held.stdout, new RegExp(PASSWORD, "u"));
  const asked = await ask("project", "--credentials");
  assert.equal(asked.status, 0, asked.stderr);
  assert.match(asked.stdout, new RegExp(`^ {2}test credentials · password: ${PASSWORD}$`, "mu"));
});

test("the tracker's own field names reach no reader of this verb", async () => {
  const run = await ask("project", "--credentials");
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /baseBranch|previewDeploy/u);
});

test("a comment carrying the credential is refused, and the refusal names the field", async () => {
  const room = tempHome("project-verb");
  const body = join(room.path, "note.md");
  writeFileSync(body, `Signed in with ${PASSWORD} and the screen rendered.\n`);
  const run = await ask("comment", "ISS-1", body);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries this project's test credentials · password, at body/u);
  assert.match(run.stderr, /forge project --credentials/u);
  assert.doesNotMatch(run.stdout, /comment-uuid/u, "and nothing was posted");
  assert.equal(state.calls.filter((one) => one.args?.action === "create").length, 0);
});

test("a file carrying the credential is refused before the upload slot is minted", async () => {
  const room = tempHome("project-upload");
  const shot = join(room.path, "walk.txt");
  writeFileSync(shot, `the walk, signed in with ${PASSWORD}\n`);
  const run = await ask("attach", "issue", "ISS-1", shot);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^walk\.txt carries this project's test credentials · password\. A test/mu,
    "a file is one value, so the refusal names no field of a payload it does not have");
  assert.equal(state.calls.filter((one) => one.name === "forge_uploads").length, 0,
    "there is no delete for an upload, so a refused file leaves no document behind");
});

test("a payload holding no credential is sent, and a project holding none refuses nothing", async () => {
  const room = tempHome("project-clean");
  const body = join(room.path, "clean.md");
  writeFileSync(body, "The screen rendered and nothing secret is quoted.\n");
  const sent = await ask("comment", "ISS-1", body);
  assert.equal(sent.status, 0, sent.stderr);
  state.deploy = { stagingUrl: "https://beta.example.test", testCredentials: [] };
  const secret = join(room.path, "secret.md");
  writeFileSync(secret, `Signed in with ${PASSWORD}.\n`);
  const through = await ask("comment", "ISS-1", secret);
  assert.equal(through.status, 0, through.stderr);
  state.deploy = deploy;
});

test("a record carrying the credential is refused too, since the guard reads no list of kinds", async () => {
  const run = await ask("record", "park", "ISS-1", "--kind", "paused",
    "--why", `stopped at the login wall; the password on file is ${PASSWORD}`);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries this project's test credentials · password, at [a-zA-Z]/u);
});

test("a write goes through where the deploy could not be read at all", async () => {
  const room = tempHome("project-unread");
  const body = join(room.path, "secret.md");
  writeFileSync(body, `Signed in with ${PASSWORD}.\n`);
  state.answer["forge_projects.get"] = () => ({ refused: "this credential may not read the project" });
  const run = await ask("comment", "ISS-1", body);
  state.answer["forge_projects.get"] = () => ({ project: { previewDeploy: state.deploy } });
  assert.equal(run.status, 0, `a refusal caused by a read this CLI could not make has no way out: ${run.stderr}`);
});

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
  const run = await ask("project");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^project brief: none stored/mu);
  assert.match(run.stdout, /forge project --refresh <brief\.md>/u);
});

test("a refresh writes the brief and stamps a digest for each source its own lines name", async () => {
  store.clear();
  const room = tempHome("project-brief");
  const run = await ask("project", "--refresh", briefAt(room), "--title", "The map",
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

test("the verb then prints the brief it wrote, with no stale line while the sources hold", async () => {
  const run = await ask("project");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^project brief {2}← the knowledge store, slug project-brief/mu);
  assert.match(run.stdout, /^# The map$/mu);
  assert.doesNotMatch(run.stdout, /stale:|gone:/u);
});

test("a source that moved under a stored brief is named, and only that source", async () => {
  const held = store.get("project-brief");
  store.set("project-brief", {
    ...held,
    metadata: { ...held.metadata, digests: { ...held.metadata.digests, "CLAUDE.md": "0000000000000000" } },
  });
  const run = await ask("project");
  assert.match(run.stdout, /^ {2}stale: CLAUDE\.md — moved since the brief was read\./mu, run.stdout);
});

test("a source the checkout no longer holds is gone rather than stale", async () => {
  const held = store.get("project-brief");
  store.set("project-brief", { ...held, metadata: { digests: { "docs/was-here.md": "0000000000000000" } } });
  const run = await ask("project");
  assert.match(run.stdout, /^ {2}gone: docs\/was-here\.md — named as a source and not in this checkout$/mu);
});

test("a refresh naming nothing keeps the kind, title and confidence the stored entry holds", async () => {
  const room = tempHome("project-brief-again");
  const run = await ask("project", "--refresh", briefAt(room, "# A second map\n\nBuild: none.  ← `README.md`\n"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^replaced {2}project-brief/mu, run.stdout);
  assert.match(run.stdout, /title The map/u, `the title nobody typed was dropped: ${run.stdout}`);
  assert.deepEqual(Object.keys(store.get("project-brief").metadata.digests), ["README.md"],
    "the digests of a body nobody carried forward are the new body's, never the old body's");
});

test("a brief citing no source stores an empty digest map rather than the one it replaced", async () => {
  const room = tempHome("project-brief-bare");
  const run = await ask("project", "--refresh", briefAt(room, "# A map with nothing to check\n"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}digests: none — no line of this brief names a source/mu, run.stdout);
  assert.deepEqual(store.get("project-brief").metadata.digests, {},
    "carrying the old digests here would freshen a hash over prose nobody corrected");
});

test("a brief carrying this project's credential is refused before anything is sent", async () => {
  const room = tempHome("project-brief-secret");
  const before = store.get("project-brief").body;
  const run = await ask("project", "--refresh",
    briefAt(room, `# The map\n\nCredentials: sign in with ${PASSWORD}.  ← \`CLAUDE.md\`\n`));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries this project's test credentials · password/u);
  assert.equal(store.get("project-brief").body, before, "and the stored brief is untouched");
});

/* Longer than its row: what a stale line means and what --refresh takes have nowhere else to go.
   The pointer that row once earned is the helper's, and cli-help.test.mjs judges it there. */
test("the verb's own help names the refresh and what it takes", async () => {
  const run = await ask("project", "-h");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /--refresh <file\.md\|@file\|->/u);
  assert.match(run.stdout, /stale:/u);
});

test("a named source this checkout lacks is kept and read back as gone, not dropped", async () => {
  const room = tempHome("project-brief-missing");
  const run = await ask("project", "--refresh",
    briefAt(room, "# The map\n\nBuild: none.  ← `docs/was-here.md`\n"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}named and not here: docs\/was-here\.md/mu, run.stdout);
  const said = await ask("project");
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
  assert.match(run.stderr, /forge project --refresh/u);
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
  const run = await ask("project", "--refresh", briefAt(room, SHARED), "--title", "The map");
  assert.equal(run.status, 0, run.stderr);
};

test("a confirm re-stamps the named source and leaves the body byte-identical", async () => {
  await writeShared("brief-confirm");
  const before = stale("CLAUDE.md");
  const run = await ask("project", "--confirm", "CLAUDE.md");
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
  const run = await ask("project", "--confirm", "README.md");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /README\.md holds the bytes the brief was read from, so nothing moved/u);
  assert.deepEqual(store.get("project-brief").metadata.digests, before.metadata.digests);
});

test("a confirm of a source the brief does not name is refused with the ones it does", async () => {
  const run = await ask("project", "--confirm", "docs/FORGE-CLI.md");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /No source of this brief named docs\/FORGE-CLI\.md/u);
  assert.match(run.stderr, /CLAUDE\.md/u);
});

test("a confirm of a source this checkout no longer holds reports it gone and writes nothing", async () => {
  store.clear();
  const room = tempHome("brief-confirm-gone");
  await ask("project", "--refresh", briefAt(room, "# The map\n\nBuild: none.  ← `docs/was-here.md`\n"),
    "--title", "The map");
  const before = store.get("project-brief");
  const run = await ask("project", "--confirm", "docs/was-here.md");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^gone: docs\/was-here\.md is named as a source and is not in this checkout/mu);
  assert.equal(store.get("project-brief").updatedAt, before.updatedAt, "and nothing was written");
});

test("a line replaces its own prose and leaves every other line byte-identical", async () => {
  await writeShared("brief-line");
  const before = store.get("project-brief");
  const run = await ask("project", "--line", "4",
    "Layout: eight trees under plugin/src.  ← `docs/FORGE-CLI.md`");
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
  const run = await ask("project", "--line", "3", "The gate: `npm run check`.  ← `CLAUDE.md`");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(store.get("project-brief").metadata.digests["CLAUDE.md"], ZERO,
    "the shared digest is not stamped by one line's rewrite");
  assert.match(run.stdout, /^ {2}left stale: CLAUDE\.md is also read by line 5/mu, run.stdout);
  assert.match(run.stdout, /forge project --confirm CLAUDE\.md/u,
    "and the route that closes it once that line holds too");
});

test("two writes in one call are refused rather than one of them silently preferred", async () => {
  const room = tempHome("brief-two-writes");
  const run = await ask("project", "--refresh", briefAt(room, SHARED), "--confirm", "CLAUDE.md");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--refresh and --confirm each write the brief a different way/u);
});

test("prose with no --line is refused rather than read as a verb of its own", async () => {
  const run = await ask("project", "A line of a brief.");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /names no flag/u);
  assert.match(run.stderr, /forge project --line <n> <text>/u);
});

test("a line number outside the stored body names the range it has", async () => {
  await writeShared("brief-line-range");
  const run = await ask("project", "--line", "99", "Nowhere.");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--line takes a line of the stored brief, 1 to 6/u);
});

test("the narrow writes need a brief to be narrow about, and the absence names the write", async () => {
  store.clear();
  const run = await ask("project", "--confirm", "CLAUDE.md");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /no brief stored/u);
  assert.match(run.stderr, /forge project --refresh <brief\.md>/u);
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
  const run = await ask("project", "--confirm", "CLAUDE.md");
  state.answer.forge_knowledge = knowledge;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the brief moved between this call's read and its write/u);
  assert.match(store.get("project-brief").body, /a second session wrote this/u,
    "and what that session wrote is still in the store");
});
