/* A gate red for the weather is one a run learns to re-run rather than read, and this suite had
   grown 22 places asserting how much real time had passed (ISS-1274). Fixing them is one commit;
   the population came back after the shape had already been named, so the rule is held here. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { boundsIn, blanked } from "../../../src/checks/suite/wall-clock.mjs";
import { patience } from "../../patience.mjs";

const SUITE = new URL("../../", import.meta.url).pathname;

const files = () => {
  const out = [];
  const walk = (dir, at) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) walk(join(dir, one.name), `${at}/${one.name}`);
      else if (one.name.endsWith(".mjs")) out.push({ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") });
    }
  };
  walk(SUITE, "plugin/test");
  return out;
};

test("the walk reaches the suite, so a clean answer is a clean suite and not an empty selector", () => {
  const walked = files();
  assert.ok(walked.length > 30, `${walked.length} file(s) under plugin/test; the selector matches too little`);
  assert.ok(walked.some((one) => one.rel === "plugin/test/tracker/rest.test.mjs"), "a nested file is not reached");
});

test("no case in this suite bounds elapsed wall-clock time above by a constant", () => {
  assert.deepEqual(files().flatMap((one) => boundsIn(one.text, one.rel)), []);
});

/* One per clock, because a rule that reaches one of the three reads exactly like a clean tree to
   whoever writes the next case with another. */
const REFUSED = {
  "Date.now()": 'const took = Date.now() - began;\nassert.ok(took < 5000, "x");\n',
  "performance.now()": 'const spent = performance.now() - t0;\nassert.ok(spent <= 250, "x");\n',
  "process.hrtime": 'const ns = process.hrtime.bigint() - t0;\nassert.ok(Number(ns) / 1e6 < 1000, "x");\n',
};

for (const [clock, source] of Object.entries(REFUSED)) {
  test(`a bound on an elapsed read from ${clock} is refused, on its own line`, () => {
    const said = boundsIn(source, "plugin/test/made-up.test.mjs");
    assert.equal(said.length, 1, `${said.length} finding(s) for ${clock}: ${said.join(" ")}`);
    assert.match(said[0], /^plugin\/test\/made-up\.test\.mjs:2 bounds elapsed wall-clock time above by /u, said[0]);
    assert.match(said[0], /patience\(\) from plugin\/test\/patience\.mjs/u, "a refusal has to name what to write instead");
  });
}

test("an elapsed bounded where it is measured is refused there, and named once however often the line reads it", () => {
  const said = boundsIn("while (waiting() && Date.now() - t0 < 2000) spin();\n", "plugin/test/made-up.test.mjs");
  assert.deepEqual(said.map((one) => one.split(" bounds")[0]), ["plugin/test/made-up.test.mjs:1"]);
});

/* The same ceiling with its ends swapped reads as an ordinary comparison and was the way past this. */
for (const written of ["5000 > took", "5000 >= took", "5000 > Date.now() - began"]) {
  test(`a ceiling written as ${written} is refused where the one written the other way round is`, () => {
    const said = boundsIn(`const took = Date.now() - began;\nassert.ok(${written}, "x");\n`, "plugin/test/made-up.test.mjs");
    assert.equal(said.length, 1, `${said.length} finding(s) for ${written}: ${said.join(" ")}`);
    assert.match(said[0], /^plugin\/test\/made-up\.test\.mjs:2 bounds elapsed wall-clock time above by 5000/u, said[0]);
  });
}

test("a stamp bounded against an instant this clock is counting back from is refused", () => {
  const said = boundsIn('assert.ok(Date.parse(stamp) > Date.now() - 60_000, "fresh");\n', "plugin/test/made-up.test.mjs");
  assert.equal(said.length, 1, said.join(" "));
  assert.match(said[0], /above by 60_000/u, said[0]);
});

