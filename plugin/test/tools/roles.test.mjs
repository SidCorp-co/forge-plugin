/* Three ways a role goes wrong in silence: a key the loader ignores, a dispatch-time fact in the
   definition, and a role the copy a session registered lacks. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

import { WITHIN, keysDeclared, roleNames, roleText, rolesDiffer, rolesIn } from "../../src/tools/roles.mjs";
import { skillGuideAnswer } from "../../src/guides/skill-guides.mjs";
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

/* The card is the only text loaded with the role, so it carries the one call that serves the rest:
   a method inside it would be a second copy of the served text, stale a release later. */
test("the qa role's card sends the run to the method served for it", () => {
  const text = roleText("qa");
  assert.match(text, /`forge guide qa judging`/u, "the role names no method, so it has none");
  assert.doesNotMatch(text, /forge guide issue-flow/u,
    "the judge is sent to the builder's own skill, written for the run that wrote the code");
});

/* The rules below were the card's until the role had a method of its own; they are asserted where
   they now live, which is the text the call above serves, read before a run works. */
const judging = (flow) => {
  const held = skillGuideAnswer("qa", PLUGIN, flow)({ part: "judging" });
  assert.ok(held.lines, `qa's judging reference is not served under ${flow}: ${held.refusal}`);
  return held.lines.join("\n");
};
const FLOWS = ["default", "screen"];

test("the judging method names the deployment identity as an input it is refused without", () => {
  for (const flow of FLOWS) {
    const paragraph = judging(flow).split(/\n\s*\n/u).find((one) => /deployment identity/u.test(one));
    assert.ok(paragraph, `${flow} does not name the deployment identity at all`);
    assert.match(paragraph, /\brefused\b/u,
      "the input is named in one place and the refusal stated in another, so neither reads as the other's");
    assert.match(paragraph, /deriving one of your own/u,
      "nothing says a judge may not work one out from a branch or a deploy log");
  }
});

/* The plan's boundary: judging what a declaration asks a person for answers a question nobody asked. */
test("the judging method does not stand in for a review a plan declares a person's", () => {
  for (const flow of FLOWS) {
    assert.match(judging(flow), /person's review/u, `${flow} marks that boundary nowhere`);
  }
});

/* A role's instructions and its tool list are one decision, and this is the instruction a tree may
   not be equipped for: nothing a subagent is granted renders a page (ISS-706). */
test("the ask for an artifact carries the route that produces it", () => {
  for (const flow of FLOWS) {
    const paragraph = judging(flow).split(/\n\s*\n/u).find((one) => /ttach/u.test(one));
    assert.ok(paragraph, `${flow} asks for the thing it looked at nowhere`);
    assert.match(paragraph, /`script`/u, "no route is named, so which tool takes the artifact is the tree's guess");
    assert.match(paragraph, /check for it by name/u, "a capture tool the project installs is counted on unchecked");
    assert.match(paragraph, /say it is absent/u, "and its absence goes unsaid, reading as a state nobody took");
    assert.match(paragraph, /goes through the shell/u, "nothing says how the file it attaches gets written");
  }
  assert.match(judging("default"), /Where a route reaches what you looked at, attach it/u,
    "the flow with no screen asks unconditionally, and no tree guarantees a route");
});

test("a tool the qa role's frontmatter withholds is named as one it does not have", () => {
  const text = roleText("qa");
  const granted = (field(text, "tools") ?? "").split(",").map((one) => one.trim());
  for (const withheld of ["Write", "Edit"]) {
    assert.ok(!granted.includes(withheld), `${withheld} is granted, so the text says the opposite of the frontmatter`);
  }
  assert.match(text, /`Write` and `Edit` are off your tool list on purpose/u,
    "a missing writing tool reads as an oversight, and the next reader grants it back");
});

/* The escape is worth having only ahead of the work: at the verdict write the run is already spent. */
test("the judging method reads what tested will want before it judges a criterion", () => {
  for (const flow of FLOWS) {
    const text = judging(flow);
    const ahead = text.indexOf("--owed");
    assert.ok(ahead > 0, `${flow} names no read that says what the write at the end will want`);
    assert.ok(ahead < text.indexOf("Work each criterion"),
      "that read sits after the judging, which is where the refusal already was");
    assert.match(text, /skip/u, "no verdict shape is named for the criterion no route reaches");
    assert.match(text, /stop before judging/u,
      "a run whose every criterion would be a skip spends itself to say so");
  }
  assert.match(judging("screen"), /demands of a screen\s+change/u,
    "and the flow with a screen says nothing about what that declaration makes owed");
});

test("the roles ship inside the plugin directory, where a copy of it travels alone", () => {
  for (const name of rolesIn()) {
    assert.ok(readFileSync(join(PLUGIN, WITHIN, `${name}.md`), "utf8").length > 0);
  }
});
