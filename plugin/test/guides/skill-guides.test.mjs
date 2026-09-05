/* A skill's method is served by `forge guide <skill>`, so what a stub promises has to be answerable
   from this copy: the body, each reference, a refusal that lists what exists, and every citation the
   served text makes resolving to a reference the same copy serves. Each assertion is watched failing
   on a planted directory that breaks it, since a walker over a clean tree looks like a walker over
   nothing. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../fixtures.mjs";

const {
  BODY, referencesOf, skillGuideAnswer, skillGuideSlugs, skillListingRow, unresolvedCitations,
} = await import("../../src/guides/skill-guides.mjs");

const PLUGIN = new URL("../../", import.meta.url).pathname;
const STUBS = join(PLUGIN, "skills");

const planted = () => {
  const root = tempRoom("skill-guides-");
  const dir = join(root, "guides", "skills", "alpha");
  mkdirSync(join(dir, "references"), { recursive: true });
  writeFileSync(join(dir, BODY), "# Skill: alpha\n\nRead `forge guide alpha one` first.\n");
  writeFileSync(join(dir, "references", "one.md"), "# One\n\nThen `forge guide alpha two`.\n");
  writeFileSync(join(dir, "references", "two.md"), "# Two\n\nAnd `forge guide alpha three`, which is nobody's.\n");
  mkdirSync(join(root, "guides", "skills", "notaskill"), { recursive: true });
  mkdirSync(join(root, "guides", "skills", "beta", "references"), { recursive: true });
  writeFileSync(join(root, "guides", "skills", "beta", "references", "one.md"), "# Beta one\n");
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
  /* The real tree: every `forge guide <skill> <reference>` any guide names is answerable. */
  assert.deepEqual(unresolvedCitations(), [], "a citation in a shipped guide names a reference nobody serves");
  assert.ok(skillGuideSlugs().length >= 4, `${skillGuideSlugs().length} skill guide(s) shipped; the selector is broken`);
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
    const served = existsSync(join(PLUGIN, "guides", "skills", name, BODY));
    if (served) {
      assert.match(body, new RegExp(`\`forge guide ${name}\``, "u"), `${name}'s stub names the verb that serves it`);
    } else {
      assert.doesNotMatch(body, new RegExp(`\`forge guide ${name}\``, "u"), `${name} has no served body to name`);
    }
  }
});
