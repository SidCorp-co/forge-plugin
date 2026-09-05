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
  return root;
};

test("a skill guide answers its body with the references listed, one reference, and a refusal that lists them", () => {
  const root = planted();
  assert.deepEqual(skillGuideSlugs(root), ["alpha"], "a directory with no body is not a skill guide");
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
});

test("a citation the served text makes resolves to a reference this copy serves, or is named", () => {
  const root = planted();
  const unresolved = unresolvedCitations(root);
  assert.deepEqual(unresolved.map((one) => `${one.skill} ${one.reference}`), ["alpha three"]);
  /* The real tree: every `forge guide <skill> <reference>` any guide names is answerable. */
  assert.deepEqual(unresolvedCitations(), [], "a citation in a shipped guide names a reference nobody serves");
  assert.ok(skillGuideSlugs().length >= 4, `${skillGuideSlugs().length} skill guide(s) shipped; the selector is broken`);
});

/* A stub is what Claude Code loads at session start and cannot pick up again, so what it carries is
   what a landed correction cannot reach: the frontmatter and the one line naming the verb. */
const STUB_CEILING = 1200;
test("a skill whose method this copy serves ships as a stub naming the verb, and nothing more", () => {
  const served = skillGuideSlugs();
  for (const name of readdirSync(STUBS)) {
    const stub = join(STUBS, name, "SKILL.md");
    if (!existsSync(stub)) continue;
    const text = readFileSync(stub, "utf8");
    if (!served.includes(name)) {
      assert.equal(existsSync(join(STUBS, name, "references")) || text.length > STUB_CEILING, true,
        `${name} is served by no guide and is not a whole skill either`);
      continue;
    }
    assert.ok(text.length <= STUB_CEILING, `${name}/SKILL.md is ${text.length} bytes; a stub carries the frontmatter and one paragraph`);
    assert.match(text, new RegExp(`\`forge guide ${name}\``, "u"), `${name}'s stub names the verb that serves it`);
    assert.equal(existsSync(join(STUBS, name, "references")), false, `${name}'s references moved with its body`);
    assert.doesNotMatch(text.replace(/^---[\s\S]*?---/u, ""), /references\//u, "a stub cites no file it no longer carries");
  }
});