const ACCEPTED = {
  "a lower bound, which load can only make more true": 'const took = Date.now() - began;\nassert.ok(took >= 2000, "it waited");\n',
  "a fixture instant, which bounds nothing": "const cut = new Date(Date.now() - 30_000);\nrows.push({ at: cut, age: 1500 });\n",
  "a stamp read as older than a cutoff, which is a lower bound too": 'assert.ok(Date.parse(stamp) < Date.now() - 60_000, "stale");\n',
  "the refused shape inside a comment": "/* took < 5000 after const took = Date.now() - began */\nconst n = 1;\n",
  "the refused shape inside a string": 'const took = Date.now() - began;\nassert.match(said, "took < 5000");\n',
  "the refused shape inside a template": "const took = Date.now() - began;\nassert.match(said, `took < 5000 for ${name}`);\n",
  "the refused shape inside a regular expression": "const took = Date.now() - began;\nassert.match(said, /took < 5000/u);\n",
  "a count bounded beside an elapsed on one line": "const took = Date.now() - began;\nassert.ok(took >= 2000 && attempts < 4, \"x\");\n",
  "a name a later case reuses for something that is not an elapsed": "const took = Date.now() - began;\nassert.ok(took >= 1);\nconst took = rows.length;\nassert.ok(took < 4, \"x\");\n",
  "a name an inner block measured, read again outside that block": "const took = rows.length;\n{ const took = Date.now() - began; assert.ok(took >= 1); }\nassert.ok(took < 4, \"x\");\n",
  "a lower bound written with its ends swapped": "const took = Date.now() - began;\nassert.ok(5000 < took, \"x\");\n",
  "a bound already put through patience": 'const took = Date.now() - began;\nassert.ok(took < patience(5000), "x");\n',
};

for (const [what, source] of Object.entries(ACCEPTED)) {
  test(`${what} is not a finding`, () => {
    assert.deepEqual(boundsIn(source, "plugin/test/made-up.test.mjs"), []);
  });
}

/* The escape the refusal names, held to both its ends: a bound it shortened would turn a red into a
   flake of the other kind, and one it widened without limit would be no bound at all. */
test("the escape never returns under the bound it was given, nor over the cap above it", () => {
  for (const ms of [1, 250, 1_000, 60_000]) {
    const given = patience(ms);
    assert.ok(given >= ms, `patience(${ms}) answered ${given}, which is under what it was asked to allow`);
    assert.ok(given <= ms * 8, `patience(${ms}) answered ${given}, which is past the cap this load may buy`);
    assert.equal(Number.isInteger(given), true, `patience(${ms}) answered ${given}, and a timer takes whole milliseconds`);
  }
});

test("blanking keeps every line where it was, so a finding's line number is the file's own", () => {
  const source = "/* one\n   two */\nconst three = 3;\n";
  assert.equal(blanked(source).split("\n").length, source.split("\n").length);
  assert.match(blanked(source), /const three = 3;/u, "code outside the comment is left alone");
  assert.doesNotMatch(blanked(source), /two/u, "and the comment's words are gone");
});

/* The two ends of the bounded lookbehind the slash decision reads (ISS-1941). A window sized to the
   keyword and no further reads `footypeof` as `typeof`, because the keyword then sits flush against
   the start of what the pattern is given and the word boundary matches there; a window taken as a
   fixed slice, without walking the whitespace out first, sees only spaces and calls every spaced
   regular expression a division. */
test("a slash after an identifier merely ending in a keyword is a division, so what follows it stands", () => {
  assert.match(blanked("const n = footypeof /size/u;\n"), /size/u, "`footypeof` is an identifier, not `typeof`");
});

test("a slash parted from its operator by more whitespace than the lookbehind still opens a regular expression", () => {
  const source = `const m = ${" ".repeat(40)}/secret/u;\n`;
  assert.doesNotMatch(blanked(source), /secret/u, "the operator is still what precedes the slash");
  assert.match(blanked(source), /const m =/u, "and the code before it is left alone");
});
