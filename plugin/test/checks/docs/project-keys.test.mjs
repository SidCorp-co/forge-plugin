/* The keys of the project file, the section of README that claims to list them, and the table the
   writing verb routes them through, held equal. Each case below fails without the rule: the repository
   one fires on a key nobody documented or nothing can write, and the rest on the ways this walk could
   go quiet instead of red. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { keysDocumented, keysRead, projectKeyProblems } from "../../../src/checks/docs/project-keys.mjs";
import { PROJECT_KEY_NAMES } from "../../../src/tools/project-file.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;

/* Where a read of the project file may live: the CLI, the gates and the scripts around a change. The
   suite is not walked — a fixture names keys on purpose that no project ever sets. */
const WALKED = [join("plugin", "src"), join("plugin", "hooks"), "tools"];
const SKIPPED = new Set(["vendor", "node_modules"]);

const sources = () => {
  const out = [];
  const walk = (dir, rel) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) {
        if (!SKIPPED.has(one.name)) walk(join(dir, one.name), join(rel, one.name));
      } else if (one.name.endsWith(".mjs")) {
        out.push({ path: join(rel, one.name), text: readFileSync(join(dir, one.name), "utf8") });
      }
    }
  };
  for (const one of WALKED) walk(join(ROOT, one), one);
  return out;
};

const readme = () => readFileSync(join(ROOT, "README.md"), "utf8");

test("every project key this plugin reads is one README names and one --set can write", () => {
  const read = keysRead(sources());
  const documented = keysDocumented(readme());
  /* The walk's own reach, before anything is asserted about the tree: a selector that matched no
     file and one that matched a clean repository print the same nothing. */
  assert.ok(read.files > 100, `walked ${read.files} file(s)`);
  assert.ok(read.keys.includes("runs"), `found ${read.keys.join(", ")}`);
  assert.ok(read.keys.includes("slug"), `found ${read.keys.join(", ")}`);
  assert.ok(read.keys.length > 10, `found ${read.keys.length} key(s)`);
  assert.notEqual(documented, null, "README.md's Configuration section was not found");
  assert.deepEqual(projectKeyProblems({ read, documented, written: PROJECT_KEY_NAMES }), []);
});

test("a key this plugin reads and no --set route writes is refused, and one written and read nowhere too", () => {
  const read = keysRead([{ path: "a.mjs", text: "forgeJson().parsed?.runs; forgeJson().parsed?.deps;" }]);
  const documented = named(["runs", "deps"]);
  assert.deepEqual(projectKeyProblems({ read, documented, written: ["deps", "runs"] }), []);
  const unwritable = projectKeyProblems({ read, documented, written: ["runs"] });
  assert.equal(unwritable.length, 1);
  assert.match(unwritable[0], /`deps` is a project-file key this plugin reads and the table/u);
  assert.match(unwritable[0], /nothing can write it/u);
  const unread = projectKeyProblems({ read, documented, written: ["deps", "runs", "wokers"] });
  assert.equal(unread.length, 1);
  assert.match(unread[0], /names `wokers` and this plugin reads no such key/u);
  assert.match(unread[0], /a line in somebody's project file that nothing ever looks at/u);
});

const EXAMPLE = `## Configuration

**Project** — everything a tracker decides for itself:

\`\`\`json
{ "slug": "sid-growth", "runs": 2 }
\`\`\`

\`slug\` is read from that file alone. \`runs\` is how many runs this project carries at once.
\`method\` is retired, and \`flow\` took it over.

## Layout
`;

test("the two sides of the comparison are read off that section, and not the prose around it", () => {
  assert.deepEqual(keysDocumented(EXAMPLE), { shown: ["runs", "slug"], retired: ["method"] });
  assert.equal(keysDocumented("## Configuration\n\nNothing here.\n\n## Layout\n"), null);
});

const named = (shown, retired = []) => ({ shown, retired });

test("a key the code reads and that section names nowhere is refused", () => {
  const read = keysRead([{ path: "a.mjs", text: "forgeJson().parsed?.runs; forgeJson().parsed?.deps;" }]);
  const problems = projectKeyProblems({ read, documented: named(["runs", "deps"]), written: read.keys });
  assert.deepEqual(problems, []);
  const short = projectKeyProblems({ read, documented: named(["runs"]), written: read.keys });
  assert.equal(short.length, 1);
  assert.match(short[0], /`deps` is a project-file key this plugin reads/u);
  assert.match(short[0], /JSON example under \*\*Project\*\*/u);
});

test("a key the example shows and nothing reads is refused", () => {
  const read = keysRead([{ path: "a.mjs", text: "forgeJson().parsed?.runs;" }]);
  const problems = projectKeyProblems({ read, documented: named(["runs", "wokers"]), written: read.keys });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /shows `wokers` in its example and this plugin reads no such key/u);
});

