/* The one store table, from both ends: which file answers for a key, what the report says answered,
   and what a write leaves on disk. Spawned throughout, because the property is what a machine holds
   rather than what a function returns, and every home here is this suite's own — the real one holds a
   live token. docs/cli/settings.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const VI = new URL("../../../bin/vi-natural", import.meta.url).pathname;

const PROFILE_URL = "https://profile.example";
const PROFILE_KEY = "profile-token-aaaa";
const VI_URL = "https://vi-file.example";
const VI_KEY = "vi-file-key-bbbb";

/* A home per case: these cases write, and a shared one would read what another left. */
const homeWith = (config) => {
  const home = tempRoom("machine-keys-");
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "config.json"),
    JSON.stringify({ url: "http://127.0.0.1:1/mcp", token: "t", ...config }));
  mkdirSync(join(home, "vi-natural"), { recursive: true });
  writeFileSync(join(home, "vi-natural", "config.json"),
    JSON.stringify({ base_url: VI_URL, api_key: VI_KEY, model: "vi/file-model" }));
  writeFileSync(join(home, "proxy.env"),
    `ANTHROPIC_BASE_URL=${PROFILE_URL}\nANTHROPIC_AUTH_TOKEN=${PROFILE_KEY}\n`
    + "ANTHROPIC_DEFAULT_FABLE_MODEL=cx/from-the-slot\n");
  return home;
};

const run = (home, binary, ...argv) => spawnSync(binary, argv, {
  encoding: "utf8",
  env: { ...process.env, HOME: home, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") },
});

const rowsOf = (home) => {
  const said = run(home, FORGE, "doctor", "services");
  return Object.fromEntries(said.stdout.split("\n")
    .map((line) => /^\[[^\]]+\]\s+(\S.*?)\s\s+(.*)$/u.exec(line))
    .filter(Boolean)
    .map((found) => [found[1], found[2]]));
};

const configAt = (home) => JSON.parse(readFileSync(join(home, "forge", "config.json"), "utf8"));

/* The machine that worked before the plugin held a key of its own for either tool, which has to keep
   working, with the report saying which file it is working off. */
test("a machine holding only the files each tool owns answers from those files, and the report names them", () => {
  const home = homeWith({});
  const rows = rowsOf(home);
  assert.equal(rows["codex url"], `${PROFILE_URL}  ← ${join(home, "proxy.env")}`);
  assert.ok(rows["codex key"].endsWith(`← ${join(home, "proxy.env")}`), rows["codex key"]);
  assert.equal(rows["vi-natural url"], `${VI_URL}  ← ${join(home, "vi-natural", "config.json")}`);
  assert.ok(rows["vi-natural model"].endsWith(`← ${join(home, "vi-natural", "config.json")}`),
    rows["vi-natural model"]);
  assert.match(run(home, VI, "doctor").stdout, new RegExp(`base url\\s+: ${VI_URL}`, "u"),
    "and the bundled CLI reads the same file it always did");
});

/* Per key rather than per store: a store answering wholly from one file would hide a reader that
   took the whole object. */
test("the plugin's own configuration answers before the file a tool owns, key by key", () => {
  const home = homeWith({ codex: { url: "https://plugin.example" }, vi: { model: "vi/plugin-model" } });
  const rows = rowsOf(home);
  const own = join(home, "forge", "config.json");
  assert.equal(rows["codex url"], `https://plugin.example  ← ${own}`);
  assert.ok(rows["codex key"].endsWith(`← ${join(home, "proxy.env")}`),
    "the key beside it is unset here and still answers from the profile");
  assert.equal(rows["vi-natural model"], `vi/plugin-model  ← ${own}`);
  assert.ok(rows["vi-natural url"].endsWith(`← ${join(home, "vi-natural", "config.json")}`),
    rows["vi-natural url"]);
  assert.match(run(home, VI, "doctor").stdout, new RegExp(`model\\s+: vi/plugin-model`, "u"));
});

test("an option typed on the call outranks both files", () => {
  const home = homeWith({ vi: { model: "vi/plugin-model" } });
  assert.match(run(home, VI, "doctor", "--model", "vi/typed").stdout,
    /model\s+: vi\/typed \(effort low\)\s+← the option on this call/u);
});

