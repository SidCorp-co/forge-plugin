/* The three exports that name their subject in argument one, and the claim each one makes of it. A
   copy reads bytes, so its claim is the content of everything below that path and never the names in
   it — the claim a listing makes would hold a pass over an edit to a copied file, which is the one
   direction this ledger has no way to notice. What argument one leaves unestablished still blinds,
   and each case here is paired with the one that proves the claim narrows (ISS-1760). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync }
  from "node:fs";
import { join } from "node:path";

import { auditEnv, contextOf, forgetReads, recordSets, selectTests, setDigest, setsFrom }
  from "../../../../../tools/gates/reads/sets.mjs";
import { prefixOf } from "../../../../../tools/gates/reads/placing.mjs";
import { write } from "../scratch.mjs";
import { tempRoom } from "../../../fixtures.mjs";

const FILE = "plugin/test/one.test.mjs";
const CONTEXT = contextOf(["--test"]);

const room = (files = {}) => {
  const at = tempRoom("gate-copied-");
  const root = join(at, "checkout");
  for (const [path, text] of Object.entries({ [FILE]: "the test\n", ...files })) write(root, path, text);
  return { at, root, dir: join(at, "records"), out: join(at, "out"), dst: join(at, "elsewhere") };
};

const setOf = (over = {}) => ({ file: FILE, paths: new Set(), dirs: new Set(), trees: new Set(),
  whole: new Set(), blind: [], ...over });

// The set is recorded at the content the room was made with, and read back at whatever it holds now.
const recorded = ({ root, dir }, set) => {
  forgetReads();
  recordSets(dir, [set], { root, context: CONTEXT, manifests: [] });
  forgetReads();
};

const again = ({ root, dir }) => {
  forgetReads();
  return selectTests(dir, [FILE], { root, context: CONTEXT }).spend;
};

const audited = ({ root, out }, script) => {
  write(root, "ran.mjs", script);
  const said = spawnSync(process.execPath, [join(root, "ran.mjs")],
    { cwd: root, encoding: "utf8", env: { ...process.env, ...auditEnv(out, root) } });
  assert.equal(said.status, 0, said.stderr);
  return readdirSync(out).map((one) => JSON.parse(readFileSync(join(out, one), "utf8")))[0];
};

const COPY = (from, to) => [`import { cpSync } from "node:fs";`,
  `cpSync(${JSON.stringify(from)}, ${JSON.stringify(to)}, { recursive: true });`].join("\n");

test("a copy records its source as a claim on the content below it, and no blindness", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    const one = audited(where, COPY("plugin/src", where.dst));
    assert.deepEqual(one.whole, ["plugin/src"]);
    assert.deepEqual(one.blind, []);
    assert.deepEqual(one.trees, [], "names are a listing's claim and not a copy's");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("an edit to the content of a file under a copied source spends the file that copied it", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    recorded(where, setOf({ whole: new Set(["plugin/src"]) }));
    assert.deepEqual(again(where), [], "nothing changed, so the copy's claim still answers");
    write(where.root, "plugin/src/one.mjs", "one, edited\n");
    assert.deepEqual(again(where), [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("an edit beside a copied source, under nothing it claims, spends nothing", () => {
  const where = room({ "plugin/src/one.mjs": "one\n", "plugin/other/two.mjs": "two\n" });
  try {
    recorded(where, setOf({ whole: new Set(["plugin/src"]) }));
    write(where.root, "plugin/other/two.mjs", "two, edited\n");
    assert.deepEqual(again(where), []);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The case the names-only claim answers wrong: a recursive listing holds the same names either way,
   so a claim keyed on it would hold the file back on a change to what the copy takes. */
