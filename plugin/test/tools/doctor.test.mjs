/* A setting doctor does not read is a green report in front of a command that cannot run. */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { cleanRepo, escaped, fakeTracker, projectEntry, projectRoom, ranAsync, tempRoom }
  from "../fixtures.mjs";
import { whole } from "./doctor/fixture.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli.mjs");

/* Built rather than filtered: naming the variables to drop is a list that goes stale the day one is
   added, and the developer's own would otherwise answer for half of every fixture. */
const reported = (viConfig, extra, files, subject, config) => {
  const home = tempRoom("doctor-home-");
  if (viConfig) {
    mkdirSync(join(home, "vi-natural"));
    writeFileSync(join(home, "vi-natural", "config.json"), JSON.stringify(viConfig));
  }
  const cwd = tempRoom("doctor-cwd-");
  if (config) projectRoom(cwd, home, config);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(cwd, name), body);
  const run = spawnSync(process.execPath, [CLI, "doctor", ...(subject ? [subject] : [])], {
    encoding: "utf8",
    cwd,
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home, ...extra },
  });
  /* Read before the report is: this home holds no credential, so the one miss the report is
     entitled to is that, and `1` is what it exits on. A child that died or never started writes the
     same empty stdout as a report with nothing to say, and every case below reads that stdout. */
  assert.equal(run.status, 1,
    `the report exited ${run.signal ? `on ${run.signal}` : run.status} rather than printing: ${run.stderr}`);
  /* On its own line: a `? … : null` sharing a line with `.stdout` reads to the silence checker as a
     case turning an empty answer into its own sentinel, which is the one thing it exists to catch. */
  const entry = config ? projectEntry(cwd, home) : null;
  return { out: run.stdout, entry };
};

const report = (viConfig, extra = {}, files = {}, subject = null) =>
  reported(viConfig, extra, files, subject, null).out;

/* A project's configuration is this machine's record of it and not a file in the room, so a case
   that sets a key hands it to `projectRoom` and gets back the entry it landed in: that path is what
   the report prints after its arrow, and an assertion on the source is an assertion on it. */
const ofProject = (config, extra = {}) => reported(null, extra, {}, null, config);

/* One row of the report: its level, its label, what it says and the file it was read from. The
   source is a path this case composed rather than a name, so it goes in escaped and on that row's
   own line — a path matched anywhere in the report is no claim about which row carries it. */
const OK = " {2}ok {2}";
const MISS = " miss ";
const row = (level, label, said, entry) =>
  new RegExp(`\\[${level}\\] ${escaped(label)}\\s+${said}[^\\n]*← ${escaped(entry)}`, "u");


const MCP_FORGE = JSON.stringify({
  mcpServers: { forge: { url: "https://old.example/mcp", headers: { Authorization: "Bearer t" } } },
});

/* The transport's two numbers are settings like `ship`: read back where every setting is, with its
   source, and a value the key does not take named as such (ISS-736, ISS-828). */