/* The file the shim reads is this plugin's to read and nobody's to write. */
test("the gateway profile is left byte for byte, and its model slot still resolves", () => {
  const home = homeWith({});
  const before = readFileSync(join(home, "proxy.env"), "utf8");
  run(home, FORGE, "doctor", "--codex-url", "https://plugin.example", "--codex-key", "plugin-key-cccc");
  assert.equal(readFileSync(join(home, "proxy.env"), "utf8"), before);
  assert.match(run(home, FORGE, "codex", "show").stdout, /cx\/from-the-slot/u);
});

/* What the flags leave on disk, at what permissions, and that what is reported is what the file
   reads back rather than what the call was handed. */
test("a service key lands in the plugin's own configuration at owner-only permissions and is reported off it", () => {
  const home = homeWith({});
  const said = run(home, FORGE, "doctor", "--codex-url", "https://plugin.example", "--codex-key", "plugin-key-cccc");
  assert.match(said.stdout, /which the file now reads back as:/u, said.stderr);
  const own = join(home, "forge", "config.json");
  assert.ok(said.stdout.includes(`codex url  https://plugin.example  ← ${own}`),
    `the row a write reports names no file of its own: ${said.stdout}`);
  assert.ok(said.stdout.split("\n").filter((line) => line.startsWith("  codex "))
    .every((line) => line.endsWith(own)), "every row of the acknowledgement names it, not the heading alone");
  assert.deepEqual(configAt(home).codex, { url: "https://plugin.example", key: "plugin-key-cccc" });
  assert.equal(statSync(join(home, "forge", "config.json")).mode & 0o777, 0o600);
  run(home, FORGE, "doctor", "--vi-url", "https://vi-plugin.example",
    "--vi-key", "vi-plugin-key-dddd", "--vi-model", "vi/plugin-model");
  assert.deepEqual(configAt(home).vi,
    { url: "https://vi-plugin.example", key: "vi-plugin-key-dddd", model: "vi/plugin-model" });
});

/* `codex` holds the slot name and the rungs too, and a write replacing the object would take the
   reviewer's model with it. */
test("a write of one key of a store leaves every sibling key of that store standing", () => {
  const home = homeWith({ codex: { model: "opus", url: "https://old.example" } });
  run(home, FORGE, "doctor", "--codex-url", "https://new.example");
  assert.deepEqual(configAt(home).codex, { model: "opus", url: "https://new.example" });
});

/* Only the flag that already unmasks the tracker credential prints one of these. */
test("no credential of a store is printed by the report or by the write that saved it", () => {
  const home = homeWith({});
  const said = run(home, FORGE, "doctor", "--codex-key", "plugin-key-cccc", "--codex-url", "https://plugin.example");
  assert.ok(!said.stdout.includes("plugin-key-cccc"), `the write printed the credential: ${said.stdout}`);
  assert.match(said.stdout, /codex key {2}set \(15 chars\)/u);
  const rows = rowsOf(home);
  assert.match(rows["codex key"], /^set \(15 chars\)/u);
  assert.ok(!rows["vi-natural key"].includes(VI_KEY), "the row for a fallback credential shows it too");
  const full = run(home, FORGE, "doctor", "services", "--full");
  assert.match(full.stdout, /plugin…cccc \(15 chars\)/u, "and --full is the one act that widens it");
});

test("a store key given nothing is refused, and the file stands as it was", () => {
  const home = homeWith({ vi: { key: "vi-plugin-key-dddd" } });
  const said = run(home, FORGE, "doctor", "--vi-key", "   ");
  assert.notEqual(said.status, 0);
  assert.match(said.stderr, /--vi-key was given nothing/u);
  assert.match(said.stderr, /remove `vi\.key` from the file by hand/u);
  assert.equal(configAt(home).vi.key, "vi-plugin-key-dddd");
});

/* The undo the precedence would otherwise cost: a login writing the file that answers for nothing. */
test("a login into the file a tool owns says which file the value in force came from", () => {
  const home = homeWith({ vi: { url: "https://plugin.example" } });
  const said = run(home, VI, "login", "--key", "typed-key-eeee", "--base-url", "https://ignored.example");
  assert.match(said.stderr, /the url in force is .*forge\/config\.json's/u);
  assert.match(said.stderr, /forge doctor --vi-url <value>/u);
});
