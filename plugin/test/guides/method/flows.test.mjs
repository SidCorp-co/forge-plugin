/* What each shipped flow serves, read through the verb rather than off the directory: a project
   pinning `screen` and one pinning nothing are two different readers of the same commands, and the
   difference between them is the whole of what the flow axis buys. Every assertion here is watched
   failing by removing the sentence it names from the flow's own part (ISS-1088). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { flat, tempHome, tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("screen-flow").path;
const { DEFAULT, SCREEN } = await import("../../../src/guides/flow.mjs");
const { skillGuideSlugs } = await import("../../../src/guides/skill-guides.mjs");

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const FORGE = join(PLUGIN, "bin", "forge");

/* One flow per process, the resolver answering once, so every reading spawns the verb. */
const served = (flow, ...argv) => {
  const dir = tempRoom("screen-flow-");
  writeFileSync(join(dir, ".forge.json"), JSON.stringify({ slug: "screen-fixture", ...(flow ? { flow } : {}) }));
  const run = spawnSync(FORGE, argv, { encoding: "utf8", env: { ...process.env }, cwd: dir });
  assert.equal(run.status, 0, `\`forge ${argv.join(" ")}\` under ${flow ?? "no key"} exited ${run.status}: ${run.stderr}`);
  return flat(run.stdout);
};

/* The same call with its line breaks kept, which is the only way a heading can be told from the
   paragraph under it once `flat` has run. */
const headings = (flow, ...argv) => {
  const dir = tempRoom("screen-flow-");
  writeFileSync(join(dir, ".forge.json"), JSON.stringify({ slug: "screen-fixture", ...(flow ? { flow } : {}) }));
  const run = spawnSync(FORGE, argv, { encoding: "utf8", env: { ...process.env }, cwd: dir });
  assert.equal(run.status, 0, `\`forge ${argv.join(" ")}\` under ${flow ?? "no key"} exited ${run.status}: ${run.stderr}`);
  return run.stdout.split("\n").filter((one) => one.startsWith("#"));
};

const method = (flow) => served(flow, "guide", "issue-flow");
const verification = (flow) => served(flow, "guide", "issue-flow", "verification");

test("the handover to a judge is the screen flow's, and no flow serves it to a project with no screen", () => {
  assert.match(method(SCREEN), /the handoff is that status\*\* — not a message and not a lease/u,
    "criterion 1: the screen method does not serve the phase that hands the issue to a judge");
  assert.doesNotMatch(method(null), /the handoff is that status/u,
    "criterion 1: a project pinning nothing is told to hand off to a judge this flow has no rung for");
  assert.match(method(SCREEN), /Flow screen, which this project runs/u, "and the answer names the flow it was served for");
});

