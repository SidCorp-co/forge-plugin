/* This machine's own half of `forge doctor`: the keys it writes here rather than on the project's record, and the level each harness row answers. One table carries the keys, so the check that refuses a project flag beside one of these and the dispatch that spends them are the same list — two lists is what let two releases in a row each add a key to one and to the other (ISS-1046). */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { tempRoom } from "../../../fixtures.mjs";
import { MACHINE_FLAGS, MACHINE_KEY_NAMES } from "../../../../src/tools/doctor-keys.mjs";
import { LEVELS } from "../../../../src/tools/services/doctor/showing.mjs";

const CLI = new URL("../../../../src/cli.mjs", import.meta.url).pathname;

/* A port nothing listens on, refused at once, where a name that does not resolve costs every spawn a DNS wait no deadline here bounds. The report is spawned as few times as the claims allow: it reads the whole documents tree every run, so each of these costs seconds that have nothing to do with the keys. */
const machineRun = (argv, body = {}) => {
  const home = tempRoom("doctor-machine-");
  mkdirSync(join(home, "forge"));
  const path = join(home, "forge", "config.json");
  writeFileSync(path, JSON.stringify({
    url: "http://127.0.0.1:1/mcp", token: "saved-token", retrySeconds: 0, waitSeconds: 0.05, ...body,
  }));
  const run = spawnSync(process.execPath, [CLI, "doctor", ...argv], {
    encoding: "utf8",
    cwd: tempRoom("doctor-machine-cwd-"),
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  return { ...run, saved: () => JSON.parse(readFileSync(path, "utf8")) };
};

test("one call carrying every flag of the table reaches every writer, and each writes the key its flag names", () => {
  const run = machineRun([
    "--token", "fresh-token", "--url", "https://fresh.example/mcp",
    "--ship", "ready", "--hide", "issue", "--show", "comment",
    "--codex-url", "https://gateway.example", "--codex-key", "gateway-key",
    "--vi-url", "https://vi.example", "--vi-key", "vi-key", "--vi-model", "vi/model",
    "--chatgpt-url", "https://gpt.example/mcp", "--chatgpt-key", "gpt-key",
    "--chatgpt-prefix", "Flat vector, no text.",
  ], { withheld: ["comment"] });
  const saved = run.saved();
  assert.equal(saved.token, "fresh-token");
  assert.equal(saved.url, "https://fresh.example/mcp");
  assert.equal(saved.ship, "ready");
  assert.deepEqual(saved.withheld, { issue: "hidden" },
    "--hide added one and --show took the other away, so both writers ran");
  assert.deepEqual(saved.codex, { url: "https://gateway.example", key: "gateway-key" });
  assert.deepEqual(saved.vi, { url: "https://vi.example", key: "vi-key", model: "vi/model" });
  assert.deepEqual(saved.chatgpt,
    { url: "https://gpt.example/mcp", key: "gpt-key", prefix: "Flat vector, no text." });
  assert.deepEqual(MACHINE_FLAGS,
    ["job", "hide", "show", "ship", "token", "url", "codex-url", "codex-key",
      "vi-url", "vi-key", "vi-model", "chatgpt-url", "chatgpt-key", "chatgpt-prefix"],
    "and the flags that reached them are the flags the two-stores check filters, off the same table");
});

test("a flag of that table beside a flag of the project's is refused with neither store written", () => {
  const run = machineRun(["--ship", "ready", "--set", "runs=2"]);
  assert.match(run.stderr, /`--set` writes the project's own record and `--ship` writes this machine's/u);
  assert.match(run.stderr, /two stores and two calls\. Nothing was sent/u);
  assert.equal(run.saved().ship, undefined, "the machine's half was not written before the refusal");
});

test("a flag carrying an empty value prints the report and writes nothing", () => {
  const run = machineRun(["--hide", "", "--show", "", "--ship", ""]);
  assert.match(run.stdout, /\[  ok  \] endpoint url/u, "the report did not run");
  assert.doesNotMatch(run.stdout, /is now hidden from|now ends at a pushed branch|now lands its own change/u);
  assert.equal(run.saved().ship, undefined);
  assert.equal(run.saved().withheld, undefined);
});

test("the level that reaches the exit code is one map's, and miss is the level that reaches it", () => {
  assert.equal(LEVELS.miss, " miss ", "the map sends miss to the mark the report counts");
  assert.equal(LEVELS.note, " note ", "and note to the mark it does not");
  const run = machineRun([], { retrySeconds: "soon" });
  assert.match(run.stdout, /\[ miss \] retry/u, "a row of that mark is in the report");
  assert.equal(run.status, 1, "and the report that printed it exits non-zero");
});

test("a login leaves a key stored beside the accounts standing", () => {
  const home = tempRoom("cloudflare-nested-");
  mkdirSync(join(home, "forge"));
  const path = join(home, "forge", "config.json");
  writeFileSync(path, JSON.stringify({
    cloudflare: { accounts: [], preferred: "a sibling under the same key" },
  }));
  const run = spawnSync(process.execPath, [CLI, "cloudflare", "login", "--name", "one", "--account-id", "a", "--token", "t"], {
    encoding: "utf8",
    cwd: tempRoom("cloudflare-nested-cwd-"),
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  assert.equal(run.status, 0, run.stderr);
  const saved = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(saved.cloudflare.preferred, "a sibling under the same key", "a login replaced the whole nested object");
  assert.equal(saved.cloudflare.accounts.length, 1);
});

/* The table is what refuses a machine key given to `--set`, so a key this plugin reads out of the
   machine's own store and never declared there is not refused at all: it falls through to tracker
   discovery and is written to the project's record, at the level that cannot answer it. `retrySeconds`
   was exactly that, found by a reviewer rather than by anything here. The table is therefore held to
   the reads themselves, in the direction that can go wrong — a declared key nothing reads is a row
   for a setting since retired and costs a reader nothing. */
const MACHINE_ROOT = new URL("../../../../..", import.meta.url).pathname;

const machineReads = () => {
  const found = new Set();
  const walk = (dir) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) {
        if (one.name !== "vendor" && one.name !== "node_modules") walk(join(dir, one.name));
      } else if (one.name.endsWith(".mjs")) {
        const text = readFileSync(join(dir, one.name), "utf8");
        for (const [, key] of text.matchAll(/userConfig\(\)\.([A-Za-z][A-Za-z0-9_]*)/gu)) found.add(key);
      }
    }
  };
  walk(join(MACHINE_ROOT, "plugin", "src"));
  walk(join(MACHINE_ROOT, "plugin", "hooks"));
  walk(join(MACHINE_ROOT, "tools"));
  return [...found].sort();
};

test("every key this plugin reads out of the machine's store is declared in the table that refuses it", () => {
  const read = machineReads();
  assert.ok(read.length > 5, `${read.length} machine read(s) found; the selector matches too little`);
  assert.deepEqual(read.filter((key) => !MACHINE_KEY_NAMES.includes(key)), [],
    "a key read at this level and declared at neither is written to the project's record instead");
});
