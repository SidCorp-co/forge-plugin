/* A doc saying what `-h`, a skill or the code says is a fourth home nobody updates. CLAUDE.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { compare, sentences } from "../src/duplication.mjs";
import { NARRATES } from "../src/doc-shape.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const DOCS = join(ROOT, "docs");
const docs = readdirSync(DOCS).filter((one) => one.endsWith(".md"));



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
  for (const one of readdirSync(how)) files.push(join(how, one));
  return files.flatMap((file) => sentences(readFileSync(file, "utf8"), { inlineCode: "drop" }).map((one) => [file, one]));
};

test("no document restates a skill, a gate document or CLAUDE.md", () => {
  const elsewhere = homed();
  for (const name of docs) {
    const mine = sentences(readFileSync(join(DOCS, name), "utf8"), { inlineCode: "drop" }).map((one) => [name, one]);
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
