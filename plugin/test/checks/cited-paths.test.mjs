/* Every case runs the real population through the real walk: one reaching no file this repository
   describes itself in is a clean report and not a clean tree. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

import { citedIn, problems } from "../../src/checks/cited-paths.mjs";

const ROOT = new URL("../../..", import.meta.url).pathname;
/* The working tree, not the index: a file this commit adds is a path a clause may already cite. */
const lines = (...args) =>
  execFileSync("git", ["-C", ROOT, ...args], { cwd: ROOT, encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
const list = (...args) => lines("ls-files", "--cached", "--others", "--exclude-standard", ...args);

/* The population is a decision and not the part of the tree that happened to be clean (ISS-191): the
   files this repository describes itself in, because only there is a named path a claim this check can
   judge. What is out carries its reason, and the case below holds the two to covering the whole tree.
   Every file of a part that is in, whatever its class: a class left unread is a third way out that
   carries no reason, which `docs` declared whole with its figures unwalked was (ISS-263). What is read
   is text, because a citation is something a person reads and corrects: a file that does not decode
   is refused rather than read leniently, where a raster's metadata becomes a citation on a line of a
   byte stream, and goes out the one way anything does, by a row here with its reason (ISS-274). */
const TREE = list();
/* The one thing the population cannot say: it already means untracked and unignored. */
const INDEXED = new Set(lines("ls-files", "--cached"));
const DESCRIBES_THIS_TREE = [".claude-plugin", ".gitignore", "CLAUDE.md", "LICENSE",
  "README.md", "docs", "eslint.config.mjs", "package.json", "packages", "plugin/.claude-plugin",
  "plugin/guides", "plugin/scripts", "plugin/src", "plugin/vi-natural", "tools"];
const ANOTHER_TREE = {
  "VI-NATURAL.md": "the vi-natural CLI's own manual, whose locale paths are its caller's",
  "package-lock.json": "npm's transcription of the packages it fetched, down to each one's own bin",
  "packages/code-quality/CHANGELOG.md": "history: an entry's paths were its consumer's when written",
  "packages/code-quality/README.md": "its examples are literal config values a consumer types, so no"
    + " root can be put in front of them — ISS-201",
  "packages/code-quality/claude-plugin": "the copy sync:skills:check pins to plugin/skills",
  "packages/code-quality/package-lock.json": "the same transcription for that package's dependencies",
  "packages/code-quality/test": "a source tree each case writes under a temporary root and deletes",
  "plugin/bin": "shims whose target is a shell variable expanded at run time, so the path they name"
    + " belongs to whichever copy was invoked — ISS-197's shape in sh",
  "plugin/hooks": "module specifiers node resolves and the working tree does not — ISS-197",
  "plugin/skills": "method loaded into another checkout, held by check:skill-paths to naming no path",
  "plugin/guides/skills": "the same method, served by forge guide and held by the same check",
  "plugin/agents": "role definitions read from wherever they are installed, held by the same check",
  "plugin/test": "a fixture path is invented on purpose, and every case below is one",
  "tools/test": "the same, for the tests of this repository's own scripts",
};
/* A version directory is not a part of the tree, so the claim naming `skills` covers `v1/skills`. */
const unversioned = (rel) => rel.replace(/^plugin\/guides\/v\d+\//u, "plugin/guides/");
const out = (rel) => Object.keys(ANOTHER_TREE).some((claim) =>
  [rel, unversioned(rel)].some((one) => one === claim || one.startsWith(`${claim}/`)));
const POPULATION = list(...DESCRIBES_THIS_TREE).filter((one) => !out(one));
const UTF8 = new TextDecoder("utf-8", { fatal: true });
/* Which way out is the index's answer here too: a run's own scratch is sent to no list (ISS-1014). */
const bytesOf = (rel, bytes, indexed = INDEXED) => {
  try {
    return { rel, text: UTF8.decode(bytes) };
  } catch {
    const way = indexed.has(rel)
      ? "name it in ANOTHER_TREE with the reason it is left unread"
      : "the index does not carry it, so a working file this run wrote goes outside the checkout or"
        + " is deleted";
    return { rel, refused: `${rel} — it does not decode as UTF-8, so it is not text and names no path`
      + ` a reader can correct: ${way}` };
  }
};
const READ = POPULATION.map((rel) => bytesOf(rel, readFileSync(join(ROOT, rel))));
const files = READ.filter((one) => !one.refused);

const said = (rel, text) => problems([{ rel, text }], TREE);

test("nothing this repository says of itself cites a path that names no file", () => {
  assert.ok(TREE.length > 300, `${TREE.length} path(s) tracked; the tree is read too narrowly`);
  assert.ok(files.length > 200,
    `${files.length} file(s) in the population; the selector matches too little`);
  const found = problems(files, TREE);
  assert.deepEqual(found, [], `a citation names no file:\n${found.join("\n")}`);
});

/* Refused either way, ISS-191 having decided that; which refusal is the index's answer and never the
   name's, because a run's own working file and a part of the tree nobody placed look alike (ISS-1014). */
const refusal = (rel, indexed) => indexed.has(rel)
  ? `${rel} — the index carries it and neither list places it: name its part in DESCRIBES_THIS_TREE,`
    + " or name it in ANOTHER_TREE with the reason it is left unread"
  : `${rel} — the index does not carry it, so it is not part of this tree: a working file this run`
    + " wrote goes outside the checkout or is deleted, and one that is a new part of the tree is"
    + " added to the index, which is what asks either list to place it";

/* A part of the tree in neither list is one nothing decided about, and it reads as a clean run. */
test("every file in the tree is read, or left out for a reason named here", () => {
  const claimed = [...DESCRIBES_THIS_TREE, ...Object.keys(ANOTHER_TREE)];
  const unplaced =
    TREE.filter((one) => !claimed.some((claim) => one === claim || one.startsWith(`${claim}/`)));
  assert.deepEqual(unplaced, [],
    `neither read nor accounted for:\n${unplaced.map((one) => refusal(one, INDEXED)).join("\n")}`);
  assert.ok(Object.values(ANOTHER_TREE).every((why) => why.length > 30), "each exclusion says why");
  const refused = READ.filter((one) => one.refused).map(({ refused: why }) => why);
  assert.deepEqual(refused, [], `read and not text:\n${refused.join("\n")}`);
});

const SCRATCH = ".iss953-criteria.md";

test("an unplaced file no commit put here is refused as the run's own and named the way out", () => {
  const said = refusal(SCRATCH, new Set(["CLAUDE.md"]));
  assert.ok(said.includes("not part of this tree"), said);
  assert.ok(said.includes("goes outside the checkout or is deleted"), said);
  assert.ok(!said.includes("DESCRIBES_THIS_TREE"), `a working file is sent to no list: ${said}`);
});

test("the same name refused once the index carries it is sent to the two lists instead", () => {
  const said = refusal(SCRATCH, new Set([SCRATCH]));
  assert.ok(said.includes("DESCRIBES_THIS_TREE"), said);
  assert.ok(said.includes("ANOTHER_TREE"), said);
  assert.ok(!said.includes("outside the checkout"), `a committed file is not the run's: ${said}`);
});

/* A one-pixel PNG carrying a text chunk, the shape an exported figure's metadata takes. */
const png = (text) => {
  const chunk = (type, data) => {
    const size = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    return Buffer.concat([size, Buffer.from(type), data, Buffer.alloc(4)]);
  };
  const header = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header), chunk("tEXt", Buffer.from(text)),
    chunk("IDAT", deflateSync(Buffer.from([0, 255, 0, 0]))), chunk("IEND", Buffer.alloc(0))]);
};

