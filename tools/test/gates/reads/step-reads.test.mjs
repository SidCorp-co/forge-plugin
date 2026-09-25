/* A script step's `reads` decides both whether a change reaches it and what its digest covers, and
   nothing held it to what the step reads: one too narrow is skipped by the change that should run it
   and banks a pass that does not cover the path either. Eleven runs of one gate, a step's argument
   apart: reading outside its declaration, inside it, below the level it claims, and nothing at all
   (ISS-1911); then the four a step spells through a link it makes itself, which is judged on where
   the read landed and never on the name (ISS-1938); then the three tree-shaped calls judged the same
   way, and the one that reaches all three through a ring (ISS-1944); plus the one record a walk down
   from the roots would not reach. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { escapesIn, stepSetFrom } from "../../../gates/reads/sets.mjs";
import { landed, ROOT, run, scratch } from "../scratch.mjs";
import { tempRoom } from "../../../../plugin/test/fixtures.mjs";

const recordOf = (one) =>
  ({ argv: [], paths: [], dirs: [], trees: [], whole: [], spawned: [], blind: [], done: true, ...one });

/* `links` names what this step makes before it reads: `away` out of the claim it declares, `into`
   back inside it from outside, `ring` a pair that lands nowhere; `none` makes nothing. `verb` is
   what it then does with the subject. `probe` asks twice — the ring and a name below it, where the
   placement's own fallback is answered ELOOP rather than absent — and `trees` takes every call that
   names a tree in argument one. Each of those catches its own ELOOP: thrown, it would fail the step
   for its own reason, short of the reads the case is about. */
const READER = `import { cpSync, existsSync, globSync, readdirSync, readFileSync, symlinkSync, watch } from "node:fs";
const [, , one, links, verb] = process.argv;
const LINKS = { away: [["../../docs", "plugin/src/away"]], into: [["../plugin/src", "docs/into"]],
  ring: [["ring2", "plugin/src/ring"], ["ring", "plugin/src/ring2"]] };
for (const [target, at] of LINKS[links] ?? []) symlinkSync(target, at);
const DOES = {
  read: () => readFileSync(one),
  walk: () => readdirSync(one, { recursive: true }),
  copy: () => cpSync(one, "plugin/src/taken", { recursive: true }),
  watch: () => watch(one).close(),
  glob: () => globSync(one + "/*"),
  probe: () => { if (existsSync(one) || existsSync(one + "/below")) process.exit(3); },
  trees: () => {
    for (const each of [DOES.copy, DOES.watch, DOES.glob]) {
      try { each(); } catch (error) { if (error.code !== "ELOOP") throw error; }
    }
  },
};
DOES[verb]();
`;

const gateReading = (name, how) => {
  const { work } = scratch(name, null, null,
    { needing: { step: "check:spec", command: `node plugin/src/reader.mjs ${how}` } });
  landed(work, "plugin/src/reader.mjs", READER);
  return run(work);
};

const outside = gateReading("gate-step-reads-outside", "docs/one.md none read");
const inside = gateReading("gate-step-reads-inside", "plugin/src/one.mjs none read");
const walked = gateReading("gate-step-reads-walked", "docs none walk");
const aliased = gateReading("gate-step-reads-aliased", "plugin/src/away/one.md away read");
const aliasWalked = gateReading("gate-step-reads-alias-walked", "plugin/src/away away walk");
const arriving = gateReading("gate-step-reads-arriving", "docs/into/one.mjs into read");
const ringed = gateReading("gate-step-reads-ringed", "plugin/src/ring ring probe");
const copied = gateReading("gate-step-reads-copied", "plugin/src/away/one.md away copy");
const watched = gateReading("gate-step-reads-watched", "plugin/src/away/one.md away watch");
const globbed = gateReading("gate-step-reads-globbed", "plugin/src/away away glob");
const ringedTrees = gateReading("gate-step-reads-ringed-trees", "plugin/src/ring/below ring trees");

test("a script step reading a path it does not declare fails the gate, named with the path", () => {
  assert.equal(outside.status, 1, `${outside.stdout}${outside.stderr}`);
  assert.match(outside.stderr, /Gate failed: check:spec/u);
  assert.match(outside.stderr,
    /check:spec read docs\/one\.md \(path\), which the reads it declares in tools\/gates\/steps\.mjs/u);
  assert.match(outside.stderr, /do not cover: \., docs\/requirements, plugin\/hooks\/vendor, plugin\/src/u);
});

