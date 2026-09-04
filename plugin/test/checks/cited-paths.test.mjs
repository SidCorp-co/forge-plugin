/* Every case runs the real population through the real walk: one reaching neither the requirements
   tree nor the scripts is a clean report and not a clean tree. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { citedIn, problems } from "../../src/checks/cited-paths.mjs";

const ROOT = new URL("../../..", import.meta.url).pathname;
/* The working tree, not the index: a file this commit adds is a path a clause may already cite. */
const list = (...args) =>
  execFileSync("git", ["-C", ROOT, "ls-files", "--cached", "--others", "--exclude-standard", ...args],
    { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);

/* The population is the part of the tree that is clean today; widening it is an edit here. */
const TREE = list();
const READ = /\.(?:mjs|md)$/u;
const POPULATION = list("docs/requirements", "plugin/scripts").filter((one) => READ.test(one));
const files = POPULATION.map((rel) => ({ rel, text: readFileSync(join(ROOT, rel), "utf8") }));

const said = (rel, text) => problems([{ rel, text }], TREE);

test("no clause and no script cites a path that names no file", () => {
  assert.ok(TREE.length > 300, `${TREE.length} path(s) tracked; the tree is read too narrowly`);
  assert.ok(files.length > 20, `${files.length} file(s) in the population; the selector matches too little`);
  const found = problems(files, TREE);
  assert.deepEqual(found, [], `a citation names no file:\n${found.join("\n")}`);
});

/* Each in the form it was in: a header comment, and a criterion's `Proof:` field. */
test("the two citations this check was written for are each refused in their own form", () => {
  const header = said("plugin/scripts/blast-radius.mjs",
    "// grep misses. Logic in ../src/blast-radius.mjs.\n");
  assert.equal(header.length, 1, header.join("\n"));
  assert.match(header[0], /^plugin\/scripts\/blast-radius\.mjs:1 cites \.\.\/src\/blast-radius\.mjs/u);
  assert.ok(header[0].includes("plugin/src/checks/blast-radius.mjs carries that name"),
    `the refusal names the path that would resolve: ${header[0]}`);

  const clause = said("docs/requirements/srs/fr-12-documentation-gates.md",
    "- **AC-12-1-1** · Rev: 1 · Proof: plugin/test/checks/doc-claims.test.mjs\n");
  assert.equal(clause.length, 1, clause.join("\n"));
  assert.ok(clause[0].includes("plugin/test/checks/docs/doc-claims.test.mjs carries that name"), clause[0]);
});

/* The inequality the check rests on: were the stale path a tail of the new one, the case above
   would resolve and this checker would report nothing, ever. */
test("a path that moved is not the tail of where it moved to", () => {
  const moved = "plugin/test/checks/docs/doc-claims.test.mjs";
  assert.ok(TREE.includes(moved), "the file the citations were corrected to");
  assert.ok(!moved.endsWith(`/plugin/test/checks/doc-claims.test.mjs`), "and the stale path is no tail of it");
  assert.equal(said("docs/requirements/x.md", "Proof: plugin/test/checks/doc-claims.test.mjs\n").length, 1);
});

/* Admitted by measurement: without it, twelve comments that were never wrong would be rewritten. */
test("a path written from an ancestor names its file and is no finding", () => {
  for (const [rel, path] of [
    ["plugin/hooks/gates/claude-md.mjs", "how/claude-md.md"],
    ["plugin/scripts/check-vendor.mjs", "hooks/how/code-quality.md"],
    ["plugin/scripts/skill-dup.mjs", "src/checks/duplication.mjs"],
    ["docs/requirements/srs/01-introduction.md", "brd/README.md"],
    ["plugin/scripts/skill-paths.mjs", "scripts/migration-risk.mjs"],
  ]) {
    assert.deepEqual(said(rel, `see ${path}\n`), [], `${path} from ${rel} names its file`);
  }
});

test("a path resolving from the citing file's own directory or from the root is no finding", () => {
  assert.deepEqual(said("plugin/scripts/one.mjs", "// see ./skill-dup.mjs and ../src/cli.mjs\n"), []);
  assert.deepEqual(said("docs/requirements/one.md", "see plugin/src/checks/duplication.mjs\n"), []);
  assert.ok(TREE.includes("plugin/src/checks/cited-paths.mjs"),
    "and the tree read is the working one, so a file this commit adds is a path a clause may cite");
});

/* A typo and a move need different corrections, so a citation nothing here answers to is reported
   too and says so: reported only where the name resolves, this would pass `doc-claimz.test.mjs`. */
test("a citation no file in the tree answers to is a finding that says nothing carries the name", () => {
  const typo = said("docs/requirements/x.md", "Proof: plugin/test/checks/docs/doc-claimz.test.mjs\n");
  assert.equal(typo.length, 1, typo.join("\n"));
  assert.ok(typo[0].endsWith("and nothing here carries that name either: correct it, or delete the claim"),
    typo[0]);
});

test("the citing file is never offered as its own resolving path", () => {
  const own = said("plugin/scripts/blast-radius.mjs", "// see ../blast-radius.mjs\n");
  assert.deepEqual(own.filter((one) => one.includes("plugin/scripts/blast-radius.mjs carries")), [],
    `a file told to cite itself:\n${own.join("\n")}`);
});

/* Reported and not dropped: going quiet on the harder instance reads as a clean tree. */
test("a stale citation whose name two files carry names both", () => {
  const tree = ["a/one.mjs", "b/one.mjs", "c/two.mjs"];
  const found = problems([{ rel: "docs/x.md", text: "see gone/one.mjs\n" }], tree);
  assert.equal(found.length, 1, found.join("\n"));
  assert.ok(found[0].includes("a/one.mjs and b/one.mjs carry that name"), found[0]);
});

/* R-19 covers every path in a span or a link, so a lone filename counts there and not in prose,
   where `gone.json` is as often a word. Without the two shapes this case reports nothing. */
test("a lone filename is a citation in a span or a link target, and a word in prose", () => {
  const spanned = said("docs/requirements/x.md", "the limits live in `nowhere.json`\n");
  assert.equal(spanned.length, 1, spanned.join("\n"));
  assert.match(spanned[0], /^docs\/requirements\/x\.md:1 cites nowhere\.json/u);
  assert.equal(said("docs/requirements/x.md", "read [the limits](nowhere.json)\n").length, 1,
    "and a link target the same");
  assert.deepEqual(said("docs/requirements/x.md", "a run writes nowhere.json and moves on\n"), [],
    "while the same word in running prose names no path");
  assert.deepEqual(said("docs/requirements/x.md", "see `package.json` and [rules](../../CLAUDE.md)\n"), [],
    "and a lone filename that does resolve is no finding either way");
});

/* `docs/a.md.bak` reduced to `docs/a.md` resolves, so a path naming no file would pass on a prefix
   of one that does; a fragment names a place in a file and comes off before the file is sought. */
test("the extension ends the citation, and a fragment is not part of it", () => {
  assert.deepEqual(said("docs/requirements/x.md", "the old copy is docs/requirements/gone.md.bak\n"), [],
    "a longer name is not cut back to the prefix that carries a source extension");
  const gone = said("docs/requirements/x.md", "read [the rule](nowhere.md#the-tail-rule)\n");
  assert.equal(gone.length, 1, gone.join("\n"));
  assert.match(gone[0], /cites nowhere\.md, which names no file/u, "the place comes off the path");
  assert.deepEqual(said("docs/requirements/x.md", "read [the rule](./README.md#r-19)\n"), [],
    "and a fragment on a path that resolves is no finding");
});

test("a citation is read bare, in a code span and in a link target alike", () => {
  const bare = citedIn("Logic in ../src/blast-radius.mjs.\n").map(({ path }) => path);
  assert.deepEqual(bare, ["../src/blast-radius.mjs"], "the form both live citations were in");
  const rest = citedIn("see `src/b.mjs` and [x](docs/a.md)\n").map(({ path }) => path);
  assert.deepEqual(rest, ["src/b.mjs", "docs/a.md"]);
  assert.deepEqual(citedIn("CLAUDE.md and package.json are names, not paths\n"), [],
    "a bare filename is a name any project has and no claim about a path");
  const twice = citedIn("a/b.md\nx\na/b.md\n");
  assert.deepEqual(twice.map(({ line }) => line), [1, 3], "each citation reports its own line");
});
