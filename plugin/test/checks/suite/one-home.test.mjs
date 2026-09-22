/* The suite's isolation was written one variable at a time, and always on the spawn side: a case
   points its child at a home it built and says nothing about its own. That held while the usage
   table was constants. ISS-2129 made one row a pair of functions reading `coolifyRoute`, and from
   then on `cli-help.test.mjs` compared a child under a fixture against a parent under the machine —
   green on a box that had chosen nothing, red on one whose owner ran the command the refusal names,
   which is the state 3.36.243 was released in (ISS-2195).

   The walk is every `.mjs` this repository ships rather than the suite alone, for the reason the
   rule beside this one gives: a helper under `plugin/src/` that a case imports splits that case
   exactly as the case's own binding does. What the rule asks for is a process that says which home
   it reads, not one that reads a particular home — a file whose expectation and whose child both
   want the fixture answers it by naming the fixture, and one that wants a bare room answers it by
   naming a bare room. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CONSTANT_EXPORTS, readsIn, splitIn } from "../../../src/checks/suite/one-home.mjs";
import { tempRoom } from "../../fixtures.mjs";

const ROOT = new URL("../../../../", import.meta.url).pathname;

const TREES = ["plugin", "tools", "packages"];

const files = () => {
  const out = [];
  const walk = (dir, at) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.name === "node_modules") continue;
      if (one.isDirectory()) walk(join(dir, one.name), `${at}/${one.name}`);
      else if (one.name.endsWith(".mjs")) {
        out.push({ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") });
      }
    }
  };
  for (const tree of TREES) walk(join(ROOT, tree), tree);
  return out;
};

const said = (text, rel = "one.mjs") => splitIn(text, rel);

const BINDS = 'import { usageOf } from "../../src/resolve/visibility.mjs";';
const HANDS = "spawnSync(FORGE, argv, { env: { ...process.env, XDG_CONFIG_HOME: HOME } });";
const SPLIT = `${BINDS}\n${HANDS}`;

test("the walk reaches every tree this repository ships, so a clean answer is not an empty selector", () => {
  const walked = files();
  assert.ok(walked.length > 500, `the walk found ${walked.length} files, and this repository has hundreds`);
  for (const one of ["plugin/test/cli/cli-help.test.mjs", "plugin/test/fixtures.mjs",
    "plugin/src/resolve/visibility.mjs", "plugin/test/tools/services/doctor/subjects.test.mjs",
    "tools/gates.mjs", "packages/code-quality/bin/code-quality-gate.mjs"]) {
    assert.ok(walked.some((each) => each.rel === one), `${one} is in the walk`);
  }
});

test("no file in this repository computes against one home while its child reads another", () => {
  assert.deepEqual(files().flatMap((one) => splitIn(one.text, one.rel)), []);
});

test("the reader reports a file that reads the table here and gives its child a home of its own", () => {
  assert.equal(said(SPLIT).length, 1);
  assert.match(said(SPLIT)[0], /^one\.mjs:1 reads usageOf of plugin\/src\/resolve\/visibility\.mjs/u);
  assert.match(said(SPLIT)[0], /handing a child an XDG_CONFIG_HOME of its own/u);
  assert.match(said(SPLIT)[0],
    /Assign process\.env\.XDG_CONFIG_HOME = the home this process is to read/u);
});

test("the reader reports nothing for a file that pins the home its own process reads", () => {
  assert.deepEqual(said(`${SPLIT}\nprocess.env.XDG_CONFIG_HOME = HOME;`), []);
  assert.deepEqual(said(`${SPLIT}\nprocess.env . XDG_CONFIG_HOME = room;`), [],
    "the property is the property however it is spaced");
  assert.deepEqual(said(`${SPLIT}\nprocess.env["XDG_CONFIG_HOME"] = room;`), [],
    "and however it is spelt");
  assert.equal(said(`${SPLIT}\nif (process.env.XDG_CONFIG_HOME === HOME) return;`).length, 1,
    "a comparison assigns nothing");
});

/* What the rule holds is that the process says which home it reads, never that it says the child's:
   a file whose children each get a room of their own has no one home to share with them, and
   subjects.test.mjs is that file. Where the two do have to be the same the file holds it itself, by
   reading a value it planted back out of the home it pinned, which is a claim about what was
   memoised and not one this text could settle. */
test("the reader reports nothing for a file that pins a home other than the one its child is given", () => {
  assert.deepEqual(said(`${SPLIT}\nprocess.env.XDG_CONFIG_HOME = OTHER;`), []);
});

/* Watched failing: a key the mask blanks whole, which is the spelling this reader saw nothing of
   while it read the masked text and not the source. */
