import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../../fixtures.mjs";

const SCRIPT = new URL("../../../scripts/skill-boundaries.mjs", import.meta.url).pathname;

const roomWith = (skills) => {
  const root = tempRoom("skill-boundaries-");
  for (const [name, description] of Object.entries(skills)) {
    mkdirSync(join(root, name));
    writeFileSync(join(root, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\nbody\n`);
  }
  return root;
};

const check = (root) => {
  const run = spawnSync(process.execPath, [SCRIPT, root, "--json"], { encoding: "utf8" });
  return { status: run.status, ...JSON.parse(run.stdout) };
};

const TRACKER = "Drive a Forge issue tracker from the terminal with the forge CLI — browse, read, file and comment on issues. Invoke for any task that reads or writes the backlog: listing open issues, filing a defect, posting a finding. Triggers on Forge, tracker, backlog, issue.";
const SAME_JOB = "Work a Forge issue tracker from the command line using the forge CLI — read, browse, file and comment on tickets. Use when a task reads or writes the backlog: listing open tickets, filing a bug, posting a comment. Triggers on Forge, tracker, backlog, ticket.";
const UNRELATED = "Produce natural Vietnamese prose for locale files and documentation. Use whenever tiếng Việt has to be written or judged, including vi.json translation and reviewing machine-translated text. Triggers on Vietnamese, locale, i18n.";

/* The measurement the whole check rests on: paraphrase does not hide a duplicate, and adjacency
   does not read as one. */
test("the same job described twice measures high, unrelated skills measure nothing", (t) => {
  const root = roomWith({ alpha: TRACKER, beta: SAME_JOB, gamma: UNRELATED });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const held = check(root);
  const at = (one, two) => held.pairs.find((pair) => pair.one === one && pair.two === two).overlap;
  assert.ok(at("alpha", "beta") > 0.5, `paraphrase should still overlap, got ${at("alpha", "beta")}`);
  /* Near zero rather than zero: "file" the verb and "files" the noun are one stem, and that is the
     measure working, not a collision to engineer away. */
  assert.ok(at("alpha", "gamma") < 0.05, `unrelated skills should barely overlap, got ${at("alpha", "gamma")}`);
  assert.equal(held.status, 1);
  assert.match(held.findings.map((one) => one.join(" ")).join("\n"), /overlap \d+% and neither says which to prefer/);
});

/* An overlap one of them directs the reader through is an overlap somebody decided on. */
test("a direction earns the overlap; a bare mention does not", (t) => {
  const directed = roomWith({
    alpha: TRACKER,
    beta: `${SAME_JOB} For anything that only reads the backlog, use the alpha skill instead.`,
  });
  const mentioned = roomWith({ alpha: TRACKER, beta: `${SAME_JOB} Works alongside the alpha skill.` });
  t.after(() => {
    rmSync(directed, { recursive: true, force: true });
    rmSync(mentioned, { recursive: true, force: true });
  });
  assert.equal(check(directed).status, 0);
  assert.equal(check(mentioned).status, 1, "a mention with no direction should not suppress the finding");
});

/* The known limit, asserted rather than admitted: this measure sees shared vocabulary, so one job
   written in a different vocabulary escapes it. Anything claiming to catch that has to beat this. */
test("a synonym-only rewrite escapes the measure, and the test says so", (t) => {
  const root = roomWith({
    alpha: "Drive a Forge issue tracker from the terminal. Invoke when a task reads or writes the backlog: listing open issues, filing a defect, posting a finding. Triggers on tracker, backlog, issue.",
    beta: "Operate a Forge ticket queue over the command line. Use whenever work inspects or amends the pipeline: enumerating live tickets, raising a bug, recording an observation. Triggers on queue, pipeline, ticket.",
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const held = check(root);
  const score = held.pairs[0].overlap;
  assert.ok(score < 0.35, `documented miss: synonym rewrite scored ${score}, still under the limit`);
});

test("a description with no trigger, and one too short to carry one, are both reported", (t) => {
  const root = roomWith({
    mute: "Formats numbers and dates across the codebase using the shared locale helpers everywhere.",
    tiny: "Does things.",
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const held = check(root);
  const said = held.findings.map((one) => one.join(" ")).join("\n");
  assert.match(said, /never says when to reach for it/);
  assert.match(said, /under 60 it cannot carry a trigger/);
});

test("a skill naming one that is not installed is a dead instruction", (t) => {
  const root = tempRoom("skill-boundaries-");
  mkdirSync(join(root, "solo"));
  writeFileSync(
    join(root, "solo", "SKILL.md"),
    `---\nname: solo\ndescription: ${UNRELATED}\n---\n\nFor edge cases use the missing skill instead.\n`,
  );
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.match(check(root).findings.map((one) => one.join(" ")).join("\n"), /`missing` skill, which is not installed/);
});
