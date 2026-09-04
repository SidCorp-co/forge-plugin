/* A setting doctor does not read is a green report in front of a command that cannot run. */
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { cleanRepo, fakeTracker, tempRoom } from "../fixtures.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli.mjs");

/* Built rather than filtered: naming the variables to drop is a list that goes stale the day one is
   added, and the developer's own would otherwise answer for half of every fixture. */
const report = (viConfig, extra = {}, project = {}) => {
  const home = tempRoom("doctor-home-");
  if (viConfig) {
    mkdirSync(join(home, "vi-natural"));
    writeFileSync(join(home, "vi-natural", "config.json"), JSON.stringify(viConfig));
  }
  const cwd = tempRoom("doctor-cwd-");
  for (const [name, body] of Object.entries(project)) writeFileSync(join(cwd, name), body);
  const run = spawnSync(process.execPath, [CLI, "doctor"], {
    encoding: "utf8",
    cwd,
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home, ...extra },
  });
  return run.stdout;
};


const MCP_FORGE = JSON.stringify({
  mcpServers: { forge: { url: "https://old.example/mcp", headers: { Authorization: "Bearer t" } } },
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
  assert.match(out, /\[ miss \] mcp.json[^\n]+`\{ "slug": "<project>" \}` in a \.forge\.json/);
  assert.doesNotMatch(out, /mcp.json[^\n]+--token/, "nothing about credentials it does not carry");
});

test("no .mcp.json means no line about one", () => {
  assert.doesNotMatch(report(null), /mcp.json/);
});

test("a saved key with no gateway is reported, not passed", () => {
  const out = report({ api_key: "k-abc123" });
  assert.match(out, /\[ note \] vi-natural gateway\s+run `vi-natural login --base-url/);
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
  assert.match(out, /\[ {2}ok {2}\] vi-natural gateway/);
  assert.match(out, /\[ {2}ok {2}\] vi-natural key/);
  assert.match(out, /\[ {2}ok {2}\] vi-natural model/);
});

test("a model is the third setting, and its absence is reported too", () => {
  const out = report({ api_key: "k-abc123", base_url: "https://gateway.example/v1" });
  assert.match(out, /\[ note \] vi-natural model\s+run `vi-natural login --model/);
});

/* Reads and writes differ: `new` translates before it posts, and a read never asks. */
test("the same absent gateway is a miss where the project declares vi", () => {
  const out = report(null, {}, { ".forge.json": JSON.stringify({ slug: "x", translate: "vi" }) });
  assert.match(out, /\[ miss \] vi-natural gateway/);
  assert.match(out, /\[ miss \] vi-natural key/);
  assert.match(out, /\[ miss \] vi-natural model/);
});

/* The config file is the only source: a variable that once answered for the gateway now answers
   for nothing, and the report has to keep saying MISSING rather than counting it. */
test("the environment is not a source for the gateway", () => {
  const out = report(null, { VI_NATURAL_BASE_URL: "https://gateway.example/v1" });
  assert.match(out, /\[ note \] vi-natural gateway/);
  assert.match(out, /\[ note \] vi-natural key/);
});

