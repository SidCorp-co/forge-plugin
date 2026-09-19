/* The rule the suite could not hold for itself: a case that reads a hook's answer asserts a value the
   hook writes when it allows, and one that never answered writes the same thing. `answered()` in the
   fixture tells those apart; this walk is what keeps the sentinel from being written next door again,
   where nothing would tell it apart. The walk is both test trees and not the whole repository: a
   reader under `plugin/src` that falls back on a child's silence is this product deciding something,
   answering to its own clause and not to what a case may assert, and `packages/code-quality` travels
   alone and cannot import the fixture, so what the refusal asks it for is the assertion. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { READER, silencesIn } from "../../../src/checks/suite/child-silence.mjs";

const ROOT = new URL("../../../../", import.meta.url).pathname;

const TREES = ["plugin/test", "packages/code-quality/test"];

const files = () => {
  const out = [];
  const walk = (dir, at) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.name === "node_modules") continue;
      if (one.isDirectory()) walk(join(dir, one.name), `${at}/${one.name}`);
      else if (/\.m?js$/u.test(one.name)) out.push({ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") });
    }
  };
  for (const tree of TREES) walk(join(ROOT, tree), tree);
  return out;
};

const said = (text, rel = "plugin/test/one.test.mjs") => silencesIn(text, rel);

test("the walk reaches both test trees, so a clean answer is not an empty selector", () => {
  const walked = files();
  assert.ok(walked.length > 200, `the walk found ${walked.length} files, and this suite has hundreds`);
  for (const one of [READER, "plugin/test/gates/codex/codex-owed.test.mjs",
    "plugin/test/hooks/gate.test.mjs", "plugin/test/git/reviewed.test.mjs",
    "packages/code-quality/test/cli/lint-edited-file.test.js"]) {
    assert.ok(walked.some((each) => each.rel === one), `${one} is in the walk`);
  }
});

test("every case in this suite reads a child's answer through the one reader that proves it answered", () => {
  assert.deepEqual(files().flatMap((one) => silencesIn(one.text, one.rel)), []);
});

test("the reader finds the sentinel in each shape it was written in, and leaves the reader's own answer alone", () => {
  const ternary = `  return run.stdout.trim() ? JSON.parse(run.stdout) : null;`;
  assert.equal(said(ternary).length, 1);
  assert.match(said(ternary)[0], /^plugin\/test\/one\.test\.mjs:1 turns a child's silence into the value a case reads/u);
  assert.match(said(ternary)[0], /Assert the child's exit status before reading what it wrote/u);
  assert.match(said(ternary)[0], /plugin\/test\/fixtures\.mjs does it once, in answered\(\)/u);
  assert.deepEqual(said(`  return answered(run);`), [], "the reader's own answer is the way out");
  assert.equal(said(`return { ...run, body: run.status === 0 ? JSON.parse(run.stdout) : null };`).length, 1,
    "a conditional on the status is the same sentinel spelt the other way");
  assert.equal(said(`assert.match(run.stdout.trim() && JSON.parse(run.stdout).reason || "", /x/u);`).length, 1,
    "and so is one spelt with an or");
  assert.equal(said(`return because(out.stdout.trim() ? JSON.parse(out.stdout) : null);`).length, 1,
    "inside another call it is still the value the case reads");
});

test("a fallback that is not a value is a retry, and the file that owns the sentinel keeps it", () => {
  assert.deepEqual(said(`const taken = first.status === 0 ? first : await qa("claim", "ISS-8", "--take");`), [],
    "a fallback that calls something tries again rather than standing in for an answer");
  assert.deepEqual(said(`  return run.stdout.trim() ? JSON.parse(run.stdout) : null;`, READER), [],
    "the one file this is written in is where every other file is sent");
  assert.deepEqual(said(`  return run.stdout.trim() ? JSON.parse(run.stdout) : null;`, `/abs/${READER}`), [],
    "reached by a longer path it is the same file");
});

test("the sentinel is read out of code and never out of a comment or a fixture's own text", () => {
  assert.deepEqual(said(`// return run.stdout.trim() ? JSON.parse(run.stdout) : null;`), []);
  assert.deepEqual(said(`/* held.stdout.trim() ? x : null */`), []);
  assert.deepEqual(said(`writeFileSync(at, 'return run.stdout.trim() ? JSON.parse(run.stdout) : null;');`), []);
  assert.deepEqual(said(`assert.match(run.stdout, /trim\\(\\) \\? a : null/u);`), [],
    "a pattern spelling the shape is the pattern it is");
});

test("the line a refusal names is the line the sentinel is on, whatever stands above it", () => {
  const text = `import { callHook } from "../fixtures.mjs";\n\n// a comment\nreturn run.stdout.trim() ? x : null;\n`;
  assert.match(said(text, "plugin/test/twelve.test.mjs")[0], /^plugin\/test\/twelve\.test\.mjs:4 /u);
});
