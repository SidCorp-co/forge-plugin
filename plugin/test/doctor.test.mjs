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
const report = (viConfig, extra = {}) => {
  const home = mkdtempSync(join(tmpdir(), "doctor-home-"));
  if (viConfig) {
    mkdirSync(join(home, "vi-natural"));
    writeFileSync(join(home, "vi-natural", "config.json"), JSON.stringify(viConfig));
  }
  const run = spawnSync(process.execPath, [CLI, "doctor"], {
    encoding: "utf8",
    cwd: mkdtempSync(join(tmpdir(), "doctor-cwd-")),
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home, ...extra },
  });
  return run.stdout;
};

test("a saved key with no gateway is reported, not passed", () => {
  const out = report({ api_key: "k-abc123" });
  assert.match(out, /\[ miss \] vi-natural gateway\s+run `vi-natural login --base-url/);
  assert.match(out, /\[ {2}ok {2}\] vi-natural key/, "the half that is configured still reads as configured");
});

test("both halves configured read as configured", () => {
  const out = report({ api_key: "k-abc123", base_url: "https://gateway.example/v1" });
  assert.match(out, /\[ {2}ok {2}\] vi-natural gateway/);
  assert.match(out, /\[ {2}ok {2}\] vi-natural key/);
});

test("either half may come from the environment", () => {
  const out = report(null, { VI_NATURAL_BASE_URL: "https://gateway.example/v1" });
  assert.match(out, /\[ {2}ok {2}\] vi-natural gateway\s+from the environment/);
  assert.match(out, /\[ miss \] vi-natural key/);
});

test("the gateway is reported with no translate scope set", () => {
  assert.match(report(null), /\[ miss \] vi-natural gateway/);
});
