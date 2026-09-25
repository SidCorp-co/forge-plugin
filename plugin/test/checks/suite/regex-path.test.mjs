/* A run's scratch root is named after the id `tools/run.mjs` minted for it, a batch id joins its
   keys with `+`, and 40 cases across 16 files read that `+` as an operator and went red for a tree
   they had not changed (ISS-1442). Fixing them is one commit; the shape comes back with the next
   case that asserts a path was printed, so the rule is held here. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { exportsIn, pathsIn } from "../../../src/checks/suite/regex-path.mjs";
import { escaped } from "../../fixtures.mjs";

const TREES = {
  "plugin/test": new URL("../../", import.meta.url).pathname,
  "tools/test": new URL("../../../../tools/test/", import.meta.url).pathname,
  "packages/code-quality/test": new URL("../../../../packages/code-quality/test/", import.meta.url).pathname,
};

const files = () => {
  const out = [];
  const walk = (dir, at) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) walk(join(dir, one.name), `${at}/${one.name}`);
      else if (/\.m?js$/u.test(one.name)) out.push({ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") });
    }
  };
  for (const [at, dir] of Object.entries(TREES)) walk(dir, at);
  return out;
};

const borrowed = (walked) => walked.reduce((all, one) => new Set([...all, ...exportsIn(one.text)]), new Set());

test("the walk reaches every test tree, so a clean answer is clean suites and not an empty selector", () => {
  const walked = files();
  assert.ok(walked.length > 100, `${walked.length} file(s) walked; the selector matches too little`);
  for (const rel of ["plugin/test/tracker/evidence.test.mjs", "tools/test/gates/scratch.mjs",
    "packages/code-quality/test/fixtures/room.test.js"]) {
    assert.ok(walked.some((one) => one.rel === rel), `${rel} is not reached`);
  }
});

test("the fixtures a test tree borrows a room from are known to be paths", () => {
  const known = borrowed(files());
  for (const name of ["tempRoom", "tempHome", "dirtyRepo", "cleanRepo"]) {
    assert.ok(known.has(name), `${name} is exported from a fixture and makes a path, and the walk did not see it`);
  }
});

test("no case in either test tree puts a path it did not choose into a RegExp source", () => {
  const walked = files();
  const known = borrowed(walked);
  assert.deepEqual(walked.flatMap((one) => pathsIn(one.text, one.rel, known)), []);
});

const MADE = "const work = join(tmpdir(), \"made\");\n";
const BORROWED = "import { tempRoom } from \"../fixtures.mjs\";\nconst work = tempRoom(\"borrowed \");\n";

/* One per route a path takes to an interpolation, because a rule reaching one of them reads exactly
   like a clean tree to whoever writes the next case by another. */
const REFUSED = {
  "a path made where the case stands": `${MADE}assert.match(said, new RegExp(\`in \${work}\`, "u"));\n`,
  "a path borrowed from a fixture another file exports": `${BORROWED}assert.match(said, new RegExp(\`in \${work}\`, "u"));\n`,
  "a path joined off a borrowed one": `${BORROWED}const log = \`\${work}/one.log\`;\nassert.match(said, new RegExp(\`in \${log}\`, "u"));\n`,
  "a path built inside the interpolation itself": `assert.match(said, new RegExp(\`in \${join(tmpdir(), "x")}\`, "u"));\n`,
  "a path that is the whole pattern rather than part of one": `${MADE}assert.match(said, new RegExp(work, "u"));\n`,
  "a path in the second of two templates joined into one pattern": `${MADE}assert.match(said, new RegExp(\`in \` + \`\${work}\`, "u"));\n`,
  "a pattern built with no `new` in front of it": `${MADE}assert.match(said, RegExp(\`in \${work}\`, "u"));\n`,
  "a path concatenated between two spelt-out ends": `${MADE}assert.match(said, new RegExp("^" + work + "$", "u"));\n`,
  "a path beside an escaped one in the same interpolation": `${MADE}const at = tmpdir();\nassert.match(said, new RegExp(\`in \${escaped(at) + work}\`, "u"));\n`,
  "a path beside an escape whose own argument carries a bracket": `${MADE}assert.match(said, new RegExp(\`\${escaped("(") + work}\`, "u"));\n`,
};

for (const [route, source] of Object.entries(REFUSED)) {
  test(`${route} is refused, on its own line`, () => {
    const said = pathsIn(source, "plugin/test/made-up.test.mjs", new Set(["tempRoom"]));
    assert.equal(said.length, 1, `${said.length} finding(s) for ${route}: ${said.join(" ")}`);
    assert.match(said[0], /^plugin\/test\/made-up\.test\.mjs:\d+ puts the path /u, said[0]);
    assert.match(said[0], /escaped\(\) from plugin\/test\/fixtures\.mjs/u, "a refusal has to name what to write instead");
  });
}