test("a key the section calls retired is named, and one nothing reads at all is refused", () => {
  const read = keysRead([{ path: "a.mjs", text: 'written("method")' }]);
  assert.deepEqual(projectKeyProblems({ read, documented: named([], ["method"]), written: read.keys }), []);
  const problems = projectKeyProblems({ read, documented: named(["method"], ["flow"]), written: read.keys });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /calls `flow` retired and this plugin reads it nowhere at all/u);
});

test("a read of the project file by a route the walk does not know is refused", () => {
  const { unexplained } = keysRead([
    { path: "a.mjs", text: "const held = forgeJson().parsed;\nreturn pick(held);\n" },
    { path: "b.mjs", text: "const file = projectFileAt(tree);\nreturn keysOf(file);\n" },
  ]);
  assert.equal(unexplained.length, 2);
  assert.match(unexplained[0], /^a\.mjs:1 reads the project file by a route this check does not know/u);
  /* On the use and not on the binding: taking the parse whole is fine, spending it blind is not. */
  assert.match(unexplained[1], /^b\.mjs:2 /u);
  /* The helper whose key is its caller's, and a local the file does read keys off, are both known. */
  const known = keysRead([
    { path: "c.mjs", text: "const parsed = forgeJson().parsed;" },
    { path: "d.mjs", text: "const one = projectFileAt(tree);\nreturn one?.codex;\n" },
  ]);
  assert.deepEqual(known.unexplained, []);
  assert.deepEqual(known.keys, ["codex"]);
});

test("one recognised read off a bound value says nothing about the rest of its uses", () => {
  const text = "const file = projectFileAt(tree);\nsend(file?.codex);\nsend(file[\"future\"]);\n";
  const read = keysRead([{ path: "a.mjs", text }]);
  assert.deepEqual(read.keys, ["codex", "future"]);
  assert.deepEqual(read.unexplained, []);
  const opaque = keysRead([
    { path: "b.mjs", text: "const file = projectFileAt(tree);\nsend(file?.codex);\nsend(pick(file));\n" },
  ]);
  assert.deepEqual(opaque.keys, ["codex"]);
  assert.equal(opaque.unexplained.length, 1);
  assert.match(opaque.unexplained[0], /^b\.mjs:3 reads the project file by a route this check does not know/u);
});

test("a subscript the check cannot resolve is refused, not inventoried as the name it is written with", () => {
  const read = keysRead([{
    path: "a.mjs",
    text: "const file = projectFileAt(tree);\nconst key = asked();\nsend(file[key]);\n",
  }]);
  assert.deepEqual(read.keys, []);
  assert.equal(read.unexplained.length, 1);
  assert.match(read.unexplained[0], /^a\.mjs:3 /u);
});

test("a walk that matched nothing is a failure and not a clean repository", () => {
  const problems = projectKeyProblems({
    read: { keys: [], unexplained: [], files: 214 },
    documented: named(["runs"]),
    written: [],
  });
  assert.match(problems[0], /matched no project key in 214 source file\(s\)/u);
  assert.match(problems[0], /reporting a clean repository off an empty walk/u);
});

test("a section with no example is reported rather than read as a document naming no keys", () => {
  const read = keysRead([{ path: "a.mjs", text: "forgeJson().parsed?.runs;" }]);
  assert.match(projectKeyProblems({ read, documented: null, written: read.keys }).join("\n"),
    /carries no \*\*Project\*\* heading with a json example under it/u);
});