test("the rendered state is the screen flow's page, and default holds only what its refusal needs", () => {
  const held = verification(DEFAULT);
  assert.doesNotMatch(held, /## Screenshots/u,
    "criterion 2: default serves a section about taking a screenshot to a project with no screen");
  assert.doesNotMatch(held, /suspect the environment before/u,
    "criterion 2: default serves the browser-shaped environment section");
  /* And the row it was kept for: a plan on this flow may not declare a screen change at all, so the
     refusal that row is the route out of is one no project here can meet (ISS-1694). */
  assert.doesNotMatch(held, /refuses a verdict under a declared screen change/u,
    "default serves the rendered-state row to a project whose plans cannot declare a screen change");
  assert.doesNotMatch(held, /flow: screen/u,
    "criterion 8: default names another flow, and a flow's text is read by a project that runs it alone");
  const screen = verification(SCREEN);
  assert.match(screen, /## Screenshots/u, "criterion 2: the screen flow serves no screenshot section");
  assert.match(screen, /the rendered state, driven/u, "criterion 2: the screen flow serves no rendered-state row");
});

/* Which reader a paragraph is addressed to is the one thing no fence could decide, so the placement
   is the method's: the branch of Phase 5 that sorts the reader by who this project made the judge is
   what serves the judging method, and the reference a builder reads while proving carries none of it
   (ISS-1695). Every selector below is watched failing by putting the section back. */
test("the builder's proving reference carries no judging method, and keeps everything it proves with", () => {
  for (const line of headings(SCREEN, "guide", "issue-flow", "verification")) {
    assert.doesNotMatch(line, /judge/u, `criterion 1: the proving reference still heads a section at a judge: ${line}`);
  }
  const held = verification(SCREEN);
  assert.doesNotMatch(held, /mapped to a criterion/u,
    "criterion 2: the proving reference still instructs the charter, which only a run that judges writes");
  assert.doesNotMatch(held, /material harm/u,
    "criterion 3: the proving reference still carries the threshold a finding is judged against");
  assert.doesNotMatch(held, /QA report/u,
    "criterion 4: the proving reference still sends a capture to a report the builder never writes");
  assert.match(held, /suspect the environment before/u,
    "criterion 5: a hot-reload connection is a local symptom, and the section that names it went with the judging method");
  assert.match(held, /development overlays and error badges land in the image/u,
    "criterion 6: the builder is a capturer, and the craft of capturing went with the judging method");
  assert.match(held, /Two verdict shapes get past `testing`/u,
    "criterion 7: the shapes the entry check lets past went, and the flow with no judge still carries them");
  const none = verification(DEFAULT);
  assert.doesNotMatch(none, /mapped to a criterion/u, "and the flow with no judge serves no charter");
  assert.doesNotMatch(none, /material harm/u, "and no blocking line, which is what these selectors are watched on");
});

test("Phase 5 serves the judging method to the builder this project made the judge, and names no other skill", () => {
  const held = served(SCREEN, "guide", "issue-flow", "5");
  assert.match(held, /charter is written before any observation is mapped to a criterion/u,
    "criterion 8: the charter is served without the ordering that is the whole of it");
  assert.match(held, /the role being played, the task being attempted, the state it starts from, the result it intends/u,
    "criterion 9: the charter does not say what it has to cover");
  assert.match(held, /one alternate state or role/u,
    "criterion 9: the charter reaches no state the person arrives at by accident");
  assert.match(held, /demonstrates material harm to a task this change is meant to support/u,
    "criterion 10: nothing says which finding is worth a repair");
  assert.match(held, /the steps that reproduce it, the behaviour expected/u,
    "criterion 11: nothing says what a finding worth a repair carries");
  assert.match(held, /each an issue of their own rather than this one's to answer/u,
    "criterion 12: nothing says where a finding that earns no repair goes instead");
  assert.doesNotMatch(held, /Which findings are worth a repair/u,
    "criterion 13: the disposition is served here and the phase still sends a reader elsewhere for it");
  assert.doesNotMatch(held, /forge guide qa/u,
    "criterion 14: a phase of one skill sends its reader into another skill's text");
  const none = served(DEFAULT, "guide", "issue-flow", "5");
  assert.doesNotMatch(none, /charter/u, "and the flow with no screen serves no charter");
  assert.doesNotMatch(none, /material harm/u, "and no threshold, which is what these selectors are watched on");
});

test("the screen flow leaves the identity on the issue, and a repair is judged again at the new one", () => {
  const held = served(SCREEN, "guide", "issue-flow", "5");
  assert.match(held, /identity is acquired here and left on the issue/u,
    "criterion 13: nothing leaves the identity where the run that judges it reads its own brief");
  assert.match(held, /verdicts taken at the identity it replaced do not carry/u,
    "criterion 14: a repair carries its old verdicts, so a rung answers for code nobody shipped");
  /* The same phase under the flow with no judge, which is what each selector above is watched
     failing on: a rule that reads the same under both flows is one the flow axis did not carry. */
  const none = served(DEFAULT, "guide", "issue-flow", "5");
  assert.doesNotMatch(none, /left on the issue/u, "and default hands nobody an identity to read");
  assert.doesNotMatch(none, /do not carry/u, "and default has no identity for a repair to move");
});

/* The two arms of the split, which is the one thing a project's own declaration decides inside a
   flow: a phase serving only the arm this project happens to run would end a builder whose successor
   the ranking verb declines to offer. */
test("the screen flow's Phase 5 serves both arms of the judging declaration", () => {
  const held = served(SCREEN, "guide", "issue-flow", "5");
  assert.match(held, /It dispatches nobody and it waits for nothing/u,
    "the independent arm: the building run is still told to dispatch a judge and wait on it");
  assert.match(held, /declared the judgement the builder's own, or declared nothing/u,
    "the builder arm: a project that declared no independent judge is told nothing about what to do");
});

/* And the endpoint each arm reaches is the ship mode's, not the declaration's: a rung named across
   both modes tells a run that lands nothing to reach one only its lander can write. */
const shipping = (mode, ...argv) => {
  const room = tempRoom("screen-ship-");
  const home = tempHome(`screen-${mode}`);
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "screen-fixture", flow: SCREEN }));
  spawnSync(FORGE, ["doctor", "--ship", mode],
    { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home.path }, cwd: room });
  const run = spawnSync(FORGE, argv,
    { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home.path }, cwd: room });
  assert.equal(run.status, 0, `\`forge ${argv.join(" ")}\` under ship ${mode} exited ${run.status}: ${run.stderr}`);
  return flat(run.stdout);
};

test("the rung the independent arm ends at is the ship mode's, and the mode that lands nothing names none", () => {
  const self = shipping("self", "guide", "issue-flow", "5");
  assert.match(self, /it ends at `developed` and the handoff is that status/u,
    "a run that lands its own change is not told which rung it hands over at");
  const ready = shipping("ready", "guide", "issue-flow", "5");
  assert.match(ready, /This run reaches no rung/u,
    "a run that lands nothing is not told that the rung is not its to reach");
  assert.doesNotMatch(ready, /it ends at `developed`/u,
    "and it is told to end at a rung only the run that lands the change can write");
});

test("an automatic release is looked at where it landed, and what the run leaves is legible", () => {
  const held = served(SCREEN, "guide", "issue-flow", "7");
  assert.match(held, /this phase looks at production/u,
    "criterion 12: an automatic release owes no observation where users meet it");
  assert.match(held, /A deploy log is a record that a command finished/u,
    "criterion 12: a deploy log stands in for that observation");
  assert.match(held, /who holds it next, whether the change is live in production or only where it was\s+judged/u,
    "criterion 15: the handoff does not name what it holds");
  assert.match(held, /\*Automation complete\* and \*product accepted\* are two different/u,
    "criterion 15: the two states an issue can rest in are not told apart");
  const none = served(DEFAULT, "guide", "issue-flow", "7");
  assert.doesNotMatch(none, /this phase looks at production/u, "and the flow with no judge owes no smoke");
  assert.doesNotMatch(none, /Automation complete/u, "and no handoff, which is what these selectors are watched on");
});

test("a project on the screen flow is served every skill a project on the default one is", () => {
  assert.deepEqual(skillGuideSlugs(PLUGIN, SCREEN), skillGuideSlugs(PLUGIN, DEFAULT),
    "criterion 5: a skill the screen flow holds no text for is offered under it to nobody");
  for (const slug of skillGuideSlugs(PLUGIN, DEFAULT)) {
    const held = served(SCREEN, "guide", slug);
    assert.match(held, /Flow screen, which this project runs/u,
      `criterion 5: \`forge guide ${slug}\` under the screen flow answers for some other flow`);
  }
});
