/* This machine's own half of `forge doctor`: the keys it writes here rather than on the project's record, and the level each harness row answers. One table carries the keys, so the check that refuses a project flag beside one of these and the dispatch that spends them are the same list — two lists is what let two releases in a row each add a key to one and to the other (ISS-1046). */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";
import { MACHINE_FLAGS } from "../../../src/tools/doctor-keys.mjs";
import { LEVELS } from "../../../src/tools/doctor.mjs";

const CLI = new URL("../../../src/cli.mjs", import.meta.url).pathname;

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
    "--chatgpt-url", "https://gpt.example/mcp", "--chatgpt-key", "gpt-key",
    "--chatgpt-prefix", "Flat vector, no text.",
  ], { withheld: ["comment"] });
  const saved = run.saved();
  assert.equal(saved.token, "fresh-token");
  assert.equal(saved.url, "https://fresh.example/mcp");
  assert.equal(saved.ship, "ready");
  assert.deepEqual(saved.withheld, ["issue"], "--hide added one and --show took the other away, so both writers ran");
  assert.deepEqual(saved.chatgpt,
    { url: "https://gpt.example/mcp", key: "gpt-key", prefix: "Flat vector, no text." });
  assert.deepEqual(MACHINE_FLAGS,
    ["hide", "show", "ship", "token", "url", "chatgpt-url", "chatgpt-key", "chatgpt-prefix"],
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
  assert.doesNotMatch(run.stdout, /is now withheld from|now ends at a pushed branch|now lands its own change/u);
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
