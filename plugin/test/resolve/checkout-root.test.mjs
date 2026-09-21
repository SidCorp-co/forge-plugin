/* One function answered two questions — which checkout this process stands in, and which repository
   it belongs to — and the second answer is what a linked worktree got, so `forge spec` read the main
   checkout's requirements tree while standing on a branch that had changed it (ISS-1245). The cases
   below say which of them reproduce that and which are the behaviour it must not cost. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { git, homeEnv, projectEntry, projectRoom, tempRoom } from "../fixtures.mjs";

const CLI = fileURLToPath(new URL("../../src/cli.mjs", import.meta.url));
const SETTINGS = pathToFileURL(fileURLToPath(new URL("../../src/resolve/settings.mjs", import.meta.url))).href;
const TREE = fileURLToPath(new URL("../../../docs/requirements", import.meta.url));

const SLUG = "checkout-root-fixture";
/* One home for the whole file, not one per call: this machine's record of the project lives under
   it, so a case handed a fresh one would be asking a machine that has never heard of this project. */
const HOME = homeEnv("checkout-root");
const GOALS = join("docs", "requirements", "brd", "03-goals-non-goals.md");
const ADDED = "G-14";
const REMOVED = "G-09";

const ran = (room, ...args) => {
  const done = git(room, ...args);
  assert.equal(done.status, 0, `git ${args.join(" ")}: ${done.stderr}`);
  return done.stdout.trim();
};

/* The branch differs from the main checkout in both directions, because a root that reads the wrong
   tree answers wrongly in both: it cannot see what this branch defines, and it still sees what this
   branch deleted. */
const branchTheTree = (tree) => {
  const path = join(tree, GOALS);
  const rows = readFileSync(path, "utf8").split("\n");
  const kept = rows.filter((row) => !row.includes(`**${REMOVED}**`));
  const at = kept.findIndex((row) => row.includes("**G-10**"));
  kept.splice(at + 1, 0, `| **${ADDED}** A clause this branch defines and the main checkout does not. | none |`);
  writeFileSync(path, kept.join("\n"));
  ran(tree, "add", GOALS);
  ran(tree, "commit", "-qm", "the branch moves two clauses");
};

/* One repository, two linked worktrees: one nested under the main checkout and one beside it. Both
   once reached the project's settings by a route of their own — the ancestor walk and the repository
   fallback — and since ISS-1403 there is one route: the repository's root folder names the entry, so
   the two layouts have to answer alike and answer with the checkout's own answer. No checkout here
   carries a copy of anything: the record is this machine's and sits outside all three. */
const built = () => {
  const room = realpathSync(tempRoom("checkout-root-"));
  const main = join(room, "main");
  mkdirSync(join(main, "docs"), { recursive: true });
  cpSync(TREE, join(main, "docs", "requirements"), { recursive: true });
  ran(main, "init", "-q", "-b", "master", ".");
  writeFileSync(join(main, ".git", "info", "exclude"), "trees/\n");
  projectRoom(main, HOME.XDG_CONFIG_HOME, { slug: SLUG });
  ran(main, "add", "docs");
  ran(main, "commit", "-qm", "the tree as the main checkout holds it");
  const nested = join(main, "trees", "nested");
  const beside = join(room, "beside");
  ran(main, "worktree", "add", "-q", "-b", "nested", nested);
  ran(main, "worktree", "add", "-q", "-b", "beside", beside);
  branchTheTree(nested);
  branchTheTree(beside);
  return { main, nested, beside };
};

const rooms = built();
const ENTRY = projectEntry(rooms.main, HOME.XDG_CONFIG_HOME);
const LAYOUTS = [["nested under the main checkout", rooms.nested], ["beside the main checkout", rooms.beside]];

const spec = (cwd, id) =>
  spawnSync(process.execPath, [CLI, "spec", id], { cwd, encoding: "utf8", env: HOME });

/* The resolver in a process of its own, because it memoises what it reads off this one's directory. */
const probe = (cwd, env = {}) => {
  const run = spawnSync(process.execPath, ["--input-type=module", "-e",
    `const held = await import(${JSON.stringify(SETTINGS)});\n`
      + "process.stdout.write(JSON.stringify({ root: held.checkoutRoot(), slug: held.projectScope() }));"],
  { cwd, encoding: "utf8", env: { ...HOME, ...env } });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
};

/* The only `git` a process can reach, which records every call and answers none. A resolution that
   needs one comes back empty here; one that walks the disk comes back with the log never written. */
const refusingGit = () => {
  const bin = tempRoom("checkout-root-nogit-");
  const log = join(bin, "asked.txt");
  writeFileSync(join(bin, "git"), `#!/bin/sh\necho "$@" >> ${JSON.stringify(log)}\nexit 1\n`);
  chmodSync(join(bin, "git"), 0o755);
  return { bin, log };
};

for (const [layout, tree] of LAYOUTS) {
  test(`a clause the branch defines is printed in a worktree ${layout}`, () => {
    const run = spec(tree, ADDED);
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.match(run.stdout, /A clause this branch defines and the main checkout does not/u, run.stdout);
  });

  test(`a clause the branch removed is refused in a worktree ${layout}`, () => {
    const run = spec(tree, REMOVED);
    assert.notEqual(run.status, 0, run.stdout);
    assert.match(run.stderr, new RegExp(`No clause named ${REMOVED}`, "u"), run.stderr);
  });

  test(`the root read in a worktree ${layout} is that worktree, from its top and from below it`, () => {
    assert.equal(probe(tree).root, tree);
    assert.equal(probe(join(tree, "docs", "requirements")).root, tree);
  });

  /* Criterion 3 of ISS-1403: the two routes a worktree once had are one, so a worktree and the
     checkout it was added from resolve the SAME entry rather than two files that agree today. */
  test(`a worktree ${layout} resolves the very entry its main checkout resolves`, () => {
    assert.deepEqual(probe(tree).slug, { value: SLUG, from: ENTRY });
    assert.deepEqual(probe(rooms.main).slug, { value: SLUG, from: ENTRY },
      "one repository, one record: neither the worktree nor the checkout holds a copy of its own");
  });
}

test("a subdirectory of an ordinary checkout answers with that checkout", () => {
  assert.equal(probe(join(rooms.main, "docs", "requirements")).root, rooms.main);
});

/* A project's configuration is found by its REPOSITORY's root folder, so a directory belonging to
   no repository has no project — and no checkout to be standing in either. What answered with the
   directory the file sat in answers with nothing at all, the file itself being read by nobody
   (ISS-1403). */
test("a directory belonging to no checkout has no project, so it resolves neither root nor slug", () => {
  const alone = realpathSync(tempRoom("checkout-root-alone-"));
  writeFileSync(join(alone, ".forge.json"), `{ "slug": "${SLUG}" }\n`);
  const found = probe(alone);
  assert.equal(found.root, null, "no checkout holds it, so there is no checkout it stands in");
  assert.deepEqual(found.slug, { value: null, from: null },
    "and the file it sits on names no project, nothing reading one out of a checkout any more");
});

test("a worktree resolves the project with no git it can run, and runs none", () => {
  const { bin, log } = refusingGit();
  const found = probe(rooms.beside, { PATH: bin });
  assert.deepEqual(found.slug, { value: SLUG, from: ENTRY });
  assert.equal(found.root, rooms.beside);
  assert.equal(existsSync(log), false, `git was run: ${existsSync(log) ? readFileSync(log, "utf8") : ""}`);
});
