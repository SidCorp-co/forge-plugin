/* A setting doctor does not read is a green report in front of a command that cannot run. */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { fakeTracker } from "../fixtures.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli.mjs");

/* Built rather than filtered: naming the variables to drop is a list that goes stale the day one is
   added, and the developer's own would otherwise answer for half of every fixture. */
const report = (viConfig, extra = {}, project = {}) => {
  const home = mkdtempSync(join(tmpdir(), "doctor-home-"));
  if (viConfig) {
    mkdirSync(join(home, "vi-natural"));
    writeFileSync(join(home, "vi-natural", "config.json"), JSON.stringify(viConfig));
  }
  const cwd = mkdtempSync(join(tmpdir(), "doctor-cwd-"));
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
  assert.match(out, /\[ miss \] project slug/, "the header is not a source");
  assert.match(out, /\[ miss \] mcp.json[^\n]+`\{ "slug": "<project>" \}` in a \.forge\.json/);
  assert.doesNotMatch(out, /mcp.json[^\n]+--token/, "nothing about credentials it does not carry");
});

test("no .mcp.json means no line about one", () => {
  assert.doesNotMatch(report(null), /mcp.json/);
});

test("a saved key with no gateway is reported, not passed", () => {
  const out = report({ api_key: "k-abc123" });
  assert.match(out, /\[ miss \] vi-natural gateway\s+run `vi-natural login --base-url/);
  assert.match(out, /\[ {2}ok {2}\] vi-natural key/, "the half that is configured still reads as configured");
});

test("all three configured read as configured", () => {
  const out = report({ api_key: "k-abc123", base_url: "https://gateway.example/v1", model: "gw/some-model" });
  assert.match(out, /\[ {2}ok {2}\] vi-natural gateway/);
  assert.match(out, /\[ {2}ok {2}\] vi-natural key/);
  assert.match(out, /\[ {2}ok {2}\] vi-natural model/);
});

test("a model is the third setting, and its absence is reported too", () => {
  const out = report({ api_key: "k-abc123", base_url: "https://gateway.example/v1" });
  assert.match(out, /\[ miss \] vi-natural model\s+run `vi-natural login --model/);
});

/* The config file is the only source: a variable that once answered for the gateway now answers
   for nothing, and the report has to keep saying MISSING rather than counting it. */
test("the environment is not a source for the gateway", () => {
  const out = report(null, { VI_NATURAL_BASE_URL: "https://gateway.example/v1" });
  assert.match(out, /\[ miss \] vi-natural gateway/);
  assert.match(out, /\[ miss \] vi-natural key/);
});

test("the gateway is reported with no translate scope set", () => {
  assert.match(report(null), /\[ miss \] vi-natural gateway/);
});

/* Which copy `forge` on PATH is depends on where it is typed, and one link serves the machine, so
   the report answers for this directory and says what decided it. */
test("the copy a call through the link would run is reported, with why that one", () => {
  const outside = report(null);
  assert.match(outside, /\[ {2}ok {2}\] copy on PATH\s+this \S+ at \S+ — no checkout at or above the working directory/u);
  const home = mkdtempSync(join(tmpdir(), "doctor-home-"));
  const tree = join(dirname(CLI), "..", "..");
  const inside = spawnSync(process.execPath, [CLI, "doctor"], {
    encoding: "utf8",
    cwd: tree,
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  assert.match(inside.stdout, /\[ {2}ok {2}\] copy on PATH\s+checkout \S+ at \S+ — the working directory is inside the checkout/u);
});

/* The project's release policy is the tracker's to answer, and the report names it in the words its
   owner uses: the staging branch, never the field's own name (ISS-90). */
const releaseReport = async (config, previewDeploy = null) => {
  const tracker = await fakeTracker({
    answer: {
      "forge_projects.list": () => ({ projects: [{ slug: "release-fixture", id: "1e1c1a1e-0000-4000-8000-000000000001" }] }),
      forge_config: () => ({ config }),
      "forge_projects.get": () => ({ project: { previewDeploy } }),
    },
  });
  const cwd = mkdtempSync(join(tmpdir(), "doctor-release-"));
  writeFileSync(join(cwd, ".forge.json"), JSON.stringify({ slug: "release-fixture" }));
  /* Awaited, not waited on: this test is the tracker the report asks, and spawnSync holds the loop
     that would answer it. */
  const out = await new Promise((done) => {
    const child = spawn(process.execPath, [CLI, "doctor"], { cwd, env: tracker.env });
    let held = "";
    child.stdout.on("data", (chunk) => {
      held += chunk;
    });
    child.on("close", () => done(held));
    child.stdin.end();
  });
  tracker.close();
  return out;
};

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
  assert.match(out, /\[ miss \] staging branch\s+unset on the project/u);
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
