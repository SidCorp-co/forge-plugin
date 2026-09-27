/* A part set is read from disk once per call that needs it, and a question of presence is answered
   from names (ISS-1136). Counted in file reads rather than seconds, each call in a process of its
   own: the listing is built once per process and the flow is resolved once, so a count taken after
   another call in the same process would be a count of what that call left behind. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../fixtures.mjs";

const PLUGIN = new URL("../../", import.meta.url).pathname;
const GUIDES = join(PLUGIN, "src", "guides");
const SERVED = join(PLUGIN, "guides");
const METHOD = join(SERVED, "skills", "issue-flow", "default", "guide");
const CONTRACT = join(SERVED, "contract", "default");

/* Loaded ahead of the measured code, it records every markdown file read once `globalThis.counting`
   is set, and writes the list where the case names. Written at run time, so no file in the tree is a
   module nothing imports. */
const counter = () => {
  const room = tempRoom("reads-once-counter-");
  const path = join(room, "count-reads.mjs");
  writeFileSync(path, [
    'import fs from "node:fs";',
    'import { syncBuiltinESMExports } from "node:module";',
    "const read = fs.readFileSync;",
    "const reads = [];",
    'fs.readFileSync = (path, ...rest) => { if (globalThis.counting && String(path).endsWith(".md")) reads.push(String(path)); return read(path, ...rest); };',
    "syncBuiltinESMExports();",
    'process.on("exit", () => fs.writeFileSync(process.env.COUNT_READS_TO, JSON.stringify(reads)));',
  ].join("\n"));
  return { preload: path, count: join(room, "reads.json") };
};

/* `body` runs after the imports with `counting` set, and what it returns is handed back as `said`. */
const readsOf = (imports, body) => {
  const { preload, count } = counter();
  const code = [
    ...Object.entries(imports).map(([name, file]) => `const ${name} = await import(${JSON.stringify(join(GUIDES, file))});`),
    "globalThis.counting = true;",
    `const said = await (async () => { ${body} })();`,
    "globalThis.counting = false;",
    "console.log(JSON.stringify(said ?? null));",
  ].join("\n");
  const ran = spawnSync(process.execPath, ["--import", preload, "--input-type=module", "-e", code], {
    encoding: "utf8", cwd: tempRoom("reads-once-cwd-"), env: { ...process.env, COUNT_READS_TO: count },
  });
  assert.equal(ran.status, 0, ran.stderr);
  return { reads: JSON.parse(readFileSync(count, "utf8")), said: JSON.parse(ran.stdout.trim().split("\n").at(-1)) };
};

const filesOf = (dir) => readdirSync(dir).filter((one) => one.endsWith(".md")).map((one) => join(dir, one)).sort();

const timesEach = (reads) => reads.reduce((all, one) => all.set(one, (all.get(one) ?? 0) + 1), new Map());

/* Every file of the set read, and each exactly once: a count alone would pass a call reading half the
   set twice. */
const onceEach = (reads, dir, what) => {
  const times = timesEach(reads);
  assert.deepEqual([...times.keys()].sort(), filesOf(dir), `${what} read a file outside ${dir}, or missed one of it`);
  const twice = [...times].filter(([, n]) => n > 1).map(([file, n]) => `${file} ×${n}`);
  assert.deepEqual(twice, [], `${what} read these more than once`);
};

/* Criterion 1. */
test("building the guide listing reads no markdown file", () => {
  const { reads, said } = readsOf({ guides: "guides.mjs" }, "return guides.localRows().length;");
  assert.ok(said > 1, "the listing came back empty, so there was nothing to read");
  assert.deepEqual(reads, [], `the listing read ${reads.length} markdown file(s)`);
});

/* Criterion 2. */
test("whether a skill serves a method body is answered from names", () => {
  const { reads, said } = readsOf({ skills: "skill-guides.mjs" },
    'return [skills.hasBody("issue-flow"), skills.hasBody("forge")];');
  assert.deepEqual(said, [true, false]);
  assert.deepEqual(reads, [], `hasBody read ${reads.length} markdown file(s)`);
});

/* Criterion 3. */
test("one phase of the method reads each part of the flow's guide once", () => {
  const { reads, said } = readsOf({ skills: "skill-guides.mjs" },
    'return skills.skillGuideAnswer("issue-flow")({ part: "5" }).lines?.[0] ?? null;');
  assert.match(said, /^## Phase 5/u);
  onceEach(reads, METHOD, "one phase");
});

/* Criterion 4. */
test("the part a record carries reads each part of the method once and no other skill's", () => {
  const { reads, said } = readsOf({ served: "served.mjs" },
    'let printed = ""; served.partForRecord("note", (text) => { printed = text; }); return printed;');
  assert.match(said, /^## Phase \d/u, "the record carried no part, so nothing was measured");
  onceEach(reads, METHOD, "the part a record carries");
});

/* Criterion 5. */
test("the contract's table of contents reads each contract part once", () => {
  const { reads, said } = readsOf({ contract: "contract.mjs" }, "return contract.contractAnswer({}).lines?.[0] ?? null;");
  assert.match(said, /^The issue-flow contract/u);
  onceEach(reads, CONTRACT, "the contract answer");
});

/* Criterion 6. The entries are read before counting starts, so every read counted is the check's own. */
test("the contract check given the parts a caller read reads none of them again", () => {
  const { reads, said } = readsOf({ contract: "contract.mjs" }, [
    "globalThis.counting = false;",
    "const entries = contract.contractParts({});",
    "globalThis.counting = true;",
    "return contract.contractProblems({ entries });",
  ].join("\n"));
  assert.deepEqual(said, []);
  assert.deepEqual(reads, [], `contractProblems read ${reads.length} markdown file(s) it was handed`);
});

/* Criterion 7. */
test("whether each declared flow ships a contract is answered from names", () => {
  const { reads, said } = readsOf({ contract: "contract.mjs" }, "return contract.flowProblems();");
  assert.deepEqual(said, []);
  assert.deepEqual(reads, [], `flowProblems read ${reads.length} markdown file(s)`);
});
