/* The ship's step before its rebase, over a base that moved a file this change writes only as the
   generator the merged head declares writes it: nobody's hand wrote those bytes, so the step lets the
   change through and says what it ran. A hand edit in the same file is still refused (ISS-1421). */
import assert from "node:assert/strict";
import test from "node:test";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

import { BARE, git, pushed, runIn } from "../run-fixtures.mjs";

const PAGES = join("docs", "pages");
const LIST = join("docs", "pages.txt");
const GEN = join("tools", "gen.mjs");
const GENERATOR = `import { readdirSync, writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(LIST)}, readdirSync(${JSON.stringify(PAGES)}).sort().map((one) => one + "\\n").join(""));
`;

const put = (room, path, text) => {
  mkdirSync(join(room, dirname(path)), { recursive: true });
  writeFileSync(join(room, path), text);
};

const page = (room, name) => {
  put(room, join(PAGES, name), `the page ${name}\n`);
  spawnSync(process.execPath, [GEN], { cwd: room, encoding: "utf8" });
  git(room, "add", PAGES, LIST);
};

const head = (room) => git(room, "rev-parse", "HEAD").stdout.trim();

/* The base declares the generator; the change adds a page on its branch, and master lands another,
   with whatever `also` does beside it. The list is spaced so the two sides merge without conflict. */
const generating = (name, also = () => {}) => {
  const { at, work } = pushed(name);
  const held = JSON.parse(readFileSync(join(work, "package.json"), "utf8"));
  put(work, "package.json", JSON.stringify({ ...held, scripts: { ...held.scripts, "generate:pages": `node ${GEN}` } }, null, 2));
  put(work, GEN, GENERATOR);
  for (const one of ["a.md", "k.md", "m.md", "n.md"]) page(work, one);
  git(work, "add", "package.json", GEN);
  git(work, "commit", "-m", "the base declares a generator");
  git(work, "push", "origin", "master:master");

  git(work, "checkout", "-b", "iss-1421");
  page(work, "b.md");
  git(work, "commit", "-m", "the change adds a page");
  git(work, "checkout", "master");
  page(work, "z.md");
  also(work);
  git(work, "commit", "-m", "what landed between the read and the ship");
  git(work, "push", "origin", "master:master");
  const pin = head(work);
  git(work, "checkout", "iss-1421");
  return { at, work, pin, remote: join(at, "origin.git") };
};

test("a base that moved the change's generated file as its generator writes it does not stop the ship", () => {
  const { work } = generating("generated-clean");
  const run = runIn(work, ["ship"], BARE);
  assert.match(run.stdout, /step 4\/10 {2}rebase onto origin\/master/u,
    `the generator's own output is no move of the change:\n${run.stdout}${run.stderr}`);
  const told = run.stdout.split("\n").find((line) => line.includes(`${LIST} moved since `));
  assert.ok(told?.includes("generate:pages run at "), `the step says what it ran:\n${run.stdout}`);
  assert.ok(told.includes("wrote it back byte for byte"), run.stdout);
});

test("a base that hand-edited the change's generated file stops the ship naming it", () => {
  const { work, pin, remote } = generating("generated-by-hand", (room) => {
    appendFileSync(join(room, LIST), "by-hand.md\n");
    git(room, "add", LIST);
  });
  const mine = head(work);
  const run = runIn(work, ["ship"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stopped at step 3 \(the review answers for the head this lands\)/u, run.stderr);
  assert.ok(run.stderr.includes(`what landed in between wrote ${LIST}, which this change writes too`), run.stderr);
  assert.match(run.stdout, /did not write docs\/pages\.txt back byte for byte/u, run.stdout);
  assert.doesNotMatch(run.stdout, /scratch gate ran/u, "a refused ship spent the gate");
  assert.equal(head(work), mine, "the ship rebased the branch it refused");
  assert.equal(git(remote, "rev-parse", "master").stdout.trim(), pin, "the refused change was pushed");
});
