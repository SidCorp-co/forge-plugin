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
import { helpOf } from "../../src/resolve/visibility.mjs";

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
const flat = (text) => text.replace(/\s+/gu, " ");

/* Named as a citation and never as an entry ticket: most issues carry no identity, the rung asking
   for none, and a method telling a judge it is refused without one sends it to park what the code
   lets through — the defect surviving in the served text after the checker stopped holding it
   (ISS-1788). What still has to be there is the ban on working one out. */
test("the judging method names the deployment identity as a citation and no refusal for its absence", () => {
  for (const flow of FLOWS) {
    const text = judging(flow);
    const paragraph = text.split(/\n\s*\n/u).find((one) => /deployment identity/u.test(one));
    assert.ok(paragraph, `${flow} does not name the deployment identity at all`);
    assert.match(paragraph, /deriving one of your own/u,
      "nothing says a judge may not work one out from a branch or a deploy log");
    const absent = text.split(/\n\s*\n/u).find((one) => /refuses you nothing/u.test(one));
    assert.ok(absent, `${flow} says nothing about a brief that carries no identity`);
    assert.match(absent, /the commit each already names/u,
      "a judge told it is not refused still has to be told what its verdicts are held to instead");
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
    const paragraph = flat(judging(flow).split(/\n\s*\n/u).find((one) => /ttach/u.test(one)) ?? "");
    assert.ok(paragraph, `${flow} asks for the thing it looked at nowhere`);
    assert.match(paragraph, /check for it by name/u, "a capture tool the project installs is counted on unchecked");
    assert.match(paragraph, /say it is absent/u, "and its absence goes unsaid, reading as a state nobody took");
    assert.match(paragraph, /goes through the shell because what you attach has to be a file somebody else can open/u,
      `${flow}: the capture's reason is not the reader who opens it`);
    assert.doesNotMatch(flat(judging(flow)), /fix what it found/u,
      `${flow}: the capture is justified by a judge's ability to fix code, in a method whose rule is not to`);
  }
  const cli = flat(judging("default"));
  assert.match(cli, /Where a route reaches what you looked at, attach it/u,
    "the flow with no screen asks unconditionally, and no tree guarantees a route");
  assert.match(cli, /a session captured with `script`[^.]*a body fetched into one/u,
    "a judge reading a CLI lost the captures that show one");
  /* ISS-1813: a terminal session and a fetched body show no screen, and the builder's own table refuses them. */
  const screen = flat(judging("screen").split(/\n\s*\n/u).find((one) => /Attach what you saw/u.test(one)) ?? "");
  assert.match(screen, /the artifact is the rendered state, driven .* including the empty, loading and error states/u,
    "the screen judge is offered something other than what a person sees");
  assert.match(screen, /A terminal session and a fetched body are not that artifact/u,
    "the default's captures stand in the screen copy as if they showed a screen");
  assert.doesNotMatch(screen, /`script`/u, "a terminal capture is still offered as a screen's artifact");
});

test("a tool the qa role's frontmatter withholds is named as one it does not have", () => {
  const text = roleText("qa");
  const granted = (field(text, "tools") ?? "").split(",").map((one) => one.trim());
  for (const withheld of ["Write", "Edit"]) {
    assert.ok(!granted.includes(withheld), `${withheld} is granted, so the text says the opposite of the frontmatter`);
  }
  const card = flat(text);
  assert.match(card, /`Write` and `Edit` are off your tool list on purpose — judging and building are two runs/u,
    "a missing writing tool reads as an oversight, and the next reader grants it back");
  assert.doesNotMatch(card, /fix what it found/u, "the card withholds the writing tools for a reason about fixing code");
  assert.match(card, /`Read`, `Grep` and `Glob` are for locating a defect you have already seen at the running product, and never for establishing a pass/u,
    "the card grants the read tools and says nothing about when source may be opened");
  assert.doesNotMatch(card, /Source is read to validate/u, "the method's rule is copied into the card, a second copy");
});

/* ISS-1813: the cheapest answer to a criterion is the code that implements it, which is the builder's proof again. */
test("the judging method opens source only on a defect already seen", () => {
  for (const flow of FLOWS) {
    const text = flat(judging(flow));
    assert.match(text, /\*\*Source is read to validate a defect, never to establish a pass\.\*\*/u, `${flow}: no rule`);
    assert.match(text, /Where you have seen something wrong there, reading the (code|source) that produced it/u,
      `${flow}: the one honest use of the source is not named`);
    assert.match(text, /Where a criterion looks met, opening the source to confirm it re-derives the proof the builder already made/u,
      `${flow}: a pass established from the code is still open to the judge`);
  }
});

/* ISS-1813: ISS-1691's judge took its screenshot off a local production build of the right commit. */
test("the judging method takes every artifact off the deployment the brief names", () => {
  for (const flow of FLOWS) {
    const estate = flat(judging(flow).split(/\n\s*\n/u).find((one) => /comes off that deployment/u.test(one)) ?? "");
    assert.match(estate, /is the builder's proof and never yours, however exactly its sha matches/u,
      `${flow}: a local render at the right sha reads as a judge's evidence`);
    assert.match(estate, /the criterion is `skipped`, its `--why` naming what was missing; a local (run|render) is not the fallback/u,
      `${flow}: a criterion no route reaches on the deployment falls back to a local render`);
  }
  const screen = flat(judging("screen"));
  assert.match(screen, /a pass citing a render taken on a route of the deployed host that does not authenticate/u,
    "the no-login pass shape names no estate");
  assert.doesNotMatch(screen, /render taken where no login is needed/u, "the unqualified no-login pass shape stands");
});