test("the same step reading a path it does declare passes, and says what it was watched to ask for", () => {
  assert.equal(inside.status, 0, `${inside.stdout}${inside.stderr}`);
  assert.match(inside.stdout,
    /reads: check:spec was watched to ask this repository for 2 paths, every one of them inside what it declares/u);
});

test("a step the audit saw nothing under says its declaration went unchecked, not that it passed", () => {
  assert.match(inside.stdout,
    /reads: check:dup asked this repository for nothing the audit saw, so what it declares went unchecked here: plugin/u);
});

test("a step that walks a directory the root's own level does not reach is refused for the walk", () => {
  assert.equal(walked.status, 1, `${walked.stdout}${walked.stderr}`);
  assert.match(walked.stderr, /check:spec read docs \(walk\), which the reads it declares/u);
});

test("a child record no root reaches is judged too, its parent having left an unfinished one", () => {
  const at = tempRoom("gate-step-reads-orphan-");
  writeFileSync(join(at, "own-1.json"), `${JSON.stringify(recordOf(
    { ticket: null, spawned: [{ ticket: "1-1", file: "node", cwd: at, args: [] }], done: false }))}\n`);
  writeFileSync(join(at, "1-1.json"),
    `${JSON.stringify(recordOf({ ticket: "1-1", paths: ["docs/one.md"] }))}\n`);
  assert.deepEqual(escapesIn(stepSetFrom(at, ROOT), ["plugin/src"]), [{ kind: "path", one: "docs/one.md" }]);
});

test("a step reading through a link it made inside its own claim is refused where the read landed", () => {
  assert.equal(aliased.status, 1, `${aliased.stdout}${aliased.stderr}`);
  assert.match(aliased.stderr, /Gate failed: check:spec/u);
  assert.match(aliased.stderr,
    /check:spec read docs\/one\.md \(path\), which the reads it declares in tools\/gates\/steps\.mjs/u);
});

test("a walk through such a link is refused at the directory it landed in, not the name it was spelled", () => {
  assert.equal(aliasWalked.status, 1, `${aliasWalked.stdout}${aliasWalked.stderr}`);
  assert.match(aliasWalked.stderr, /check:spec read docs \(walk\), which the reads it declares/u);
});

test("a read spelled outside the claim that lands inside it through a link is accepted, and counted there", () => {
  assert.equal(arriving.status, 0, `${arriving.stdout}${arriving.stderr}`);
  assert.match(arriving.stdout,
    /reads: check:spec was watched to ask this repository for 2 paths, every one of them inside what it declares/u);
});

test("a read whose links land nowhere blinds the step, and the probe still answers rather than throwing", () => {
  assert.equal(ringed.status, 0, `${ringed.stdout}${ringed.stderr}`);
  assert.match(ringed.stdout, /reads: check:spec was watched to ask this repository for 1 path, /u);
  assert.match(ringed.stdout, /every one of them inside what it declares, and 1 route it could not follow/u);
});

/* `cp` keeps a link it is handed, so the case is a link above the last component: that one it
   follows, and what it took is the content it found there. */
test("a copy through a link inside the step's claim is refused at the content it really took", () => {
  assert.equal(copied.status, 1, `${copied.stdout}${copied.stderr}`);
  assert.match(copied.stderr, /Gate failed: check:spec/u);
  assert.match(copied.stderr,
    /check:spec read docs\/one\.md \(content\), which the reads it declares in tools\/gates\/steps\.mjs/u);
  assert.match(copied.stderr, /do not cover: \., docs\/requirements, plugin\/hooks\/vendor, plugin\/src/u);
});

test("a watch through a link at a component short of the last is refused at the path it landed on", () => {
  assert.equal(watched.status, 1, `${watched.stdout}${watched.stderr}`);
  assert.match(watched.stderr,
    /check:spec read docs\/one\.md \(path\), which the reads it declares in tools\/gates\/steps\.mjs/u);
});

test("a glob whose prefix reaches through such a link is refused at the directory that prefix landed in", () => {
  assert.equal(globbed.status, 1, `${globbed.stdout}${globbed.stderr}`);
  assert.match(globbed.stderr,
    /check:spec read docs \(content\), which the reads it declares in tools\/gates\/steps\.mjs/u);
});

test("a copy, a watch and a glob below a ring of links blind the step rather than claim what they were spelled", () => {
  assert.equal(ringedTrees.status, 0, `${ringedTrees.stdout}${ringedTrees.stderr}`);
  assert.match(ringedTrees.stdout, /reads: check:spec was watched to ask/u);
  // One path and no content claim beside it: the name they were spelled is what a claim would hold.
  assert.match(ringedTrees.stdout,
    /for 1 path, every one of them inside what it declares, and 1 route it could not follow/u);
});
