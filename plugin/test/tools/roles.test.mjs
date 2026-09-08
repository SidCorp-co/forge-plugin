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

/* Doctor's line reads the copy a session registered, so the checkout is where a new role shows first. */
test("the qa role ships beside the other four, and doctor names it where the loaded copy predates it", () => {
  assert.deepEqual(rolesIn(), ["evaluator", "qa", "reviewer", "runner", "triage"],
    "the set a dispatch can name; a role gained or lost without this line moving is a silent change");
  assert.deepEqual(rolesDiffer(rolesIn(), ["evaluator", "reviewer", "runner", "triage"]),
    { missing: ["qa"], extra: [] }, "a copy predating it must be told, or a dispatch naming qa refuses");
});

/* The definition is the only text a run reads before it works, so its one refusing input is stated there. */
test("the qa role's text names the deployment identity as an input it is refused without", () => {
  const text = roleText("qa");
  const paragraph = text.split(/\n\s*\n/u).find((one) => /deployment identity/u.test(one));
  assert.ok(paragraph, "the role does not name the deployment identity at all");
  assert.match(paragraph, /\brefused\b/u,
    "the input is named in one place and the refusal stated in another, so neither reads as the other's");
  assert.match(paragraph, /exit code/u, "nothing says a deploy command's exit code is not the identity");
});

/* The plan's boundary: judging what a declaration asks a person for answers a question nobody asked. */
test("the qa role does not stand in for a review a plan declares a person's", () => {
  assert.match(roleText("qa"), /person's review/u, "nothing in the role marks that boundary");
});

/* A role's instructions and its tool list are one decision, and this is the instruction a tree may
   not be equipped for: nothing a subagent is granted renders a page (ISS-706). */
test("the qa role's ask for an artifact carries the route that produces it", () => {
  const paragraph = roleText("qa").split(/\n\s*\n/u).find((one) => /attach it/u.test(one));
  assert.ok(paragraph, "nothing in the role asks for the thing it looked at");
  assert.match(paragraph, /Where a route reaches/u, "the ask is unconditional, and no tree guarantees a route");
  assert.match(paragraph, /`script`/u, "no route is named, so which tool takes the artifact is the tree's guess");
  assert.match(paragraph, /check for it by name/u, "a capture tool the project installs is counted on unchecked");
  assert.match(paragraph, /say it is absent/u, "and its absence goes unsaid, reading as a state nobody took");
});

test("a tool the qa role's frontmatter withholds is named as one it does not have", () => {
  const text = roleText("qa");
  const granted = (field(text, "tools") ?? "").split(",").map((one) => one.trim());
  for (const withheld of ["Write", "Edit"]) {
    assert.ok(!granted.includes(withheld), `${withheld} is granted, so the text says the opposite of the frontmatter`);
  }
  assert.match(text, /`Write` and\s+`Edit` are off that list on purpose/u,
    "a missing writing tool reads as an oversight, and the next reader grants it back");
  assert.match(text, /goes through the shell/u, "nothing says how the file it attaches gets written");
});

/* The escape is worth having only ahead of the work: at the verdict write the run is already spent. */
test("the qa role reads what tested will want before it judges a criterion", () => {
  const text = roleText("qa");
  const ahead = text.indexOf("--owed");
  assert.ok(ahead > 0, "the role names no read that says what the write at the end will want");
  assert.ok(ahead < text.indexOf("Work each criterion"),
    "that read sits after the judging, which is where the refusal already was");
  const paragraph = text.split(/\n\s*\n/u).find((one) => /--owed/u.test(one));
  assert.match(paragraph, /screen change/u, "and nothing says which declaration makes the attachment owed");
  assert.match(paragraph, /skip/u, "no verdict shape is named for the criterion no route reaches");
  assert.match(paragraph, /forge guide issue-flow verification/u, "and the rest of that case is cited nowhere");
  assert.match(text, /stop before judging/u, "a run whose every criterion would be a skip spends itself to say so");
});

test("the roles ship inside the plugin directory, where a copy of it travels alone", () => {
  for (const name of rolesIn()) {
    assert.ok(readFileSync(join(PLUGIN, WITHIN, `${name}.md`), "utf8").length > 0);
  }
});
