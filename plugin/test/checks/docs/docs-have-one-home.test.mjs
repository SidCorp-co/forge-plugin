/* A doc saying what `-h`, a skill or the code says is a fourth home nobody updates. CLAUDE.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { compare, sentences } from "../../../src/checks/duplication.mjs";
import { NARRATES } from "../../../src/checks/doc-shape.mjs";
import { VERBS } from "../../../src/resolve/visibility.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "..");
const DOCS = join(ROOT, "docs");
/* Walked, not listed: the topics moved under docs/cli/ and a flat read would have taken sixty-seven
   thousand characters out of this gate with nothing failing (ISS-87). The root's requirements tree is
   out, and only the root's — it states its own threshold from its own measurement and answers to its
   own gate, while a skip at every depth is a bypass nobody declared. */
const walk = (dir, prefix = "") =>
  readdirSync(dir, { withFileTypes: true }).flatMap((one) => {
    if (!prefix && one.name === "requirements") return [];
    if (one.isDirectory()) return walk(join(dir, one.name), `${prefix}${one.name}/`);
    return one.name.endsWith(".md") ? [`${prefix}${one.name}`] : [];
  });

const docs = walk(DOCS);



/* Everywhere a fact may already live: the skills, the gate documents, the rules file. */
const homed = () => {
  const files = [join(ROOT, "CLAUDE.md")];
  const skills = join(ROOT, "plugin", "skills");
  for (const name of readdirSync(skills)) {
    const spine = join(skills, name, "SKILL.md");
    if (existsSync(spine)) files.push(spine);
    const refs = join(skills, name, "references");
    if (existsSync(refs)) {
      for (const one of readdirSync(refs)) if (one.endsWith(".md")) files.push(join(refs, one));
    }
  }
  const how = join(ROOT, "plugin", "hooks", "how");
  for (const one of readdirSync(how)) if (one.endsWith(".md")) files.push(join(how, one));
  return files.flatMap((file) => sentences(readFileSync(file, "utf8")).map((one) => [file, one]));
};

test("no document restates a skill, a gate document or CLAUDE.md", () => {
  assert.ok(docs.length >= 2, `${docs.length} document(s) under docs/; the selector matches nothing`);
  const elsewhere = homed();
  for (const name of docs) {
    const mine = sentences(readFileSync(join(DOCS, name), "utf8")).map((one) => [name, one]);
    /* Doctor's 0.25, over a floor of 5 rather than its 3: three words collide in short prose. */
    const [worst] = compare(mine, elsewhere, 0.25, 5);
    assert.equal(
      worst,
      undefined,
      worst && `docs/${name} restates ${worst[2][0].replace(ROOT, "")} (${worst[0].toFixed(2)}):\n`
        + `  here:      ${worst[1][1].slice(0, 120)}\n  there:     ${worst[2][1].slice(0, 120)}`,
    );
  }
});

test("no document explains code", () => {
  for (const name of docs) {
    const found = readFileSync(join(DOCS, name), "utf8").match(NARRATES);
    assert.equal(found, null, found && `docs/${name} explains code: "${found[0]}"`);
  }
});

/* The other direction: a skill restating a refusal a run will meet, or a line of the help it is
   told to run first, is the copy that goes stale while the refusal is what gets read. Both sides
   are derived, so a hook or a verb added later is covered without anyone remembering this. */
const refused = () => {
  const how = join(ROOT, "plugin", "hooks", "how");
  const pages = readdirSync(how).filter((one) => one.endsWith(".md")).flatMap((one) =>
    sentences(readFileSync(join(how, one), "utf8")).map((said) => [`plugin/hooks/how/${one}`, said]));
  /* The verb's prose line, not its argument grammar: shared words in a grammar score nothing. */
  const help = VERBS.map(([verb, , said]) => [`forge ${verb} -h`, said]);
  return [...pages, ...help];
};

const skillDocs = () => {
  const skills = join(ROOT, "plugin", "skills");
  const out = [];
  for (const name of readdirSync(skills)) {
    const spine = join(skills, name, "SKILL.md");
    if (existsSync(spine)) out.push([`plugin/skills/${name}/SKILL.md`, spine]);
    const refs = join(skills, name, "references");
    if (!existsSync(refs)) continue;
    for (const one of readdirSync(refs)) {
      if (one.endsWith(".md")) out.push([`plugin/skills/${name}/references/${one}`, join(refs, one)]);
    }
  }
  return out;
};

test("no skill restates a refusal or a usage line it could point at", () => {
  const elsewhere = refused();
  assert.ok(elsewhere.length >= 100, `${elsewhere.length} refusal sentence(s); the selector is broken`);
  const files = skillDocs();
  assert.ok(files.length >= 6, `${files.length} skill document(s); the selector is broken`);
  /* The corpus and the comparison are live, so the green below is a clean tree and not an empty read. */
  const longest = elsewhere.reduce((one, next) => (next[1].length > one[1].length ? next : one));
  const [planted] = compare([["planted", longest[1]]], elsewhere, 0.25, 5);
  assert.ok(planted, "a sentence copied from a refusal is not reported, so this check reads nothing");
  for (const [rel, file] of files) {
    /* Past the frontmatter: a description names verbs on purpose — `check:skill-boundaries`'s. */
    const mine = sentences(readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/u, ""))
      .map((one) => [rel, one]);
    const [worst] = compare(mine, elsewhere, 0.25, 5);
    assert.equal(
      worst,
      undefined,
      worst && `${rel} restates ${worst[2][0]} (${worst[0].toFixed(2)}), so the rule has two homes:\n`
        + `  the skill:  ${worst[1][1].slice(0, 120)}\n  the refusal: ${worst[2][1].slice(0, 120)}\n`
        + `  Cut it to the command that prints it.`,
    );
  }
});
