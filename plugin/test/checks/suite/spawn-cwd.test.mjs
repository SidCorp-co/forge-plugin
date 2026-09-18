/* The gate spends a test file whose process tree spawned a child it has no record of and that stood
   in the checkout, and 139 of this suite's 294 files answered for nothing on that alone (ISS-1721).
   Almost every one of those children was a git working in a temporary room it had already named,
   standing in the checkout only because its spawn said nothing. The cwds are one commit; the shape
   comes back with the next case that runs git against a room, so the rule is held here.

   The walk is every `.mjs` this repository ships and not the suite alone, because the audit follows
   the whole process tree: a helper in `plugin/src/` that a test imports blinds that test exactly as
   the test's own spawn does, and bounding the rule at `plugin/test/` let the identical shape survive
   at eight sites worth ten files of the suite (ISS-1736). What the rule asks for is a git child that
   says where it stands, not one that stands somewhere else — a child reading this checkout on
   purpose answers it by naming the checkout, which is what `plugin/src/flow/worklog.mjs` does. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { spawnsIn } from "../../../src/checks/suite/spawn-cwd.mjs";

const ROOT = new URL("../../../../", import.meta.url).pathname;

/* The directories this repository ships code in. `node_modules` is nobody's rule to hold here. */
const TREES = ["plugin", "tools", "packages"];

const files = () => {
  const out = [];
  const walk = (dir, at) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.name === "node_modules") continue;
      if (one.isDirectory()) walk(join(dir, one.name), `${at}/${one.name}`);
      else if (one.name.endsWith(".mjs")) out.push({ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") });
    }
  };
  for (const tree of TREES) walk(join(ROOT, tree), tree);
  return out;
};

const said = (text, rel = "one.mjs") => spawnsIn(text, rel);

test("the walk reaches every tree this repository ships, so a clean answer is not an empty selector", () => {
  const walked = files();
  assert.ok(walked.length > 500, `the walk found ${walked.length} files, and this repository has hundreds`);
  for (const one of ["plugin/test/fixtures.mjs", "plugin/src/checks/duplication.mjs",
    "plugin/scripts/blast-radius.mjs", "plugin/hooks/gates/learning-gate.mjs",
    "tools/gates.mjs", "packages/code-quality/bin/code-quality-gate.mjs"]) {
    assert.ok(walked.some((each) => each.rel === one), `${one} is in the walk`);
  }
});

test("every git child this repository spawns names the directory it stands in", () => {
  assert.deepEqual(files().flatMap((one) => spawnsIn(one.text, one.rel)), []);
});

/* Watched failing: the reader over each spawning form that carries no cwd, over the same form with
   one, and over the shapes a text reader gets wrong — a call spelt inside a string, a `cwd:` inside
   an argument, a bracket inside an argument, and an options object that names it under something. */
test("the reader finds a git child with no cwd, in each spawning form, and leaves one that names its room", () => {
  const bare = `const run = () => spawnSync("git", ["-C", room, "status"], { encoding: "utf8" });`;
  assert.equal(said(bare).length, 1);
  assert.match(said(bare)[0], /^one\.mjs:1 spawns git without naming the directory/u);
  assert.match(said(bare)[0], /Pass cwd: the room this git works in/u);
  for (const how of ["spawn", "execFile", "execFileSync", "execSync", "exec", "fork"]) {
    assert.equal(said(`${how}("git", ["init", "-q", at]);`).length, 1, how);
  }
  assert.deepEqual(said(`spawnSync("git", ["status"], { cwd: room, encoding: "utf8" });`), []);
  assert.deepEqual(said(`execFileSync("git", ["ls-files"], { encoding: "utf8", cwd: ROOT });`), []);
  assert.deepEqual(said(`spawnSync("git", ["status"], { cwd });`), [], "the shorthand names it too");
});

