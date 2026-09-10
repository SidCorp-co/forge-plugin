/* A skill's method is served by `forge guide <skill>`, so what a stub promises has to be answerable
   from this copy: the body, each reference, a refusal that lists what exists, and every citation the
   served text makes resolving to a reference the same copy serves. Each assertion is watched failing
   on a planted directory that breaks it, since a walker over a clean tree looks like a walker over
   nothing. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { homeEnv, tempRoom } from "../fixtures.mjs";

const {
  GUIDE, bodyProblems, guideParts, hasBody, referencesOf, servedBody, skillFlowDir,
  skillGuideAnswer, skillGuideSlugs, skillGuidesRoot, skillListingRow, unresolvedCitations,
} = await import("../../src/guides/skill-guides.mjs");
const { DEFAULT } = await import("../../src/guides/flow.mjs");
const { phasesOf } = await import("../../src/guides/render.mjs");

const PLUGIN = new URL("../../", import.meta.url).pathname;
const STUBS = join(PLUGIN, "skills");
const FORGE = join(PLUGIN, "bin", "forge");
const FIXTURE = "erp-flow";

/* A flow is read off a `.forge.json` by a resolver that answers once per process, so a case varying
   one runs the verb: two flows in one process would both read whichever was resolved first. */
const declaring = (keys) => {
  const dir = tempRoom("flow-");
  writeFileSync(join(dir, ".forge.json"), JSON.stringify({ slug: "flow-fixture", ...keys }));
  return dir;
};

const asked = (room, ...argv) =>
  spawnSync(FORGE, argv, { encoding: "utf8", env: homeEnv("pin"), cwd: room });

/* Whole sets under a flow segment, so a case can hand one flow three parts and another flow its own
   and nothing resolves between them. `part` names the file, because the file name is the order. */
const put = (root, slug, flow, where, files) => {
  const dir = join(root, "guides", "skills", slug, flow, where);
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
};

const planted = () => {
  const root = tempRoom("skill-guides-");
  put(root, "alpha", DEFAULT, GUIDE, {
    "01-skill-alpha.md": "# Skill: alpha\n\nRead `forge guide alpha one` first.\n",
    "02-phase-3.md": "## Phase 3 — the third\n\nThe third phase.\n",
  });
  put(root, "alpha", DEFAULT, "references", {
    "one.md": "# One\n\nThen `forge guide alpha two`.\n",
    "two.md": "# Two\n\nAnd `forge guide alpha three`, which is nobody's.\n",
  });
  mkdirSync(join(root, "guides", "skills", "notaskill"), { recursive: true });
  put(root, "beta", DEFAULT, "references", { "one.md": "# Beta one\n" });
  mkdirSync(join(root, "skills", "beta"), { recursive: true });
  writeFileSync(join(root, "skills", "beta", "SKILL.md"), "---\nname: beta\n---\n\nRules inline; `forge guide beta one` and `forge guide beta zero`.\n");
  return root;
};

