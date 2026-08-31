/* A setting doctor does not read is a green report in front of a command that cannot run. */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.mjs");

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