const ACCEPTED = {
  "the same path put through the escape": `${MADE}assert.match(said, new RegExp(\`in \${escaped(work)}\`, "u"));\n`,
  "a borrowed path put through the escape": `${BORROWED}assert.match(said, new RegExp(\`in \${escaped(work)}\`, "u"));\n`,
  "a joined path put through the escape": `${BORROWED}const log = \`\${work}/one.log\`;\nassert.match(said, new RegExp(\`in \${escaped(log)}\`, "u"));\n`,
  "a read that is no path": "const verb = said.split(\" \")[0];\nassert.match(said, new RegExp(`ran ${verb}`, \"u\"));\n",
  "a name another file makes a path and this one declares for itself": "const work = rows.length;\nassert.match(said, new RegExp(`over ${work} row(s)`, \"u\"));\n",
  "a name another file exports as a path, which this one never imports": "assert.match(said, new RegExp(`in ${work}`, \"u\"));\n",
  "a substring taken off a path, which is not the path": `${MADE}const leaf = work.split("/").at(-1);\nassert.match(said, new RegExp(\`in \${leaf}\`, "u"));\n`,
  "the refused shape inside a comment": `/* ${MADE}assert.match(said, new RegExp(\`in \${work}\`, "u")); */\nconst n = 1;\n`,
  "a pattern that interpolates nothing": `${MADE}assert.match(said, new RegExp("in \\\\S+", "u"));\n`,
  "a pattern spelt out as a raw template, brackets and all": `${MADE}assert.match(said, new RegExp(String.raw\`(?!\\()in\`, "u"));\n`,
  "a raw template whose spelt-out text holds the name a path is bound to": `${MADE}assert.match(said, new RegExp(String.raw\`^work took the step\\s+1\`, "u"));\n`,
  "a list joined into a pattern, which is no directory": `const RUNGS = ["a", "b"];\nassert.match(said, new RegExp(\`one of \${RUNGS.join("|")}\`, "u"));\n`,
  "a whole concatenation put through the escape": `${MADE}const at = tmpdir();\nassert.match(said, new RegExp(\`in \${escaped(at + work)}\`, "u"));\n`,
  "a whole pattern put through the escape, interpolation and all": `${MADE}assert.match(said, new RegExp(escaped(\`^\${work}$\`), "u"));\n`,
  "the same name, a path in one block and a count in the next": `test("one", () => {\n${MADE}assert.match(said, new RegExp(\`in \${escaped(work)}\`, "u"));\n});\ntest("two", () => {\n  const work = rows.length;\n  assert.match(said, new RegExp(\`over \${work} rows\`, "u"));\n});\n`,
};

for (const [what, source] of Object.entries(ACCEPTED)) {
  test(`${what} is not a finding`, () => {
    assert.deepEqual(pathsIn(source, "plugin/test/made-up.test.mjs", new Set(["tempRoom"])), []);
  });
}

/* The escape the refusal names, held to what a caller does with it: a fragment that matches the
   one string it was made from, embedded in a pattern the caller anchors itself. */
const ROOT = "/tmp/forge-run-iss-1477+1447-9c.5(a)[b]*x?y";

test("the escape answers with a fragment that matches the root it was made from and nothing longer", () => {
  const anchored = new RegExp(`^${escaped(ROOT)}$`, "u");
  assert.match(ROOT, anchored);
  for (const other of [`${ROOT}/one`, ROOT.replace("+", "x"), ROOT.slice(1), "/tmp/forge-run-iss-1477A1447-9c.5(a)[b]*x?y"]) {
    assert.doesNotMatch(other, anchored, `the fragment matched ${other}, which is not the root it was made from`);
  }
});

test("the same fragment inside a longer pattern matches that root with text on either side of it", () => {
  const said = `ln -- '${ROOT}/one.log' '${ROOT}/one.log.txt'`;
  assert.match(said, new RegExp(`ln -- '${escaped(ROOT)}/one\\.log' '${escaped(ROOT)}/one\\.log\\.txt'$`, "u"));
});

/* Why the escape is there at all, on a literal so this case is not itself a site of the rule. */
test("a + in a pattern is one or more of what stands before it, and not a character", () => {
  assert.doesNotMatch("iss-1477+1447", new RegExp("^iss-1477+1447$", "u"));
  assert.match("iss-1477+1447", new RegExp(`^${escaped("iss-1477+1447")}$`, "u"));
});