/* ISS-1813 and AC-05-1-8: the owed read speaks about credentials only where none are held. */
test("the judge reads the credentials the project holds before any skip for want of one", () => {
  for (const flow of FLOWS) {
    const text = flat(judging(flow));
    const read = text.indexOf("`forge doctor project`");
    assert.ok(read > 0 && read < text.indexOf("Work each criterion"), `${flow}: no read of what the project holds, ahead of the judging`);
    assert.match(text, /`forge doctor --credentials` prints them/u, `${flow}: the held values have no route`);
    assert.match(text, /is not a finding that (the project holds none|none are held)/u,
      `${flow}: the owed read's silence still reads as an answer`);
    assert.match(text, /a skip for want of a credential is written only after that read has said none is held/iu,
      `${flow}: a credential skip is written before anybody looked`);
  }
  const master = flat(skillGuideAnswer("qa", PLUGIN, "screen")({}).lines.join("\n"));
  assert.match(master, /judge's own read, at `forge doctor project`, and never a value copied into the message/u,
    "the screen master points the judge at the read that is silent where credentials are held");
});

/* ISS-1813: the method said how to capture and never what a person opens a screen to answer. */
test("the screen judging method states what a screen judgement asks, and makes none of it a criterion", () => {
  const text = flat(judging("screen"));
  for (const question of [/the product's own conventions, not yours/u, /clean and usable, set against the way the rest of this product/u,
    /is the data a user reads correct — the numbers, the labels, the locale, the empty and the loading state/u,
    /does it fit what the person in your charter is actually asking of it/u]) {
    assert.match(text, question, `the screen judge is not asked ${question}`);
  }
  assert.match(text, /Ask them while you exercise every criterion, and report what they found on every run/u,
    "the questions are listed and never asked");
  assert.match(text, /they add no criterion, they move nothing about what earns `testing`/u,
    "the questions read as criteria, moving what the status is earned by");
  assert.match(text, /one demonstrating no harm goes on the backlog as its own row/u, "the harm bar is not the one they answer to");
  assert.doesNotMatch(flat(judging("default")), /What a screen judgement asks/u, "a CLI judge is asked a screen's questions");
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
  const screen = flat(judging("screen"));
  assert.match(screen, /stricter under a plan declaring a screen\s+change/u,
    "and the flow with a screen says nothing about what that declaration makes owed");
  assert.match(screen, /Where it holds nothing that reaches one, two shapes still get past/u,
    "the two shapes read as the acceptable verdicts rather than as the route past a credential nobody has");
  assert.match(screen, /the ordinary shape is what you write/u,
    "so a judge with a route to the product is sent down the escape it does not need");
});

/* ISS-3145: judges ran the gate and the suites in a builder's tree, and brought up local stacks, while
   the deployment served the same commit. Each assertion is the sentence that keeps a judge on it. */
test("the judging method keeps the judge on the deployment and off a checkout's runs", () => {
  for (const flow of FLOWS) {
    const text = judging(flow);
    const paragraphOf = (pattern) => text.split(/\n\s*\n/u).find((one) => pattern.test(one)) ?? "";
    const reach = paragraphOf(/only a checkout's run reaches/u);
    assert.match(reach, /Write it `skipped`/u, `${flow}: a checkout-only criterion is given no verdict shape`);
    assert.match(reach, /who owes\s+that evidence/u, `${flow}: the skip names nobody to show it`);
    const drive = paragraphOf(/one thing you drive/u);
    for (const banned of [/never run the project's gate, a test suite or anything that brings up a stack/u,
      /never build the\s+commit/u, /never work in a builder's worktree/u]) {
      assert.match(drive, banned, `${flow}: ${banned} is not said`);
    }
    assert.match(paragraphOf(/plainly does not carry/u), /stop and report that\s+before judging anything/u,
      `${flow}: a deployment without the change is judged anyway`);
    assert.match(paragraphOf(/refuses you nothing/u), /never work an\s+identity out of the source or out of a local build/u,
      `${flow}: a judge with no identity may still work one out`);
  }
});

test("the masters that dispatch a judge name the judge's brief, and set down a change nothing serves", () => {
  for (const flow of FLOWS) {
    for (const slug of ["qa", "dispatch"]) {
      const text = skillGuideAnswer(slug, PLUGIN, flow)({}).lines.join("\n");
      assert.match(text, /`forge brief[\s\S]{0,20}--judge --url/u, `${slug} under ${flow} sends a judge no address`);
    }
    const master = skillGuideAnswer("qa", PLUGIN, flow)({}).lines.join("\n");
    assert.match(master, /whose change the deployment does not yet serve is that case, set down/u,
      `qa under ${flow} judges at a commit nothing serves`);
    assert.doesNotMatch(master, /judged at the commit its verdicts carry/u, `qa under ${flow} still licenses a local build`);
  }
});

test("the brief's help, its hook page and its document name the judge's form", () => {
  assert.match(helpOf("brief"), /--judge --url/u, "-h names no judge form");
  assert.match(readFileSync(join(PLUGIN, "hooks", "how", "brief.md"), "utf8"), /--judge --url/u,
    "the hook's page names no way to brief a judge");
  assert.match(readFileSync(join(PLUGIN, "..", "docs", "cli", "brief.md"), "utf8"), /## The judge's form/u,
    "the verb's page says nothing about the form");
});

test("the roles ship inside the plugin directory, where a copy of it travels alone", () => {
  for (const name of rolesIn()) {
    assert.ok(readFileSync(join(PLUGIN, WITHIN, `${name}.md`), "utf8").length > 0);
  }
});