test("a skill guide answers its body with the references listed, one reference, and a refusal that lists them", () => {
  const root = planted();
  assert.deepEqual(skillGuideSlugs(root), ["alpha", "beta"], "a body or references make a skill guide; an empty directory does not");
  assert.deepEqual(referencesOf("alpha", root), ["one", "two"]);
  const answer = skillGuideAnswer("alpha", root);
  const whole = answer().lines.join("\n");
  assert.match(whole, /^# Skill: alpha/u);
  assert.match(whole, /References, each `forge guide alpha <reference>`:\n {2}one {2}/u, "the body ends with the reference table");
  assert.equal(answer({ part: "two" }).lines.join("\n").startsWith("# Two"), true);
  assert.match(answer({ part: "nine" }).refusal, /No guide alpha named nine.*\bone\b.*\btwo\b/su, "the refusal lists what exists");
  assert.match(answer({ part: "one", extra: ["two"] }).refusal, /one reference, not `one two`/u);
  assert.match(answer({ part: "../../issue-flow-contract" }).refusal, /No guide alpha named/u, "a path is not a reference");
  assert.match(answer({ tracker: true }).refusal, /--tracker does not apply to alpha/u);
  assert.match(skillListingRow("alpha", root), /`forge guide alpha` prints it.*2 reference\(s\)/su);
  const inline = skillGuideAnswer("beta", root);
  assert.match(inline().lines.join("\n"), /^The beta skill's method is its SKILL.md.*\nReferences, each `forge guide beta <reference>`:\n {2}one {2}/su);
  assert.equal(inline({ part: "one" }).lines.join("\n").startsWith("# Beta one"), true);
  assert.match(skillListingRow("beta", root), /`forge guide beta <reference>` prints one of its 1 reference\(s\)/u);
});

test("a citation the served text makes resolves to a reference this copy serves, or is named", () => {
  const root = planted();
  const unresolved = unresolvedCitations(root);
  assert.deepEqual(unresolved.map((one) => `${one.skill} ${one.reference}`), ["beta zero", "alpha three"], "a stub's citations are walked too");
  /* Watched in a part past the first: the walk reads every part of the flow's set, or a citation
     written into any but whichever file sorts first resolves against nothing and says so to nobody. */
  put(root, "alpha", DEFAULT, GUIDE, { "03-late.md": "## Late\n\nAnd `forge guide alpha nine`.\n" });
  assert.deepEqual(unresolvedCitations(root).map((one) => `${one.skill} ${one.reference}`),
    ["beta zero", "alpha nine", "alpha three"],
    "a citation in a method part is walked, and named beside the references' own");
  /* The real tree: every `forge guide <skill> <reference>` any guide names is answerable. */
  assert.deepEqual(unresolvedCitations(), [], "a citation in a shipped guide names a reference nobody serves");
  assert.ok(skillGuideSlugs().length >= 4, `${skillGuideSlugs().length} skill guide(s) shipped; the selector is broken`);
});

/* The pin says what a project is served, never what this copy ships, so the checker reads every
   flow's own text and no `.forge.json`: with the flow a segment, a reader taking the pin would check
   whichever flow the checkout happens to name and call the rest clean (ISS-1098). */
test("a citation dangling in a flow the checkout is not pinned to is named, and answered within that flow", () => {
  const root = planted();
  const found = () => unresolvedCitations(root).filter((one) => one.flow === FIXTURE)
    .map((one) => `${one.skill} ${one.reference}`);
  assert.deepEqual(found(), [], "no fixture flow yet, so the read below is not passing on absence");
  put(root, "alpha", FIXTURE, GUIDE, {
    "01-skill-alpha.md": "# Skill: alpha\n\nThat flow's own, citing `forge guide alpha eleven`.\n",
  });
  assert.deepEqual(found(), ["alpha eleven"], "the unpinned flow's broken instruction is read");
  put(root, "alpha", FIXTURE, "references", { "eleven.md": "# Eleven\n" });
  assert.deepEqual(found(), [], "and the reference under that same flow answers it, with default holding none");
  assert.deepEqual(referencesOf("alpha", root, DEFAULT), ["one", "two"], "which neither move nor gain");
});

/* The flow is a segment of the path, so what a flow serves is one `ls` and there is nothing to
   resolve between two of them. The listing reads the flow's own directory: a slug the flow holds no
   text for is not offered, and one it holds is offered whole. */
test("a skill's text is served out of its flow's own directory, and the path is the answer", () => {
  assert.ok(skillGuideSlugs().includes("issue-flow"), "the method is a row like every other skill's");
  assert.equal(skillGuidesRoot(PLUGIN), join(PLUGIN, "guides", "skills"));
  assert.equal(skillFlowDir("issue-flow", PLUGIN, DEFAULT),
    join(PLUGIN, "guides", "skills", "issue-flow", DEFAULT));
  assert.equal(hasBody("issue-flow", PLUGIN), true);
  assert.equal(hasBody("forge", PLUGIN), false, "and a skill whose method is inline has none to serve");
  assert.equal(guideParts("issue-flow", PLUGIN).length, 13,
    "the method is served as its own parts, one file per heading");
  const root = planted();
  assert.deepEqual(skillGuideSlugs(root), ["alpha", "beta"]);
  assert.equal(referencesOf("alpha", root).join(), "one,two");
  const cut = phasesOf(servedBody("alpha", root))
    .map((one) => `${one.number}:${one.text.split("\n").at(-1)}`);
  assert.deepEqual(cut, ["3:The third phase."], "a numbered part is cut from the join of the flow's parts");
});

/* Watched on a planted flow, because the shipped set is one flow: a case reading only `default`
   would pass on a reader that ignored the flow segment altogether. */
test("a flow holding three method parts is served those three, and the answer names that flow", () => {
  const root = planted();
  put(root, "alpha", FIXTURE, GUIDE, {
    "01-skill-alpha.md": "# Skill: alpha\n\nThe flow's own opening.\n",
    "02-phase-3.md": "## Phase 3 — its own third\n\nThe flow's third phase.\n",
    "03-a-part-of-its-own.md": "## Phase 9 — a phase default has not got\n\nOnly this flow's.\n",
  });
  assert.deepEqual(guideParts("alpha", root, FIXTURE).map(({ name }) => name),
    ["01-skill-alpha.md", "02-phase-3.md", "03-a-part-of-its-own.md"]);
  const whole = skillGuideAnswer("alpha", root, FIXTURE)().lines.join("\n");
  assert.match(whole, /The flow's own opening/u);
  assert.match(whole, /a phase default has not got/u, "a part name default has not got is served");
  assert.doesNotMatch(whole, /Read `forge guide alpha one` first/u,
    "and default's opening is not merged into it");
  assert.equal(skillGuideAnswer("alpha", root, FIXTURE)({ part: "9" }).lines.at(-1),
    `Flow ${FIXTURE}, which this project runs; \`forge doctor\` names its source.`,
    "the answer names the flow it was served for, not the one the settings pin");
  assert.equal(skillGuideAnswer("alpha", root, DEFAULT)({ part: "9" }).refusal?.includes("named 9"), true,
    "and default is served its own set, in which no phase 9 exists");
  assert.deepEqual(referencesOf("alpha", root, FIXTURE), [],
    "a flow serving no reference serves none, rather than default's");
});

test("a method part carrying no heading, or carrying two, is a finding naming that file", () => {
  const root = planted();
  put(root, "alpha", FIXTURE, GUIDE, { "01-loose.md": "Prose with no heading over it at all.\n" });
  assert.equal(bodyProblems("alpha", root, FIXTURE).length, 1);
  assert.match(bodyProblems("alpha", root, FIXTURE)[0],
    /01-loose\.md opens with no heading, so nothing addresses it/u);
  assert.match(skillGuideAnswer("alpha", root, FIXTURE)().refusal, /01-loose\.md opens with no heading/u,
    "and the verb refuses rather than serving that prose under the part before it");
  put(root, "alpha", FIXTURE, GUIDE, { "01-loose.md": "## One\n\na\n\n## Two\n\nb\n" });
  assert.match(bodyProblems("alpha", root, FIXTURE)[0],
    /01-loose\.md carries 2 headings, and its name addresses one part/u);
  assert.deepEqual(bodyProblems("alpha", root, DEFAULT), [],
    "and the flow's own damage is the flow's: default's parts are still well formed");
});

/* AC-02-8-3. Served for the flow, and saying so: a part read for a flow nobody can name is a part a
   reader cannot compare against the flow their project runs. */
test("a phase of the method is served whole and ends by naming the flow it was rendered for", () => {
  const room = declaring({});
  const run = asked(room, "guide", "issue-flow", "5");
  assert.equal(run.status, 0, run.stderr);
  const lines = run.stdout.trimEnd().split("\n");
  assert.equal(lines.at(-1), `Flow ${DEFAULT}, which this project runs; \`forge doctor\` names its source.`,
    "the last line names the flow this project runs");
  const phase = phasesOf(servedBody("issue-flow", PLUGIN)).find((one) => one.number === "5");
  assert.equal(lines[0], phase.text.split("\n")[0], "and the part opens on that phase's own heading");
  const wrong = asked(room, "guide", "issue-flow", "99");
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /named 99\. Did you mean: 0, 1, 2/u, "a number no phase has is offered the ones that exist");
  assert.match(asked(room, "guide", "issue-flow", "zzzzzz").stderr,
    /lists every reference, and each phase of the method is its number/u,
    "and a miss near nothing is told both ways a part is addressed");
  assert.equal(asked(room, "guide", "issue-flow", "verification").status, 0,
    "and a reference is still addressed by its name, which the flow's own text cites");
});

/* A SKILL.md sits in context for the rest of the run, so it is capped: 2,000 bytes of body is roughly
   500 to 650 tokens for a route table, read off the inline skills of 3.35.129. A served body earns a
   stub naming the verb; the code-quality plugin's two skills are its, held by the sync check. */
const CEILING = 2000;
const SHIPPED_WHOLE = new Set(["audit-code-quality", "setup-code-quality"]);
test("a SKILL.md is under the ceiling, and names the verb only where a body is served", () => {
  for (const name of readdirSync(STUBS)) {
    if (SHIPPED_WHOLE.has(name)) continue;
    const stub = join(STUBS, name, "SKILL.md");
    if (!existsSync(stub)) continue;
    const text = readFileSync(stub, "utf8");
    const body = text.replace(/^---[\s\S]*?---/u, "");
    const bytes = Buffer.byteLength(body, "utf8");
    assert.ok(bytes <= CEILING, `${name}/SKILL.md body is ${bytes} bytes; the ceiling is ${CEILING}`);
    assert.equal(existsSync(join(STUBS, name, "references")), false, `${name}'s references are served, not loaded`);
    assert.doesNotMatch(body, /references\//u, "a skill cites no file it does not carry");
    const served = hasBody(name, PLUGIN);
    if (served) {
      assert.match(body, new RegExp(`\`forge guide ${name}\``, "u"), `${name}'s stub names the verb that serves it`);
    } else {
      assert.doesNotMatch(body, new RegExp(`\`forge guide ${name}\``, "u"), `${name} has no served body to name`);
    }
  }
});