test("what names the cwd is the options argument itself, not a word anywhere in the call", () => {
  assert.equal(said(`spawnSync("git", ["-C", room, "commit", "-m", "cwd: checkpoint"]);`).length, 1,
    "a commit message is the string it is");
  assert.equal(said(`spawnSync("git", ["status"], { env: { ...process.env, cwd: at } });`).length, 1,
    "named under something else is named nowhere the spawn reads");
  assert.equal(said(`spawnSync("git", ["status"], { env: { "cwd": at } });`).length, 1);
  assert.deepEqual(said(`spawnSync("git", ["status"], { "cwd": room });`), [], "a quoted key is the key");
  assert.deepEqual(said(`spawnSync("git", ["status"], { 'cwd': room });`), []);
  assert.deepEqual(said(`spawnSync("git", ["status"], { /* the room */ cwd: room });`), []);
  assert.deepEqual(said(`spawnSync("git", ["status"], { cwd /* said */: room });`), []);
  assert.equal(said(`spawnSync("git", ["status"], { cwdOf: room });`).length, 1,
    "a longer name that opens with the same three letters is another property");
  assert.deepEqual(said(`spawnSync("git", ["log", "--format=)"], { cwd: room });`), [],
    "a bracket inside an argument does not end the call");
  assert.deepEqual(said(`spawnSync("git", ["show", ":a.mjs"], { cwd: room }).stdout;`), []);
  assert.deepEqual(said(`execFile("git", ["status"], { cwd: room }, done);`), [],
    "the asynchronous forms take a callback after their options");
  assert.equal(said(`execFile("git", ["status"], done);`).length, 1);
  assert.deepEqual(said(`spawnSync("git", ["status"], { cwd: room },);`), [],
    "a trailing comma leaves a piece that is nothing");
  assert.deepEqual(said(`const held = { cwd: room };\nspawnSync("git", ["status"], held);`), [],
    "a name standing for the options is read where it was declared");
  assert.equal(said(`const held = { encoding: "utf8" };\nspawnSync("git", ["status"], held);`).length, 1);
  assert.equal(said(`{ const held = {}; spawnSync("git", ["status"], held); }\n{ const held = { cwd: room }; }`).length, 1,
    "a literal declared below the call is another block's and answers for nothing");
  assert.equal(said(`const held = {};\n{ const held = { cwd: room }; }\nspawnSync("git", ["status"], held);`).length, 1,
    "nor does one in a block the call has already left");
});

test("a git spawn spelt in a comment or written into a fixture's own text is no child of this suite", () => {
  assert.deepEqual(said(`// spawnSync("git", ["status"]);\n/* execFileSync("git", []); */`), []);
  assert.deepEqual(said("writeFileSync(at, `spawnSync(\"git\", [\"status\"]);`);"), []);
  assert.deepEqual(said(`writeFileSync(at, 'spawnSync("git", ["status"]);');`), []);
  assert.deepEqual(said("const out = `${spawnSync(\"git\", [\"-C\", room, \"status\"]).status}`;"), [],
    "the bound: a template is masked whole, so a child spawned inside an interpolation is out of reach");
});

test("the reader reaches every binding this file has of node:child_process", () => {
  const star = `import * as cp from "node:child_process";\ncp.spawnSync("git", ["-C", room, "status"]);`;
  assert.equal(said(star).length, 1);
  assert.deepEqual(said(`${star.split("\n")[0]}\ncp.spawnSync("git", ["status"], { cwd: room });`), []);
  const alias = `import { spawnSync as run } from "node:child_process";\nrun("git", ["-C", room, "status"]);`;
  assert.equal(said(alias).length, 1);
  assert.deepEqual(said(`${alias.split("\n")[0]}\nrun("git", ["status"], { cwd: room });`), []);
  const dollar = `import { spawnSync as $run } from "node:child_process";\n$run("git", ["status"]);`;
  assert.equal(said(dollar).length, 1, "a $ in the name is a character and not an anchor");
  const ns = `import * as $cp from "node:child_process";\n$cp.spawnSync("git", ["status"]);`;
  assert.equal(said(ns).length, 1);
  assert.deepEqual(said(`const held = 'import { spawnSync as run } from "node:child_process";';\nconst run = (one) => one;\nrun("git");`), [],
    "an import a fixture spells inside its own text binds nothing");
});

test("the reader reads the command argument and not the name of the thing being called", () => {
  assert.deepEqual(said(`spawnSync(git, ["status"]);`), []);
  assert.deepEqual(said(`spawnSync("gitk", ["--all"]);`), []);
  assert.deepEqual(said(`ourSpawnSync("git", ["status"]);`), []);
  assert.equal(said(`const out = await spawnSync("git", ["status"]);`).length, 1);
});

test("the line a refusal names is the line the call is on, whatever stands above it", () => {
  const text = `import { spawnSync } from "node:child_process";\n\n// a comment\nspawnSync("git", ["status"]);\n`;
  assert.match(said(text, "twelve.mjs")[0], /^twelve\.mjs:4 /u);
});
