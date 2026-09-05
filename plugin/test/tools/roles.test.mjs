/* Three ways a role goes wrong in silence: a key the loader ignores, a dispatch-time fact in the
   definition, and a role the copy a session registered lacks. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

import { WITHIN, keysDeclared, roleNames, roleText, rolesDiffer, rolesIn } from "../../src/tools/roles.mjs";
import { FROZEN, freezesSession } from "../../src/tools/plugin-copy.mjs";

const PLUGIN = new URL("../..", import.meta.url).pathname;

/* Every key Claude Code documents for a subagent, read off the reference on 2026-09-05. A key
   outside this set is one the loader ignores, so the definition reads as if it said nothing. */
const DOCUMENTED = new Set([
  "name", "description", "model", "tools", "disallowedTools", "effort", "permissionMode",
  "maxTurns", "skills", "mcpServers", "hooks", "memory", "background", "isolation", "color",
  "initialPrompt", "experimental",
]);
const MODELS = new Set(["sonnet", "opus", "haiku", "fable", "inherit"]);
const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);

const field = (text, key) => new RegExp(`^${key}:[ \\t]*(.*)$`, "mu").exec(text)?.[1]?.trim() ?? null;

test("the roles a copy ships are read off the directory, and a copy with none is not an error", () => {
  const held = rolesIn();
  assert.ok(held.length >= 3, `${held.length} role(s) shipped; the selector reads the wrong directory`);
  assert.deepEqual(held, [...held].sort(), "unsorted, so two copies of one set compare unequal");
  const empty = tempRoom("roles-none-");
  assert.deepEqual(rolesIn(empty), [], "a copy predating the roles reads as no roles, not as a fault");
  const planted = tempRoom("roles-some-");
  mkdirSync(join(planted, WITHIN), { recursive: true });
  writeFileSync(join(planted, WITHIN, "beta.md"), "---\nname: beta\n---\n");
  writeFileSync(join(planted, WITHIN, "notes.txt"), "not a definition\n");
  assert.deepEqual(rolesIn(planted), ["beta"], "a file that is no definition was counted as a role");
});

test("a dispatcher names a role scoped by the plugin, which is a prefix only this plugin knows", () => {
  const scoped = roleNames("forge");
  assert.deepEqual(scoped, rolesIn().map((one) => `forge:${one}`));
  assert.ok(scoped.every((one) => one.includes(":")), "an unscoped name resolves to no plugin agent");
});

test("every key a shipped role declares is one the loader reads, and its values are in range", () => {
  for (const name of rolesIn()) {
    const text = roleText(name);
    const keys = keysDeclared(text);
    const unknown = keys.filter((one) => !DOCUMENTED.has(one));
    assert.deepEqual(unknown, [], `${name} declares ${unknown.join(", ")}, which the loader ignores`);
    assert.equal(field(text, "name"), name, `${name}.md declares another name; the filename is the name`);
    assert.ok(keys.includes("description"), `${name} has no description, so it is skipped entirely`);
    const model = field(text, "model");
    if (model) assert.ok(MODELS.has(model), `${name} asks for model ${model}`);
    const effort = field(text, "effort");
    if (effort) assert.ok(EFFORTS.has(effort), `${name} asks for effort ${effort}`);
  }
});

/* The issue's own rule: what only the dispatcher knows at dispatch time arrives in the message. A
   definition is written once and read on every wave, so a worktree or an issue key in one is a fact
   that was true for exactly one dispatch. `check:skill-paths` holds the path half. */
test("no role definition carries a fact only the dispatcher knows at dispatch time", () => {
  for (const name of rolesIn()) {
    const body = roleText(name).replace(/^---[\s\S]*?---/u, "");
    assert.doesNotMatch(body, /\bISS-\d+/u, `${name} names an issue, and it is dispatched for many`);
    assert.doesNotMatch(body, /\bwt-[\w-]+/u, `${name} names a worktree that existed for one wave`);
    assert.doesNotMatch(body, /\bmodel:|subagent_type/u, `${name} types what its own frontmatter decides`);
  }
});

/* A definition is re-read while a session runs, but the watcher covers the directories that existed
   when it started — so the first file in a new one is invisible until a restart, and the ship's
   restart line is what tells anybody. */
test("a change under the roles directory freezes the session, as one under the skills does", () => {
  assert.ok(freezesSession(`plugin/${WITHIN}/runner.md`), "a new role reaches no open session unannounced");
  assert.ok(FROZEN.includes(`plugin/${WITHIN}/`), "the ship's restart line reads this set");
});

test("doctor's roles line speaks only where the two copies differ", () => {
  assert.equal(rolesDiffer(["runner"], ["runner"]), null, "a line on every clean run is noise");
  assert.deepEqual(rolesDiffer(["runner", "triage"], ["runner"]),
    { missing: ["triage"], extra: [] }, "a role the loaded copy lacks is a name that will not resolve");
  assert.deepEqual(rolesDiffer(["runner"], ["runner", "old"]), { missing: [], extra: ["old"] });
});

test("the roles ship inside the plugin directory, where a copy of it travels alone", () => {
  for (const name of rolesIn()) {
    assert.ok(readFileSync(join(PLUGIN, WITHIN, `${name}.md`), "utf8").length > 0);
  }
});
