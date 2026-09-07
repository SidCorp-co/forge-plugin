/* A path under the config home is resolved at the call and never at import: static imports are hoisted
   above the `XDG_CONFIG_HOME` a test sets, so a module-level constant built from `configDir()` names the
   developer's own home, and the test then reads the live credential or writes beside it (ISS-683). The
   walk is the checker and the case after it is the behaviour it guards. */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PLUGIN = new URL("../../", import.meta.url).pathname;
const WALKED = ["src", "hooks"];

const OFF_THE_HOME = "configDir|userConfig|configPath|sessionPath|statePath|lockPath|logPath|hookLogPath";
const AT_IMPORT = new RegExp(String.raw`^(?:export )?const \w+ = (?!\(|async\b|\w+ =>|once\()[^;]*\b(?:${OFF_THE_HOME})\(`, "u");

const sources = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  if (statSync(full).isDirectory()) return sources(full);
  return full.endsWith(".mjs") ? [full] : [];
});

test("no module under plugin/src or plugin/hooks binds a config path or reads the config at import", () => {
  const found = WALKED.flatMap((one) => sources(join(PLUGIN, one))).flatMap((file) =>
    readFileSync(file, "utf8").split("\n").flatMap((line, at) =>
      (AT_IMPORT.test(line) ? [`${file.slice(PLUGIN.length)}:${at + 1}  ${line.trim()}`] : [])));
  assert.deepEqual(found, [], "bound at import, so it names whatever XDG_CONFIG_HOME was when the module loaded");
});

test("configPath follows XDG_CONFIG_HOME at the call, so a home set after the import is the one read", async () => {
  const { configPath } = await import("../../src/resolve/config.mjs");
  const before = process.env.XDG_CONFIG_HOME;
  try {
    process.env.XDG_CONFIG_HOME = join("/", "a-home");
    assert.equal(configPath(), join("/", "a-home", "forge", "config.json"));
    process.env.XDG_CONFIG_HOME = join("/", "b-home");
    assert.equal(configPath(), join("/", "b-home", "forge", "config.json"));
  } finally {
    if (before === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = before;
  }
});