test("a file under a copied source becoming an empty directory of that name spends the file that copied it", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    recorded(where, setOf({ whole: new Set(["plugin/src"]) }));
    const names = () => readdirSync(join(where.root, "plugin/src"), { recursive: true }).sort().join("\n");
    const before = names();
    rmSync(join(where.root, "plugin/src/one.mjs"));
    mkdirSync(join(where.root, "plugin/src/one.mjs"));
    assert.equal(names(), before, "the case is about a change the names do not carry");
    assert.deepEqual(again(where), [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* `inside` refuses a `node_modules` and a `.git` of this repository's own, by their repository-relative
   names and not by the name wherever it appears, so a fixture's own copy of either is content like any
   other and a claim that skipped it would be narrower than the paths beside it. */
test("a node_modules a fixture keeps below a copied source is inside that source's claim", () => {
  const where = room({ "plugin/test/fixtures/project/node_modules/dep/index.js": "the dependency\n" });
  try {
    recorded(where, setOf({ whole: new Set(["plugin/test/fixtures"]) }));
    write(where.root, "plugin/test/fixtures/project/node_modules/dep/index.js", "another dependency\n");
    assert.deepEqual(again(where), [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a watch on a file claims that file's content, and one on a directory everything below it", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    const one = audited(where, [`import { watch, watchFile, unwatchFile } from "node:fs";`,
      `watchFile("plugin/src/one.mjs", () => {});`, `unwatchFile("plugin/src/one.mjs");`,
      `watch("plugin/src").close();`].join("\n"));
    assert.ok(one.paths.includes("plugin/src/one.mjs"), one.paths.join(" "));
    assert.deepEqual(one.whole, ["plugin/src"]);
    assert.deepEqual(one.blind, []);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a copy told to follow its links blinds the file that called it", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    const one = audited(where, [`import { cpSync } from "node:fs";`,
      `cpSync("plugin/src", ${JSON.stringify(where.dst)}, { recursive: true, dereference: true });`].join("\n"));
    assert.deepEqual(one.blind, ["cpSync: a copy that follows its links"]);
    assert.deepEqual(one.whole, []);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* A link at the subject's own last component is placed like one at any other: the watch answers for
   the target as that target changes, which is the claim, and the link's own text is not. */
test("a watch on a link claims the path that link lands on, and blinds nothing", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    symlinkSync("src/one.mjs", join(where.root, "plugin", "aliased.mjs"));
    const one = audited(where, [`import { watch } from "node:fs";`, `watch("plugin/aliased.mjs").close();`].join("\n"));
    assert.ok(one.paths.includes("plugin/src/one.mjs"), one.paths.join(" "));
    assert.deepEqual(one.blind, []);
    assert.deepEqual(one.whole, [], "it landed on a file, so the claim is that file and not a walk");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* A subject outside this tree is out of the ledger's reach only where the tree is not under it: the
   copy of the parent below reads every file of this repository through it. */
test("a copy of a tree this one stands under blinds, and one beside it records nothing", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  // Outside the room, since a copy of the room into itself is a recursion and not this case.
  const to = tempRoom("gate-copied-to-");
  try {
    mkdirSync(join(where.at, "beside"), { recursive: true });
    writeFileSync(join(where.at, "beside", "x.txt"), "x\n");
    const over = audited(where, COPY("..", join(to, "over")));
    assert.deepEqual(over.blind, ["cpSync: a copy of a tree this one stands under"]);
    rmSync(where.out, { recursive: true, force: true });
    const apart = audited(where, COPY(join(where.at, "beside"), join(to, "apart")));
    assert.deepEqual(apart.blind, []);
    assert.deepEqual(apart.whole, []);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
    rmSync(to, { recursive: true, force: true });
  }
});

/* `inside` judges the name it was handed, so an alias standing outside this tree reads straight into
   it while every lexical test says otherwise. Placed, the read is claimed where it came to rest,
   which is this repository's own path and no blindness at all (ISS-1944). */
test("a copy or a watch reaching into this tree through an outside link is claimed where it landed", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    mkdirSync(join(where.at, "outside"), { recursive: true });
    symlinkSync(join(where.root, "plugin"), join(where.at, "outside", "source"));
    const alias = join(where.at, "outside", "source");
    const one = audited(where, COPY(join(alias, "src"), where.dst));
    assert.deepEqual(one.whole, ["plugin/src"]);
    assert.deepEqual(one.blind, []);
    rmSync(where.out, { recursive: true, force: true });
    const two = audited(where, [`import { watch } from "node:fs";`,
      `watch(${JSON.stringify(join(alias, "src", "one.mjs"))}).close();`].join("\n"));
    assert.ok(two.paths.includes("plugin/src/one.mjs"), two.paths.join(" "));
    assert.deepEqual(two.blind, []);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* `cp` hands a link on as a link, `dereference` being the flag for the other reading and blinding,
   so the name it was spelled is what it took and a retarget of that link moves what the copy holds.
   Only a link above the last component moved where the copy looked (ISS-1944). */
test("a copy of a link claims the link, and one through a link above it claims where that landed", () => {
  const where = room({ "docs/two.md": "two\n", "other/two.md": "two\n" });
  try {
    symlinkSync("../docs", join(where.root, "plugin", "away"));
    const one = audited(where, COPY("plugin/away", where.dst));
    assert.deepEqual(one.whole, ["plugin/away"], "cp wrote a link, and its own text is what it took");
    recorded(where, setOf({ whole: new Set(["plugin/away"]) }));
    assert.deepEqual(again(where), []);
    unlinkSync(join(where.root, "plugin", "away"));
    symlinkSync("../other", join(where.root, "plugin", "away"));
    assert.deepEqual(again(where), [FILE], "the same content behind it, and a link the copy writes differently");
    rmSync(where.out, { recursive: true, force: true });
    const two = audited(where, COPY("plugin/away/two.md", join(where.at, "second")));
    assert.deepEqual(two.whole, ["other/two.md"], "the link is above the last component, so it is followed");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* Each of the three names a tree in argument one, and each is judged on where that name came to
   rest: below a ring of links it comes to rest nowhere, which blinds rather than claims. */
const CAUGHT = (imported, call) => [`import { ${imported} } from "node:fs";`,
  `try { ${call} } catch (error) { if (error.code !== "ELOOP") throw error; }`].join("\n");

test("a copy, a watch and a glob of a name below a ring of links each blind and claim nothing", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  const ring = "a read whose links ran out of hops, so where it landed is unknown";
  try {
    symlinkSync("ring2", join(where.root, "plugin", "ring"));
    symlinkSync("ring", join(where.root, "plugin", "ring2"));
    const calls = [
      ["cpSync", CAUGHT("cpSync",
        `cpSync("plugin/ring/below", ${JSON.stringify(where.dst)}, { recursive: true });`)],
      ["watch", CAUGHT("watch", `watch("plugin/ring/below").close();`)],
      ["globSync", CAUGHT("globSync", `globSync("plugin/ring/below/*");`)],
    ];
    for (const [named, script] of calls) {
      rmSync(where.out, { recursive: true, force: true });
      const one = audited(where, script);
      assert.deepEqual(one.blind, [ring], `${named} placed a subject that lands nowhere`);
      assert.deepEqual(one.whole, [], `${named} claimed the name it was spelled`);
    }
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* A link inside a claimed tree is hashed by what it points at wherever that is in this tree, because
   everything that reads through the link reads that: a glob answering across one, and a test reading
   through a copy of one. Its own text would stand while the content it reaches moved (ISS-1760). */
test("a link into this tree is claimed by what it points at, so a change there spends the file", () => {
  const where = room({ "plugin/real/one.mjs": "one\n" });
  try {
    symlinkSync("real", join(where.root, "plugin", "alias"));
    const one = audited(where, [`import { globSync } from "node:fs";`,
      `globSync("plugin/alias/*.mjs");`].join("\n"));
    assert.deepEqual(one.whole, ["plugin/real"], "the prefix is placed, so the claim is what it lands on");
    assert.deepEqual(one.blind, [], "the claim is derivable, so nothing here blinds");
    recorded(where, setOf({ whole: new Set(["plugin/alias"]) }));
    assert.deepEqual(again(where), [], "nothing moved yet");
    write(where.root, "plugin/real/two.mjs", "two\n");
    assert.deepEqual(again(where), [FILE], "a file the glob would now answer with is a change to the claim");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The copy keeps the link, and the test then reads through it in a scratch outside this tree, where
   every lexical name says nothing was read here. What it really read is the link's target. */
test("a link kept inside a copied source carries the content it points at into that source's claim", () => {
  const where = room({ "plugin/real/one.mjs": "one\n", "plugin/fixture/kept.mjs": "kept\n" });
  try {
    symlinkSync(join(where.root, "plugin", "real"), join(where.root, "plugin", "fixture", "alias"));
    const one = audited(where, COPY("plugin/fixture", where.dst));
    assert.deepEqual(one.whole, ["plugin/fixture"]);
    recorded(where, setOf({ whole: new Set(["plugin/fixture"]) }));
    write(where.root, "plugin/real/one.mjs", "one, edited\n");
    assert.deepEqual(again(where), [FILE], "the copy carries the link, and reading through it reads this");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* What a copy keeps is the link, so its own text is a claim beside what it points at: two trees of one
   content are one digest, and a reader asking the link where it goes is answered differently. */
test("a link retargeted to a tree of the same content spends the file that copied it", () => {
  const where = room({ "plugin/real/one.mjs": "same\n", "plugin/other/one.mjs": "same\n",
    "plugin/fixture/kept.mjs": "kept\n" });
  try {
    symlinkSync(join(where.root, "plugin", "real"), join(where.root, "plugin", "fixture", "alias"));
    recorded(where, setOf({ whole: new Set(["plugin/fixture"]) }));
    assert.deepEqual(again(where), []);
    unlinkSync(join(where.root, "plugin", "fixture", "alias"));
    symlinkSync(join(where.root, "plugin", "other"), join(where.root, "plugin", "fixture", "alias"));
    assert.deepEqual(again(where), [FILE], "the content below is the same, and the link is not");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* Two claims of one process share the walk's cache, and the one digested inside the other's walk
   stopped at the ring between them: kept, it answers for a claim whose own walk never stopped. */
test("a digest that stopped at a ring is not the answer for another claim", () => {
  const where = room({ "plugin/a/one.mjs": "one\n", "plugin/b/kept.mjs": "kept\n" });
  try {
    symlinkSync("../b", join(where.root, "plugin", "a", "toB"));
    symlinkSync("../a", join(where.root, "plugin", "b", "toA"));
    const of = (one) => setDigest(where.root, { paths: [], dirs: [], trees: [], whole: [one] }, CONTEXT);
    forgetReads();
    of("plugin/a");
    const before = of("plugin/b");
    write(where.root, "plugin/a/one.mjs", "one, edited\n");
    forgetReads();
    of("plugin/a");
    assert.notEqual(of("plugin/b"), before, "b reaches that file through its own link");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

// A ring of links has no content of its own, and the walk says so rather than running out of stack.
test("a link that points at its own ancestor is walked once", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    symlinkSync(join(where.root, "plugin"), join(where.root, "plugin", "src", "up"));
    recorded(where, setOf({ whole: new Set(["plugin"]) }));
    assert.deepEqual(again(where), []);
    write(where.root, "plugin/src/one.mjs", "one, edited\n");
    assert.deepEqual(again(where), [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a glob claims everything below its pattern's non-magic prefix, against the cwd the call names", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    const one = audited(where, [`import { globSync } from "node:fs";`,
      `globSync("src/**/*.mjs", { cwd: ${JSON.stringify(join(where.root, "plugin"))} });`].join("\n"));
    assert.deepEqual(one.whole, ["plugin/src"]);
    assert.deepEqual(one.blind, []);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a glob whose prefix lies outside this tree blinds the file that called it", () => {
  const where = room();
  try {
    const one = audited(where, [`import { globSync } from "node:fs";`,
      `globSync(${JSON.stringify(join(where.at, "**", "*.mjs"))});`].join("\n"));
    assert.deepEqual(one.blind, ["globSync: a listing by a pattern rooted outside this tree"]);
    assert.deepEqual(one.whole, []);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a pattern's prefix ends at the first segment that might be magic", () => {
  assert.equal(prefixOf("plugin/**/*.mjs"), "plugin");
  assert.equal(prefixOf("fixtures/*/"), "fixtures");
  assert.equal(prefixOf("*.mjs"), ".");
  assert.equal(prefixOf("/a/b/*.mjs"), "/a/b");
  assert.equal(prefixOf("a/b/c.mjs"), "a/b");
});

/* A kind the record does not carry is evidence nobody took, and reading it as an empty claim is the
   narrow this exists to remove: the record is refused instead, and its file spent. */
test("a record that does not carry every kind is no record here", () => {
  const where = room();
  try {
    mkdirSync(where.out, { recursive: true });
    const one = { ticket: null, argv: [join(where.root, FILE)], paths: [FILE], dirs: [], trees: [],
      whole: [], blind: [], spawned: [], done: true };
    writeFileSync(join(where.out, "own-1.json"), JSON.stringify(one));
    assert.equal(setsFrom(where.out, where.root).length, 1);
    writeFileSync(join(where.out, "own-1.json"), JSON.stringify({ ...one, whole: undefined }));
    assert.equal(setsFrom(where.out, where.root).length, 0);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});
