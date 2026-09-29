/* ISS-749. Five spellings of this CLI's binary disagreed on what a call of it is, and two of them in
   one file cost a run its grant. The word is plugin/src/resolve/writer-word.mjs's, and a sixth
   spelling fails here unless the line above it says why its reading differs. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../..", import.meta.url).pathname;
const HOME = "plugin/src/resolve/writer-word.mjs";
const TREES = ["plugin/src", "plugin/hooks", "tools"];
const SKIPPED = new Set(["vendor", "test", "node_modules"]);

/* A pattern spelling the binary: the name followed by a blank class or a lookahead, or behind the
   optional path group a spelling opens with. `forge:` in a marker and `forge_` in a tool name are
   neither. */
const SPELLS = /forge(?:\\s|\[ \\t|\[\\s|\(\?[=!])|\/\)\?forge/u;
const EXEMPT = "Not the writer's word:";

const sources = () => {
  const out = [];
  const walk = (at) => {
    for (const one of readdirSync(join(ROOT, at), { withFileTypes: true })) {
      if (one.isDirectory()) {
        if (!SKIPPED.has(one.name)) walk(`${at}/${one.name}`);
      } else if (one.name.endsWith(".mjs")) {
        out.push({ rel: `${at}/${one.name}`, text: readFileSync(join(ROOT, at, one.name), "utf8") });
      }
    }
  };
  TREES.forEach(walk);
  return out;
};

const spellingsIn = (text, rel) => {
  if (rel === HOME) return [];
  const lines = text.split("\n");
  return lines.flatMap((line, i) => {
    if (!SPELLS.test(line) || lines.slice(Math.max(0, i - 2), i).some((one) => one.includes(EXEMPT))) return [];
    return [`${rel}:${i + 1} spells this CLI's binary itself. Build the pattern from WRITER_WORD `
      + `(and CALL_STARTS) in ${HOME}, or say on the line above why this reading differs, `
      + `in a comment opening \`${EXEMPT}\``];
  });
};

test("every pattern spelling this CLI's binary spends the one word, or says why not", () => {
  const files = sources();
  assert.ok(files.length > 100, `${files.length} source(s) walked; the walk reaches too little`);
  assert.deepEqual(files.flatMap(({ rel, text }) => spellingsIn(text, rel)), []);
});

/* The selector watched matching: each spelling the tree held before, planted in a file of its own. */
test("a spelling of the binary of its own fails, named by file and line", () => {
  for (const planted of [
    String.raw`const VERB = /^(?:\S*\/)?forge\s+([a-z]+)\b/u;`,
    String.raw`const CALL = /(?:^|[\s;&|()])[^\s;&|()]*forge(?![\w-])/u;`,
    String.raw`const HELP = /forge[ \t]+(?<verb>[a-z]+)/u;`,
  ]) {
    const said = spellingsIn(`const first = 1;\n${planted}\n`, "plugin/src/elsewhere.mjs");
    assert.equal(said.length, 1, planted);
    assert.match(said[0], /^plugin\/src\/elsewhere\.mjs:2 spells/u, said[0]);
    assert.match(said[0], /WRITER_WORD/u, "the refusal names what to build from instead");
  }
});

test("a spelling that says why it differs, and a marker that is no spelling, both pass", () => {
  assert.deepEqual(spellingsIn(`/* ${EXEMPT} prose names it bare. */\nconst V = /^forge[ \\t]+x/u;\n`, "a.mjs"), []);
  assert.deepEqual(spellingsIn("const RESERVED = /^ {0,3}<!--\\s*forge:/u;\n", "a.mjs"), []);
});