test("the retry and deadline lines say the numbers that resolve and where each was read", () => {
  const forgeConfig = (body) => {
    const home = tempRoom("doctor-retry-");
    mkdirSync(join(home, "forge"));
    writeFileSync(join(home, "forge", "config.json"), JSON.stringify(body));
    const run = spawnSync(process.execPath, [CLI, "doctor"], {
      encoding: "utf8", cwd: tempRoom("doctor-retry-cwd-"), env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
    });
    return run.stdout;
  };
  assert.match(forgeConfig({}), /\[  ok  \] retry\s+2s first, doubling under 60s  ← the plugin's default/u);
  assert.match(forgeConfig({ retrySeconds: 0.5 }), /\[  ok  \] retry\s+0\.5s first, doubling under 60s  ← \S+\/forge\/config\.json/u);
  assert.match(forgeConfig({ retrySeconds: 120 }), /\[  ok  \] retry\s+60s first, doubling under 60s  ← \S+\/forge\/config\.json/u,
    "a value over the cap is reported as the wait it buys, not as written");
  assert.match(forgeConfig({ retrySeconds: "soon" }),
    /\[ miss \] retry\s+"soon" is no value of this key — it takes a non-negative number of seconds; reading 2s first, doubling under 60s  ← the plugin's default/u);
  assert.match(forgeConfig({}), /\[  ok  \] deadline\s+60s per attempt on the tracker, Cloudflare, Coolify and the chat backend, the ladder's four unchanged  ← the plugin's default/u,
    "the deadline is the second of this transport's two numbers and is read back beside the first (ISS-828)");
  assert.match(forgeConfig({ waitSeconds: 5 }), /\[  ok  \] deadline\s+5s per attempt on the tracker, Cloudflare, Coolify and the chat backend, the ladder's four unchanged  ← \S+\/forge\/config\.json/u);
  assert.match(forgeConfig({ waitSeconds: 0 }), /\[  ok  \] deadline\s+0s per attempt on the tracker, Cloudflare, Coolify and the chat backend, the ladder's four unchanged  ← \S+\/forge\/config\.json/u,
    "zero is a deadline a suite can prove the refusal with, so it reads as the project's value and not as unset");
  assert.match(forgeConfig({ waitSeconds: 1e9 }), /\[  ok  \] deadline\s+2147483\.647s per attempt on the tracker, Cloudflare, Coolify and the chat backend, the ladder's four unchanged  ← \S+\/forge\/config\.json/u,
    "a value the timer's range cuts down is the project's all the same, reported as the deadline it buys");
  assert.match(forgeConfig({ waitSeconds: 0.0004 }), /\[  ok  \] deadline\s+0s per attempt on the tracker, Cloudflare, Coolify and the chat backend, the ladder's four unchanged  ← \S+\/forge\/config\.json/u,
    "and one under a millisecond too: a value the transport honours is never reported as no value of this key");
  assert.match(forgeConfig({ waitSeconds: "soon" }),
    /\[ miss \] deadline\s+"soon" is no value of this key — it takes a non-negative number of seconds; reading 60s per attempt on the tracker, Cloudflare, Coolify and the chat backend, the ladder's four unchanged  ← the plugin's default/u);
});

/* The account config is the only source, and a `.mcp.json` carrying credentials is the one setup
   that would otherwise fail in silence — which is the failure this whole report exists for. */
test("a .mcp.json naming a forge server is reported and not read", () => {
  const out = report(null, {}, { ".mcp.json": MCP_FORGE });
  assert.match(out, /\[ miss \] endpoint url\s+nothing saved/, "it is not a source for the url");
  assert.match(out, /\[ miss \] token/, "nor for the token");
  assert.match(out, /\[ miss \] mcp.json\s+\S+\.mcp\.json carries settings this CLI does not read/);
});

/* Its credentials being saved already is exactly when the slug header is the only thing left to
   lose, and the report has to name the one command that moves it. */
test("a slug header alone is reported, with where to put it instead", () => {
  const slugOnly = JSON.stringify({
    mcpServers: { forge: { headers: { "X-Forge-Project-Slug": "sid-growth" } } },
  });
  const out = report(null, {}, { ".mcp.json": slugOnly });
  assert.match(out, /\[ note \] project slug/, "the header is not a source");
  assert.match(out, /\[ miss \] mcp.json[^\n]+`forge doctor --set slug=<project>`/u,
    "the one command that moves it, which writes this machine's record of the project (ISS-1403)");
  assert.doesNotMatch(out, /mcp.json[^\n]+--token/, "nothing about credentials it does not carry");
});

test("no .mcp.json means no line about one", () => {
  assert.doesNotMatch(report(null), /mcp.json/);
});

test("a saved key with no gateway is reported, not passed", () => {
  const out = report({ api_key: "k-abc123" });
  assert.match(out, /\[ note \] vi-natural url\s+no endpoint — `forge doctor --vi-url <endpoint>`/u);
  assert.match(out, /\[ {2}ok {2}\] vi-natural key/, "the half that is configured still reads as configured");
});

/* Two verbs ask for these and every other one runs with neither saved (ISS-102). */
test("a machine with neither cloudflare nor codex configured reads as notes", () => {
  const out = report(null);
  assert.match(out, /\[ note \] cloudflare\s+no account — `forge cloudflare login/);
  assert.match(out, /\[ note \] codex\s+\S/);
});

test("all three configured read as configured", () => {
  const out = report({ api_key: "k-abc123", base_url: "https://gateway.example/v1", model: "gw/some-model" });
  assert.match(out, /\[ {2}ok {2}\] vi-natural url/u);
  assert.match(out, /\[ {2}ok {2}\] vi-natural key/u);
  assert.match(out, /\[ {2}ok {2}\] vi-natural model/u);
});

test("a model is the third setting, and its absence is reported too", () => {
  const out = report({ api_key: "k-abc123", base_url: "https://gateway.example/v1" });
  assert.match(out, /\[ note \] vi-natural model\s+no id — `forge doctor --vi-model <id>`/u);
});

/* Reads and writes differ: `new` translates before it posts, and a read never asks. */
test("the same absent gateway is a miss where the project declares vi", () => {
  const { out } = ofProject({ slug: "x", translate: "vi" });
  assert.match(out, /\[ miss \] vi-natural url/u);
  assert.match(out, /\[ miss \] vi-natural key/u);
  assert.match(out, /\[ miss \] vi-natural model/u);
});

/* The config file is the only source: a variable that once answered for the gateway now answers
   for nothing, and the report has to keep saying MISSING rather than counting it. */
test("the environment is not a source for the gateway", () => {
  const out = report(null, { VI_NATURAL_BASE_URL: "https://gateway.example/v1" });
  assert.match(out, /\[ note \] vi-natural url/u);
  assert.match(out, /\[ note \] vi-natural key/u);
});

test("the gateway is reported with no translate scope set", () => {
  assert.match(report(null), /\[ note \] vi-natural url/u);
});

/* Which copy `forge` on PATH is depends on where it is typed, and one link serves the machine, so
   the report answers for this directory and says what decided it. */
test("the copy a call through the link would run is reported, with why that one", () => {
  const outside = report(null);
  assert.match(outside, /\[ {2}ok {2}\] copy on PATH\s+this \S+ at \S+ — no checkout at or above the working directory/u);
  const home = tempRoom("doctor-home-");
  const tree = join(dirname(CLI), "..", "..");
  const inside = spawnSync(process.execPath, [CLI, "doctor"], {
    encoding: "utf8",
    cwd: tree,
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  assert.match(inside.stdout, /\[ {2}ok {2}\] copy on PATH\s+checkout \S+ at \S+ — the working directory is inside the checkout/u);
});

/* An install holding one entry and not the other answers differently for each: only this shows it. */
test("the copy the gates come from is reported beside the copy on PATH", () => {
  assert.match(report(null), /\[ {2}ok {2}\] copy the gates run\s+this \S+ at \S+ — no checkout at or above the working directory/u);
});


/* Two runs over one configuration, the host gone between them: the first resolves the project and
   leaves its id in the cache beside the credential, so the second proves the report asks anyway.
   `checkEndpoint` empties that cache before it resolves anything, which is why a cached id is no
   way past the read — the question a reader of this has, answered here rather than argued. */
const afterTheHostWent = async () => {
  const tracker = await fakeTracker({
    answer: {
      "forge_projects.list": () => ({ projects: [{ slug: "gone-fixture", id: "1e1c1a1e-0000-4000-8000-00000000000e" }] }),
    },
  });
  const cwd = projectRoom(tempRoom("doctor-gone-"), tracker.env.XDG_CONFIG_HOME,
    { slug: "gone-fixture" });
  const ran = (subject) => ranAsync(process.execPath, [CLI, "doctor", ...(subject ? [subject] : [])], tracker.env, cwd);
  const live = await ran("tracker");
  tracker.close();
  return { live, gone: await ran(), stopped: await ran("brief") };
};

/* AC-01-3-1: a setting that resolved to nothing is reported, not omitted. An exit at the project's
   id costs the report its whole tracker half — the probes, the guide table, the project's settings,
   the brief's goal list — with the reason on a stream this suite never reads (ISS-891). */
test("a tracker that stopped answering is a line of the report and not the end of it", async () => {
  const { live, gone } = await afterTheHostWent();
  assert.match(live.stdout, /\[ {2}ok {2}\] project id\s+resolved from the slug/u,
    "the live run resolved the project, so a cached id is what the second run starts from");
  assert.doesNotMatch(gone.stdout, /\[ {2}ok {2}\] project id/u,
    "and the bare reading leaves that row to `forge doctor tracker` (ISS-1692)");
  assert.doesNotMatch(live.stdout, /\[ miss \] tracker/u, "and a tracker that answered earns no such line");
  assert.match(gone.stdout, /\[ miss \] tracker\s+http:\/\/127\.0\.0\.1:\d+\/api did not answer for this project/u);
  assert.match(gone.stdout, /Forge did not answer GET \/projects/u, "carrying the transport's own reason");
  assert.match(gone.stdout, /Check `endpoint url` and `project slug` above/u,
    "and the route out, by the labels of the rows that hold each rather than by where they sit");
  assert.doesNotMatch(gone.stderr, /^Forge did not answer/mu,
    "the reason is on the surface a caller matches, not the one it never reads");
  assert.equal(gone.status, 1, "a report that reached none of its tracker half is a miss, and the exit says so");
});

/* A subject answers for itself alone, and the reason it could not be read is not another subject's
   news: filtered there, `forge doctor brief` would print nothing and exit 0 (ISS-1692, codex F1). */
test("a subject whose reading the tracker stopped says so and exits on it", async () => {
  const { stopped } = await afterTheHostWent();
  assert.match(stopped.stdout, /\[ miss \] tracker\s+http:\/\/127\.0\.0\.1:\d+\/api did not answer for this project/u,
    "the stop prints in the reading that asked, whatever subject it names");
  assert.doesNotMatch(stopped.stdout, /^project brief/mu, "and the brief it came for is not there");
  assert.equal(stopped.status, 1, "so a reading nobody could take is not a green one");
});

/* Two things refuse at that one read — a host that is not there, and a host that is and holds no
   project by this name — so the line is neutral and the refusal's words tell them apart (3aa1cb F2). */
test("a slug the tracker holds no project for is named as that, not as an endpoint that went quiet", async () => {
  const tracker = await fakeTracker({
    answer: { "forge_projects.list": () => ({ projects: [{ slug: "some-other", id: "1e1c1a1e-0000-4000-8000-00000000000f" }] }) },
  });
  const cwd = projectRoom(tempRoom("doctor-no-slug-"), tracker.env.XDG_CONFIG_HOME,
    { slug: "absent-fixture" });
  const run = await ranAsync(process.execPath, [CLI, "doctor"], tracker.env, cwd);
  tracker.close();
  assert.match(run.stdout, /\[ miss \] tracker\s+.*No Forge project has slug absent-fixture/u);
  assert.match(run.stdout, /Seen: some-other/u, "with what the tracker did hold, which is the route out");
  assert.equal(run.status, 1);
});

/* Only a refusal is a finding: a `TypeError` reported as a tracker that went quiet is this file's
   own bug wearing the environment's clothes (3aa1cb F1). */
test("a read that fails for anything but a refusal is not reported as a tracker that went quiet", async () => {
  const { trackerId } = await import("../../src/tools/doctor.mjs");
  await assert.rejects(() => trackerId(() => {
    throw new TypeError("broken lookup");
  }), /broken lookup/u);
  const { fail } = await import("../../src/resolve/settings.mjs");
  assert.deepEqual(await trackerId(() => fail("the tracker refused\nand a second line nobody reads")),
    { refused: "the tracker refused" });
});

/* The other half of every level above, and the half no stdout assertion sees (ISS-102). */
test("a project that has declared nothing prints notes and exits 0", async () => {
  const { out, status } = await whole({
    baseBranch: null, pipelineConfig: { autoProdDeploy: false },
  });
  assert.match(out, /\[ note \] release model\s+unset on the project/u);
  assert.match(out, /\[ note \] staging branch\s+unset on the project/u);
  assert.doesNotMatch(out, /\[ miss \]/u, "and nothing else in a report of notes says otherwise");
  assert.equal(status, 0, "a report with no miss in it exits 0");
});

/* AC-01-3-2: a gate somebody believes is off must not be silently on. */
test("a switch naming no hook here is a miss, and the report exits 1 for it alone", async () => {
  const { out, status } = await whole(
    { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true } },
    { saved: { hooksOff: ["no-such-gate"] } },
  );
  assert.match(out, /\[ miss \] hooks off\s+no-such-gate is switched off and is no hook here/u);
  assert.equal(status, 1, "one miss anywhere in the report is the exit code");
});

test("an automatic deploy with no branch to land on exits 1", async () => {
  const { out, status } = await whole({
    baseBranch: null, pipelineConfig: { autoProdDeploy: true },
  });
  assert.match(out, /\[ miss \] release policy\s+production deploys are automatic/u);
  assert.equal(status, 1);
});

test("a declared tool that refuses this credential is a note", async () => {
  const { out, status } = await whole({
    baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true },
  });
  assert.match(out, /\[ note \] guides\s+forge_guide is declared but refuses/u);
  assert.equal(status, 0, "a refusal the tracker owns fails nothing here");
});

/* The mode nothing else reads: `install` prints 0600 and the file is what has to carry it, since a
   credential group-readable in a shared home leaks without failing anything. No tracker: the write
   happens before the first call, and the report with no endpoint saved makes none. Run from inside
   a repository, because "outside the repository" is the other half of the claim and a fixture
   standing nowhere proves it by accident (AC-01-1-2). */
test("the saved credential is owner-only, and lands outside the repository it was saved from", () => {
  const TOKEN = "pat-saved-by-this-case";
  const home = tempRoom("doctor-credential-");
  mkdirSync(join(home, "forge"));
  const held = join(home, "forge", "config.json");
  writeFileSync(held, "{}\n");
  chmodSync(held, 0o666);
  const repo = cleanRepo();
  const run = spawnSync(process.execPath, [CLI, "doctor", "--token", TOKEN], {
    encoding: "utf8", cwd: repo, env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  const said = `${run.stdout}${run.stderr}`;
  assert.ok(run.stdout.includes(`Saved token to ${held} (mode 0600)`), said);
  assert.equal(statSync(held).mode & 0o777, 0o600, `the write kept the mode it found: ${said}`);
  assert.equal(JSON.parse(readFileSync(held, "utf8")).token, TOKEN);
  const holds = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((one) => {
    const full = join(dir, one.name);
    if (one.isDirectory()) return holds(full);
    return readFileSync(full, "utf8").includes(TOKEN) ? [full] : [];
  });
  /* The whole checkout and not its root alone: a writer resolving the config dir from the working
     directory would land the token under `.git/`, where a listing of the top level sees nothing. */
  assert.deepEqual(holds(repo), [], "and nothing of the account is written anywhere in the checkout");
});

/* A run that inherited its dispatcher's id carries what every agent that session dispatched carries,
   so the value alone cannot say whether it names a run or a wave: the report says where it came from. */
test("the session id is reported with the source it came from", () => {
  const own = report(null, { FORGE_SESSION_ID: "one-run-of-a-wave" });
  assert.match(own, /\[ {2}ok {2}\] session id\s+one-run-of-a-wave\s+← FORGE_SESSION_ID — this run says which run it is/);

  const shared = report(null, { CLAUDE_CODE_SESSION_ID: "the-dispatching-session" });
  assert.match(shared, /\[ note \] session id\s+the-dispatching-session\s+← CLAUDE_CODE_SESSION_ID/);
  assert.match(shared, /every agent it dispatched carries the same value/, "what the value is shared by");
  assert.match(shared, /names a wave and not a run/, "and what that costs a lease matching it");
  assert.match(shared, /Give each run an id of its own in FORGE_SESSION_ID/, "and the one thing that fixes it");
});

/* Doctor kept its own table keyed on the names `SOURCES` declares, so a source added there printed
   nothing and threw on a name doctor had not got. The label rides on the row that answered instead. */
test("the label doctor prints comes off the source row and not a table keyed on its name", async () => {
  const env = { ...process.env };
  process.env.FORGE_SESSION_ID = "one-run-of-a-wave";
  const { sessionSourced } = await import("../../src/resolve/config.mjs");
  const held = sessionSourced();
  assert.equal(held.source, "asked");
  assert.match(held.said, /FORGE_SESSION_ID/u, "the row says what it means");
  assert.equal(held.said, report(null, { FORGE_SESSION_ID: "one-run-of-a-wave" })
    .split("session id")[1].split("←")[1].split("\n")[0].trim(), "and the report prints that, unchanged");
  const doctor = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "tools", "doctor.mjs"), "utf8");
  assert.ok(!doctor.includes("SESSION_SAID"), "and doctor keeps no table of its own to go stale");
  Object.assign(process.env, env);
});

/* The four keys one flow reads. This is the only surface allowed to say what a project or a machine
   turned off, so each is printed with where it was read: a value and no source reads back as a value
   somebody chose, and the run that acts on it cannot tell a default from a decision. */
const KEYS = { feedback: { plugin: "off", project: "bugs" }, flow: "default", landing: "before-merge" };

test("every key the project set is printed with this machine's record of it as its source", () => {
  const { out, entry } = ofProject({ slug: "demo", ...KEYS });
  assert.match(out, row(OK, "feedback.plugin", "off", entry), out);
  assert.match(out, row(OK, "feedback.project", "bugs", entry));
  assert.match(out, row(OK, "flow", "default", entry));
  assert.match(out, row(OK, "landing", "before-merge", entry));
});

test("a key the project left out is printed at the plugin's default, with the default as its source", () => {
  const { out } = ofProject({ slug: "demo" });
  assert.match(out, /\[ {2}ok {2}\] feedback\.plugin\s+bugs {2}← the plugin's default/u, out);
  assert.match(out, /\[ {2}ok {2}\] feedback\.project\s+all {2}← the plugin's default/u,
    "the two channels default apart, so a project naming one says nothing about the other");
  assert.match(out, /\[ {2}ok {2}\] flow\s+default {2}← the plugin's default/u,
    "the flow in force is the base this copy ships, and it says that is where it came from");
  assert.match(out, /\[ {2}ok {2}\] landing\s+unset, so the branches on the tracker's record derive/u,
    "the route alone has no default: unanswered is derived from the record, never invented here");
});

/* A project left on `method` is served `default` and told to move, never read as unset. */
test("a project still carrying the retired method key is told the flow it was read as", () => {
  const read = ofProject({ slug: "demo", method: 1 });
  assert.match(read.out, row(MISS, "flow", "default, read off the retired `method: 1`", read.entry), read.out);
  assert.match(read.out, new RegExp(`${escaped(read.entry)}\\. Set \`flow\` instead`, "u"),
    "and the route out is on the same line as the file that owes it");
  const bad = ofProject({ slug: "demo", method: 4 });
  assert.match(bad.out, new RegExp(`\\[ miss \\] flow\\s+${escaped(bad.entry)} sets \`method: 4\`, and \`method\` is retired`, "u"), bad.out);
  assert.match(bad.out, new RegExp(`\\[ miss \\] contract\\s+${escaped(bad.entry)} sets \`method: 4\``, "u"),
    "and the contract line gives the same answer rather than reporting a missing file");
});

/* Read back off the file rather than off the report, because what a later `ship` reads is the file:
   a report that agreed with itself and wrote nothing would leave the mode a fiction of one process. */
const shipped = (home, mode) => {
  const cwd = projectRoom(tempRoom("doctor-ship-cwd-"), home, { slug: "demo" });
  const run = spawnSync(process.execPath, [CLI, "doctor", "--ship", mode], {
    encoding: "utf8", cwd, env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  return { out: run.stdout, entry: projectEntry(cwd, home), saved: join(home, "forge", "config.json") };
};

test("the landing mode is the machine's: it is written to the user config and the project's file is untouched", () => {
  const home = tempRoom("doctor-ship-home-");
  const { entry, saved } = shipped(home, "ready");
  assert.equal(JSON.parse(readFileSync(saved, "utf8")).ship, "ready", "the mode is in the user config");
  assert.deepEqual(JSON.parse(readFileSync(entry, "utf8")), { slug: "demo" },
    "and this machine's record of the project is exactly as it was: the machine decided, not the project");
});

test("the mode the report prints is the mode last written, either way", () => {
  const home = tempRoom("doctor-mode-home-");
  assert.match(shipped(home, "ready").out, /\[ {2}ok {2}\] ship\s+ready {2}← \S+config\.json/u);
  assert.match(shipped(home, "self").out, /\[ {2}ok {2}\] ship\s+self {2}← \S+config\.json/u,
    "and self is written rather than cleared, so the report never has to guess which way a silence means");
});

/* Three answers: an absent key and a pattern nothing can compile decide the same claim and mean
   opposite things, and only this surface says which of the two a project wrote (ISS-1872). */
test("what a project calls a run's own work is printed with its source, and an unreadable pattern is said rather than dropped", () => {
  const declared = ofProject({ slug: "demo", lease: { workingRe: "run\\.mjs ship" } });
  assert.match(declared.out, row(OK, "lease.workingRe", escaped("run\\.mjs ship"), declared.entry), declared.out);

  const { out: silent } = ofProject({ slug: "demo" });
  assert.match(silent, /\[ {2}ok {2}\] lease\.workingRe\s+unset, so no process in a tree reads as a run working there/u,
    "the project that has not chosen is told it has not, rather than shown a default it never set");

  const { out: broken } = ofProject({ slug: "demo", lease: { workingRe: "ship(" } });
  assert.match(broken, /\[ miss \] lease\.workingRe\s+ship\( is no regular expression/u, broken);
  assert.match(broken, /a claim over a live sibling is taken/u,
    "and what the project loses by it, which is the whole reason the row is not silence");
});

/* The claim reads the declaration off this machine's record of the project the tree belongs to, so
   the row reads it off the same place: one answering for this directory advertises a protection no
   refusal applies (ISS-1872). The stranded file below is what that record replaced — read by
   nothing since ISS-1403, and a directory deep in the checkout is where one is left behind. */
test("the declaration reported is this project's record, not a `.forge.json` the call stands beside", () => {
  const home = tempRoom("doctor-work-home-");
  const root = projectRoom(tempRoom("doctor-work-root-"), home,
    { slug: "demo", lease: { workingRe: "the-root-declaration" } });
  const inner = join(root, "inner");
  mkdirSync(inner);
  writeFileSync(join(inner, ".forge.json"), JSON.stringify({ slug: "demo", lease: { workingRe: "the-nested-declaration" } }));
  const run = spawnSync(process.execPath, [CLI, "doctor"], {
    encoding: "utf8", cwd: inner, env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  assert.match(run.stdout, row(OK, "lease.workingRe", "the-root-declaration\\b", projectEntry(root, home)),
    run.stdout);
  assert.doesNotMatch(run.stdout, /the-nested-declaration/u,
    "the file this directory happens to sit beside decides nothing the claim will read");
});

/* The project's, so the report reads it out of this project's record and the account's own file has
   none of it; and no flag writes it, so a value the key cannot use is met there, not at a write
   (ISS-1157). */
const withRuns = (runs) => ofProject({ slug: "demo", ...runs });

test("the number of parallel runs is the project's: it is read out of the project's record, with that file named as its source", () => {
  const home = tempRoom("doctor-runs-home-");
  const cwd = projectRoom(tempRoom("doctor-runs-cwd-"), home, { slug: "demo", runs: 3 });
  const run = spawnSync(process.execPath, [CLI, "doctor"], {
    encoding: "utf8", cwd, env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  assert.match(run.stdout, row(OK, "parallel runs", "3\\b", projectEntry(cwd, home)), run.stdout);
  assert.equal(existsSync(join(home, "forge", "config.json")), false,
    "and nothing of it reached the account's own file: the project decided, not the machine");
});

test("a number left behind in the account's own configuration is not read, and is not rewritten either", () => {
  const home = tempRoom("doctor-runs-stale-");
  mkdirSync(join(home, "forge"));
  const stale = join(home, "forge", "config.json");
  writeFileSync(stale, JSON.stringify({ runs: 9 }));
  const cwd = projectRoom(tempRoom("doctor-runs-stale-cwd-"), home, { slug: "demo", runs: 3 });
  const run = spawnSync(process.execPath, [CLI, "doctor"], {
    encoding: "utf8", cwd, env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  assert.match(run.stdout, row(OK, "parallel runs", "3\\b", projectEntry(cwd, home)), run.stdout);
  assert.equal(JSON.parse(readFileSync(stale, "utf8")).runs, 9,
    "the stale value was rewritten, so the migration this project chose is not the one it got");
});

/* The number is one ceiling over the project and every master reads its value here, so the meaning
   travels on the line the value travels on: a report printing the value alone left each master to
   supply a reading of its own, and two of them supplied opposite ones (ISS-1707). */
test("a declared number is reported as the whole project's at once, not as one this session may take afresh", () => {
  const { out } = withRuns({ runs: 3 });
  assert.match(out, /\[ {2}ok {2}\] parallel runs\s+3 at once for the whole project, whoever dispatched them/u, out);
  assert.match(out, /a second master sizes itself by what is left rather than taking this number afresh/u,
    "the line says the number is shared, so a second master reading it cannot take the whole of it");
});

test("a project that declares no number of runs is told the key is unset and what follows from that", () => {
  const { out } = withRuns({});
  assert.match(out, /\[ {2}ok {2}\] parallel runs\s+unset, so a wave is sized by whoever dispatches it and a gate declines for no sibling/u,
    out);
});

/* The doors a consult is demanded at are a setting like the rest: a switch nobody can read the
   current value of is one people guess at, and the empty list has to be told from the absent key. */
const withDoors = (project) => ofProject({ slug: "p", ...project });
const withOwed = (codex) => withDoors({ codex });

test("the doors a consult is demanded at are reported with the file they were read from", () => {
  const armed = { codex: { owed: ["gate", "commit"] }, stats: { commands: { gate: "make verify" } } };
  const { out, entry } = withDoors(armed);
  assert.match(out, row(OK, "codex.owed", escaped("gate at `make verify`, commit — each held until "
    + "a consult has read what it would judge, and each command door at what `stats.commands` names"),
  entry), out);
});

test("the key absent is the commit alone and the empty list is no door, and the report tells them apart", () => {
  assert.match(withOwed({}).out, /\[ {2}ok {2}\] codex\.owed\s+commit — each held until a consult has read what it would judge {2}← the plugin's default/u,
    "absent, the commit asks, which is what this did before the key");
  const empty = withOwed({ owed: [] });
  assert.match(empty.out, row(OK, "codex.owed", "nothing — the key is an empty list, so no door asks", empty.entry),
    "and an empty list is the off switch, read off the project rather than off the default");
});

test("a door the key does not take is reported as one, naming what the key takes, and holds nothing", () => {
  for (const given of [["refuse"], "gate", [1], 3]) {
    const { out } = withOwed({ owed: given });
    assert.match(out, /\[ miss \] codex\.owed\s+\S+ is no value of this key/u, `\`${JSON.stringify(given)}\` was taken: ${out}`);
    assert.match(out, /it takes gate, commit, ship/u, "the report does not say what the key takes");
    assert.match(out, /reading commit {2}←/u, "nor that the default is what it fell back on");
  }
});

test("a number of runs the key does not take is reported as one, naming what the key takes, and bounds nothing", () => {
  for (const given of [0, -1, "two", 1.5]) {
    const { out } = withRuns({ runs: given });
    assert.match(out, /\[ miss \] parallel runs\s+\S+ is no value of this key/u, `\`${given}\` was taken: ${out}`);
    assert.match(out, /a whole number above 0/u, "the report does not say what the key takes");
    assert.match(out, /no bound/u, "nor what follows from a value it cannot use");
  }
});

/* A diagnostic that minted an id would be answering its own question, and a wave would race one file. */
test("the report mints no session id to have one to report", () => {
  const home = tempRoom("doctor-session-");
  const run = spawnSync(process.execPath, [CLI, "doctor"], {
    encoding: "utf8",
    cwd: tempRoom("doctor-session-cwd-"),
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  assert.match(run.stdout, /\[ {2}ok {2}\] session id\s+none held yet/, run.stdout);
  assert.match(run.stdout, /mints it and saves it at/, "and says which verb would, and where");
  assert.equal(existsSync(join(home, "forge", "session.json")), false, "and the report wrote none");
});

/* Two sources answer "who judges": the flow asks, the project's key decides. The report says they
   disagree and changes neither — ISS-1088, and `flowJudgeConflict`'s own case carries the wording. */
test("a flow asking for a judge the project's configuration does not name is a miss, and nothing is rewritten", async () => {
  const { out, status, entry } = await whole(
    { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true, qa: "builder" } },
    { project: { flow: "screen" } },
  );
  assert.match(out, /\[ miss \] flow\s+flow screen asks for independent judgement/u,
    "the conflict is a miss and names the flow that asked");
  assert.match(out, /this project's configuration says builder/u, "beside the key that answered otherwise");
  assert.match(out, /change the flow, or the project's qa configuration/u, "and both ways out");
  assert.equal(status, 1, "a report holding a miss exits on it");
  assert.match(out, row(OK, "flow", "screen", entry),
    "and the key itself is still read and reported as the project's own");
});

test("a project whose configuration names the judgement its flow asks for earns no conflict", async () => {
  const { out } = await whole(
    { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true, qa: "independent" } },
    { project: { flow: "screen" } },
  );
  assert.doesNotMatch(out, /\[ miss \] flow/u, "the two sources agree, so there is nothing to report");
  assert.match(out, /independent judgement\s+independent between developed/u, "and the key is reported as it stands");
});

/* One line per flow this copy serves: the set a project chooses between is visible where it is
   chosen, and a flow accidentally without a part is what the line catches (ISS-1088). */
test("the contract each flow serves is reported, one line per flow", () => {
  const out = report(null, {}, {}, "serves");
  assert.match(out, /\[ {2}ok {2}\] flow set\s+default: \d+ part\(s\)/u);
  assert.match(out, /\[ {2}ok {2}\] flow set\s+screen: \d+ part\(s\)/u,
    "the second flow's set is not reported, so a project choosing it chooses blind");
});

/* The name join at the surface it prints on. The row this fake tracker serves carries a column no
   shaper reads and nothing declares, so both directions have something to say; and it carries a
   sentinel under each of the two credential columns, which is the case that says no path of this
   report renders one. */
const HELD = "a-sentinel-no-report-may-print";
const withRow = async (project, subject) => {
  const tracker = await fakeTracker({
    answer: {
      "forge_projects.list": () => ({ projects: [{ slug: "join-fixture", id: "1e1c1a1e-0000-4000-8000-000000000011" }] }),
      "forge_projects.get": () => ({ project }),
      forge_guide: () => ({ refused: "this credential may not read guides" }),
    },
  });
  const cwd = projectRoom(tempRoom("doctor-join-"), tracker.env.XDG_CONFIG_HOME, { slug: "join-fixture" });
  const run = await ranAsync(process.execPath, [CLI, "doctor", ...(subject ? [subject] : [])], tracker.env, cwd);
  tracker.close();
  return run;
};
const GROWN = { retryBudget: 3, webhookSecret: HELD, apiKey: HELD };

test("a bare reading carries the name join's findings and nothing else of it", async () => {
  const bare = await withRow(GROWN);
  assert.match(bare.stdout, /\[ miss \] name join\s+forge_projects\.get never asks for retryBudget/u,
    "a column the tracker grew and nothing here reads reaches the first command a session runs");
  assert.match(bare.stdout, /\[ miss \] name join\s+forge_config\.get never asks for retryBudget/u,
    "on every shaper that projects the row, not the first one to be asked");
  assert.doesNotMatch(bare.stdout, /\[ {2}ok {2}\] name join/u,
    "while the reading that passed waits to be asked for, as every row of this subject does");
  assert.equal(bare.status, 1, "a report holding a finding is not a green one");
});

test("the tracker subject carries the whole reading, dated and bounded", async () => {
  const asked = await withRow(GROWN, "tracker");
  assert.match(asked.stdout, /\[ {2}ok {2}\] name join\s+read \d{4}-\d{2}-\d{2} off GET \/projects\/:id/u);
  assert.match(asked.stdout, /nothing inside any of them/u,
    "the bound is printed, so a green top-level reading is not read as covering a nested shape");
  assert.match(asked.stdout, /\[ miss \] name join\s+forge_projects\.get never asks for retryBudget/u);
});

test("no line of the report names either credential column, or the value the row held under one", async () => {
  for (const run of [await withRow(GROWN), await withRow(GROWN, "tracker")]) {
    for (const name of ["webhookSecret", "apiKey", HELD]) {
      assert.equal(run.stdout.includes(name), false, `${name} reached the report:\n${run.stdout}`);
      assert.equal(run.stderr.includes(name), false, `${name} reached stderr:\n${run.stderr}`);
    }
  }
  assert.match((await withRow(GROWN, "tracker")).stdout, /2 withheld unnamed/u,
    "and a reader is told two were withheld rather than told nothing");
});