test("the gateway is reported with no translate scope set", () => {
  assert.match(report(null), /\[ note \] vi-natural gateway/);
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

/* The project's release policy is the tracker's to answer, and the report names it in the words its
   owner uses: the staging branch, never the field's own name (ISS-90). It is also the only fixture
   whose exit code means anything, `report` above exiting 1 on its missing credential alone; and
   `forge_guide` refuses because a tracker serving no guide retires every row the plugin holds. */
const whole = async (config, { previewDeploy = null, saved = {}, project = {} } = {}) => {
  const tracker = await fakeTracker({
    answer: {
      "forge_projects.list": () => ({ projects: [{ slug: "release-fixture", id: "1e1c1a1e-0000-4000-8000-000000000001" }] }),
      forge_config: () => ({ config }),
      "forge_projects.get": () => ({ project: { previewDeploy } }),
      forge_guide: () => ({ refused: "this credential may not read guides" }),
    },
  });
  const held = join(tracker.env.XDG_CONFIG_HOME, "forge", "config.json");
  writeFileSync(held, JSON.stringify({ ...JSON.parse(readFileSync(held, "utf8")), ...saved }));
  const cwd = tempRoom("doctor-release-");
  writeFileSync(join(cwd, ".forge.json"), JSON.stringify({ slug: "release-fixture" }));
  for (const [name, body] of Object.entries(project)) writeFileSync(join(cwd, name), body);
  /* Awaited, not waited on: this test is the tracker the report asks, and spawnSync holds the loop
     that would answer it. */
  const answered = await new Promise((done) => {
    const child = spawn(process.execPath, [CLI, "doctor"], { cwd, env: tracker.env });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.on("close", (status) => done({ out, status }));
    child.stdin.end();
  });
  tracker.close();
  return answered;
};

const releaseReport = async (config, previewDeploy = null) => (await whole(config, { previewDeploy })).out;

test("the three release values are reported with where they came from", async () => {
  const out = await releaseReport({
    baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: true },
  });
  assert.match(out, /\[ {2}ok {2}\] staging branch\s+master {2}← the tracker's project config/u);
  assert.match(out, /\[ {2}ok {2}\] production branch\s+master {2}← the tracker's project config/u);
  assert.match(out, /\[ {2}ok {2}\] production deploy\s+automatic — a user-facing change ships without a person's look/u);
  assert.doesNotMatch(out, /baseBranch/u, "and the tracker's own field name is not what a reader is shown");
});

test("an automatic production deploy with no branch to land on is a finding", async () => {
  const out = await releaseReport({
    baseBranch: null, productionBranch: "master", pipelineConfig: { autoProdDeploy: true },
  });
  assert.match(out, /\[ note \] staging branch\s+unset on the project/u,
    "the blank itself belongs to the tracker's project config and is a note");
  assert.match(out, /\[ miss \] release policy\s+production deploys are automatic and the staging branch is unset/u);
  assert.match(out, /a person's look is owed until the branch is set/u);
  assert.match(out, /production deploy\s+automatic — a user-facing change waits for a person's look/u,
    "the strict reading is what the report says too");
});

/* The deploy the flow walks a change against is the other half of the same answer: a branch with no
   host behind it means the verification `released` owes cites the branch alone (ISS-92). */
test("a staging branch with no deploy behind it is a note, not a failure", async () => {
  const out = await releaseReport({
    baseBranch: "staging", productionBranch: "master", pipelineConfig: { autoProdDeploy: false },
  });
  assert.match(out, /\[ note \] staging deploy\s+none on record while the staging branch is named/u);
  assert.match(out, /cites the branch and no running host — `forge project`/u, "and names the verb that answers");
});

test("a deploy on record is reported by count, and its credential is not printed", async () => {
  const out = await releaseReport(
    { baseBranch: "staging", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
    { stagingUrl: "https://beta.example.test", testCredentials: [{ password: "correct-horse-battery" }] },
  );
  assert.match(out, /\[ {2}ok {2}\] staging deploy\s+1 host\(s\) on record, test credentials too/u);
  assert.match(out, /forge project --credentials/u, "the report says where the value is read, never the value");
  assert.doesNotMatch(out, /correct-horse-battery/u);
  assert.doesNotMatch(out, /previewDeploy/u, "and the tracker's own field name is not what a reader is shown");
});

/* The other half of every level above, and the half no stdout assertion sees (ISS-102). */
test("a project whose branches are unset prints notes and exits 0", async () => {
  const { out, status } = await whole({
    baseBranch: null, productionBranch: null, pipelineConfig: { autoProdDeploy: false },
  });
  assert.match(out, /\[ note \] staging branch\s+unset on the project/u);
  assert.match(out, /\[ note \] production branch\s+unset on the project/u);
  assert.doesNotMatch(out, /\[ miss \]/u, "and nothing else in a report of notes says otherwise");
  assert.equal(status, 0, "a report with no miss in it exits 0");
});

/* AC-01-3-2: a gate somebody believes is off must not be silently on. */
test("a switch naming no hook here is a miss, and the report exits 1 for it alone", async () => {
  const { out, status } = await whole(
    { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: true } },
    { saved: { hooksOff: ["no-such-gate"] } },
  );
  assert.match(out, /\[ miss \] hooks off\s+no-such-gate is switched off and is no hook here/u);
  assert.equal(status, 1, "one miss anywhere in the report is the exit code");
});

test("an automatic deploy with no branch to land on exits 1", async () => {
  const { out, status } = await whole({
    baseBranch: null, productionBranch: null, pipelineConfig: { autoProdDeploy: true },
  });
  assert.match(out, /\[ miss \] release policy\s+production deploys are automatic/u);
  assert.equal(status, 1);
});

test("a declared tool that refuses this credential is a note", async () => {
  const { out, status } = await whole({
    baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: true },
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
  assert.match(run.stdout, new RegExp(`Saved token to ${held} \\(mode 0600\\)`, "u"), said);
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