test("a child's home is the key it spells, quoted or computed or bare", () => {
  for (const key of ['"XDG_CONFIG_HOME"', "'XDG_CONFIG_HOME'", '["XDG_CONFIG_HOME"]', "XDG_CONFIG_HOME"]) {
    assert.equal(said(`${BINDS}\nspawnSync(FORGE, argv, { env: { ...process.env, ${key}: HOME } });`).length, 1, key);
  }
  assert.deepEqual(said(`${BINDS}\nconst said = "XDG_CONFIG_HOME: the home";`), [],
    "the same letters inside a fixture's own text are prose, their colon blanked with them");
  assert.deepEqual(said(`${BINDS}\n/* XDG_CONFIG_HOME: the home a child gets */`), []);
});

test("the reader reports nothing for a file that hands no child a home of its own", () => {
  assert.deepEqual(said(BINDS), []);
  assert.deepEqual(said(`${BINDS}\nspawnSync(FORGE, argv, { env: process.env });`), []);
});

test("the reader reports nothing for a binding spelt in a comment or written into a fixture's text", () => {
  assert.deepEqual(said(`// ${SPLIT.replace("\n", " ")}`), []);
  assert.deepEqual(said(`/* ${BINDS} */\n${HANDS}`), []);
  assert.deepEqual(said(`writeFileSync(at, \`${BINDS}\`);\n${HANDS}`), []);
  assert.deepEqual(said(`writeFileSync(at, '${BINDS}');\n${HANDS}`), []);
});

test("the reader reports nothing for a file whose only reads of that module are the constants", () => {
  assert.deepEqual(readsIn('import { GROUPS, VERB_NAMES } from "../src/resolve/visibility.mjs";'), []);
  assert.deepEqual(said(`import { VERB_NAMES } from "../src/resolve/visibility.mjs";\n${HANDS}`), []);
  assert.equal(said(`import { VERB_NAMES, spanOf } from "../src/resolve/visibility.mjs";\n${HANDS}`).length, 1,
    "one configuration-reading name beside them is the whole condition");
});

test("the reader reaches every way a file can bind that module, and an unknown export reads as one", () => {
  assert.equal(said(`const { usageOf } = await import("../src/resolve/visibility.mjs");\n${HANDS}`).length, 1);
  assert.equal(said(`import * as visibility from "../src/resolve/visibility.mjs";\n${HANDS}`).length, 1,
    "a namespace binding reaches every export there is");
  assert.match(said(`import * as visibility from "../src/resolve/visibility.mjs";\n${HANDS}`)[0],
    /reads the module whole/u);
  assert.equal(said(`const visibility = await import("../src/resolve/visibility.mjs");\n${HANDS}`).length, 1);
  assert.equal(said(`import { spanOf as span } from "../src/resolve/visibility.mjs";\n${HANDS}`).length, 1,
    "what decides is the name the module exports, not the local one");
  assert.equal(said(`import { addedTomorrow } from "../src/resolve/visibility.mjs";\n${HANDS}`).length, 1,
    "the list that is written out is the constants', so a new export reads as the machine until somebody says otherwise");
});

/* Watched failing: the clause a binding names is brace-free, and a reader that only stopped at the
   closing one read every `{` above a dynamic import as the start of its names — which is how this
   rule's own case file, quoting one inside a template, reported itself. */
test("the names a binding asks for are read from its own clause and not from a brace above it", () => {
  assert.deepEqual(said(`const held = () => {\n  const one = await import("../src/resolve/visibility.mjs");\n};`), [],
    "a brace opened above is no part of a clause");
  assert.equal(said(`if (ok) { go(); }\nconst { usageOf } = await import("../src/resolve/visibility.mjs");\n${HANDS}`).length, 1,
    "and the clause that is there is still read");
});

test("the line a refusal names is the line the binding is on, whatever stands above it", () => {
  assert.match(said(`${HANDS}\n\n// a comment\n${BINDS}\n`, "twelve.mjs")[0], /^twelve\.mjs:4 /u);
});

/* The exemption is a claim about that module, not about this file, so it is measured rather than
   asserted: two children, two homes, one of them holding the key that moves a row. */
test("the exports this rule exempts answer the same under two configuration homes", () => {
  const room = (saved) => {
    const home = tempRoom("one-home-");
    mkdirSync(join(home, "forge"), { recursive: true });
    writeFileSync(join(home, "forge", "config.json"), JSON.stringify(saved));
    return home;
  };
  const visibility = new URL("../../../src/resolve/visibility.mjs", import.meta.url).href;
  const under = (home) => {
    const ran = spawnSync(process.execPath, ["--input-type=module", "-e",
      `const held = await import(${JSON.stringify(visibility)});`
      + ` console.log(JSON.stringify(${JSON.stringify(CONSTANT_EXPORTS)}.map((one) => held[one])));`],
    { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home } });
    assert.equal(ran.status, 0, ran.stderr);
    return ran.stdout.trim();
  };
  const chosen = under(room({ coolifyRoute: "instance" }));
  assert.equal(chosen, under(room({})), `${CONSTANT_EXPORTS.join(" and ")} moved with the machine, `
    + "so the exemption in plugin/src/checks/suite/one-home.mjs is wrong and every file reading them "
    + "is unheld");
  assert.match(chosen, /coolify/u, "the answer is the table's and not an empty read");
});