/* Measured before it was decided: the lenient read found this citation, on the chunk's line. */
test("a byte stream under a declared part is refused as not text and never read as prose", () => {
  const figure = png("Source\0docs/diagrams/gone.md");
  const lenient = said("docs/diagrams/one.png", figure.toString("utf8"));
  assert.equal(lenient.length, 1, "the lenient read reports a raster's metadata as a citation");
  assert.match(lenient[0], /^docs\/diagrams\/one\.png:3 cites docs\/diagrams\/gone\.md/u);
  const read = bytesOf("docs/diagrams/one.png", figure, new Set(["docs/diagrams/one.png"]));
  assert.equal(read.text, undefined, "the population's own read carries no text for it");
  assert.ok(read.refused.includes("docs/diagrams/one.png"), read.refused);
  assert.ok(read.refused.includes("it is not text"), read.refused);
  assert.ok(read.refused.includes("name it in ANOTHER_TREE with the reason"), read.refused);
  const scratch = bytesOf("docs/diagrams/one.png", figure, new Set());
  assert.ok(scratch.refused.includes("goes outside the checkout or is deleted"), scratch.refused);
  assert.ok(!scratch.refused.includes("ANOTHER_TREE"), `a working file is sent to no list: ${scratch.refused}`);
});

test("a byte stream a row names is left out before it is read", () => {
  const listed = "packages/code-quality/test";
  assert.ok(DESCRIBES_THIS_TREE.includes("packages") && listed in ANOTHER_TREE,
    "a row inside a declared part, the shape a figure's own row would take");
  assert.ok(TREE.some((one) => one.startsWith(`${listed}/`)), `${listed} holds files to leave out`);
  assert.ok(out(`${listed}/one.png`), "a byte stream there is out by the row");
  assert.deepEqual(READ.filter(({ rel }) => out(rel)), [], "and no file a row names reaches the read");
});

test("a vector figure is text, and the path its link names is judged", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="docs/diagrams/gone.md"><text>x</text></a></svg>\n';
  const read = bytesOf("docs/diagrams/one.svg", Buffer.from(svg));
  assert.equal(read.refused, undefined, "an SVG decodes and is read");
  const found = problems([read], TREE);
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /^docs\/diagrams\/one\.svg:1 cites docs\/diagrams\/gone\.md/u);
});

/* The class the filter hid, counted so a figure added and never walked cannot read as covered. */
test("every figure under the documents directory is in the population", () => {
  const figures = TREE.filter((one) => one.startsWith("docs/") && one.endsWith(".html"));
  assert.ok(figures.length >= 2, `${figures.length} figure(s) tracked; the tree is read too narrowly`);
  assert.deepEqual(figures.filter((one) => !POPULATION.includes(one)), [],
    "a file class the population declares in and the selector leaves out reads as a clean tree");
});

test("a path a figure names in an element is read as a citation", () => {
  const found = said("docs/diagrams/one.html",
    "<p>Every word above is rendered from <code>docs/gone-figure.md</code>.</p>\n");
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /^docs\/diagrams\/one\.html:1 cites docs\/gone-figure\.md/u);
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
