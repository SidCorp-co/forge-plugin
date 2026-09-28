/* The gateway profile as the shell reads it: a bash-sourced file keeping its live key in a sibling it
   sources. The spawned cases hold what a machine reports and the in-process ones the order and the
   expansion, each over a home of its own — the real one holds a live token. docs/cli/settings.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const TOKEN = "sk-nested-token-cccc";
const GUARDED = '[ -f "$HOME/.claude/claude-proxy-token.env" ] && . "$HOME/.claude/claude-proxy-token.env"';

const homeWith = (profile, token = `ANTHROPIC_AUTH_TOKEN=${TOKEN}\n`) => {
  const home = tempRoom("gateway-profile-");
  mkdirSync(join(home, ".claude"), { recursive: true });
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "config.json"),
    JSON.stringify({ url: "http://127.0.0.1:1/mcp", token: "t", retrySeconds: 0 }));
  writeFileSync(join(home, ".claude", "claude-proxy.env"), profile);
  if (token !== null) writeFileSync(join(home, ".claude", "claude-proxy-token.env"), token);
  return home;
};

const env = (home) => {
  const own = { ...process.env, HOME: home, XDG_CONFIG_HOME: home };
  delete own.CLAUDE_PROXY_ENV;
  return own;
};

const forge = (home, ...argv) =>
  spawnSync(FORGE, argv, { encoding: "utf8", cwd: home, env: env(home) });

/* Imported under a home of this file's own, so `homedir()` inside the reader is that home. */
const HOME = tempRoom("gateway-profile-unit-");
process.env.HOME = HOME;
const { profileFrom } = await import("../../../src/resolve/machine/profile.mjs");

const lineOf = (said, label) => said.stdout.split("\n").find((line) => line.startsWith(label)) ?? "";

test("a key held only in a guarded sourced file resolves, and the report names that file", () => {
  const home = homeWith(`ANTHROPIC_BASE_URL=https://gw.example\n# bash-sourced under set -a\n${GUARDED}\n`);
  const nested = join(home, ".claude", "claude-proxy-token.env");
  const shown = forge(home, "codex", "show");
  assert.equal(lineOf(shown, "profile"), `profile   : ${join(home, ".claude", "claude-proxy.env")}`,
    "no problem stands beside the profile");
  assert.match(lineOf(shown, "credential"), new RegExp(`set \\(${TOKEN.length} chars\\)  ← ${nested}$`, "u"));
  const doctor = forge(home, "doctor", "services");
  assert.match(doctor.stdout, new RegExp(`codex key\\s+set \\(${TOKEN.length} chars\\)  ← ${nested}\\n`, "u"));
});

test("each source form the shell guards a profile with is followed", () => {
  for (const line of [
    ". ~/.claude/claude-proxy-token.env",
    "source ${HOME}/.claude/claude-proxy-token.env",
    'test -f "$HOME/.claude/claude-proxy-token.env" && source "$HOME/.claude/claude-proxy-token.env"',
    `KEYS="$HOME/.claude"\n. "$KEYS/claude-proxy-token.env"`,
  ]) {
    const home = homeWith(`ANTHROPIC_BASE_URL=https://gw.example\n${line}\n`);
    const shown = forge(home, "codex", "show");
    assert.match(lineOf(shown, "credential"), /^credential: set /u, `${line}\n${shown.stdout}`);
  }
});

test("a credential still missing names each source that was not followed, and why", () => {
  const home = homeWith(
    `ANTHROPIC_BASE_URL=https://gw.example\n${GUARDED}\n. "$ELSEWHERE/keys.env"\nsource "$(dirname "$0")/t.env"\n`,
    null);
  const nested = join(home, ".claude", "claude-proxy-token.env");
  const shown = lineOf(forge(home, "codex", "show"), "profile");
  assert.ok(shown.includes(`${nested} (absent, so its guard skipped it)`), shown);
  assert.ok(shown.includes('"$ELSEWHERE/keys.env" ($ELSEWHERE, which neither the profile above it nor HOME sets)'), shown);
  assert.ok(shown.includes('source "$(dirname "$0")/t.env" (a statement this reader does not follow)'), shown);
  const consult = forge(home, "codex", "consult", "x.md");
  assert.notEqual(consult.status, 0);
  assert.ok(consult.stderr.includes(`${nested} (absent, so its guard skipped it)`), consult.stderr);
});

test("an unreadable sourced file is named as unreadable", () => {
  const home = homeWith(`ANTHROPIC_BASE_URL=https://gw.example\n. ${join(HOME, "not-a-file")}/\n`, null);
  mkdirSync(join(HOME, "not-a-file"), { recursive: true });
  const shown = lineOf(forge(home, "codex", "show"), "profile");
  assert.match(shown, /not-a-file\/ \(unreadable \(EISDIR\)\)/u, shown);
});

test("reading the profile writes none of the files it read", () => {
  const home = homeWith(`ANTHROPIC_BASE_URL=https://gw.example\n${GUARDED}\n`);
  const files = [".claude/claude-proxy.env", ".claude/claude-proxy-token.env", "forge/config.json"]
    .map((one) => join(home, one));
  const before = files.map((one) => readFileSync(one, "utf8"));
  forge(home, "codex", "show");
  forge(home, "doctor");
  assert.deepEqual(files.map((one) => readFileSync(one, "utf8")), before);
});

test("the sourced file replaces what came before it, and a later line replaces the sourced file", () => {
  const nested = join(HOME, "order.env");
  writeFileSync(nested, "ANTHROPIC_AUTH_TOKEN=from-nested\nANTHROPIC_BASE_URL=https://nested.example\n");
  const { values, from } = profileFrom(
    `ANTHROPIC_AUTH_TOKEN=before\nANTHROPIC_BASE_URL=https://before.example\n. ${nested}\nANTHROPIC_BASE_URL=https://after.example\n`,
    join(HOME, "profile.env"));
  assert.equal(values.ANTHROPIC_AUTH_TOKEN, "from-nested");
  assert.equal(from.ANTHROPIC_AUTH_TOKEN, nested);
  assert.equal(values.ANTHROPIC_BASE_URL, "https://after.example");
  assert.equal(from.ANTHROPIC_BASE_URL, join(HOME, "profile.env"));
});

test("a profile that sources itself, directly or through another file, is read to its end", () => {
  const profile = join(HOME, "loop.env");
  const other = join(HOME, "loop-other.env");
  writeFileSync(profile, `A=1\n. ${profile}\n. ${other}\nB=2\n`);
  writeFileSync(other, `C=3\n. ${profile}\n`);
  const { values, unfollowed } = profileFrom(readFileSync(profile, "utf8"), profile);
  assert.deepEqual(values, { A: "1", C: "3", B: "2" });
  assert.deepEqual(unfollowed.map((one) => [one.file, one.in]), [[profile, profile], [profile, other]]);
});
