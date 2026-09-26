/* The one walk every checker reading JavaScript spends to tell code from a comment or a literal.
   Seven walks stood before it and disagreed exactly where a reader could hide something, so what is
   pinned here is each place they disagreed: a slash, a hole, a quote inside a regex (ISS-1085). */
import assert from "node:assert/strict";
import test from "node:test";

import { COMMENTS, KINDS, LITERALS, literalsIn, maskOf } from "../../../src/checks/source/lexical.mjs";

const EVERY = [...COMMENTS, ...LITERALS];
const kinds = (source) => literalsIn(source).map((one) => [one.kind, source.slice(one.from, one.to)]);

test("each kind is told apart, its content read without its delimiters", () => {
  const source = "const a = \"x y\"; // note\nconst b = 'z';\nconst r = /a b/u;\nconst t = `q ${w} z`;\n/* block */\n";
  assert.deepEqual(kinds(source), [
    [KINDS.DOUBLE, "x y"],
    [KINDS.LINE, " note"],
    [KINDS.SINGLE, "z"],
    [KINDS.REGEX, "a b"],
    [KINDS.TEMPLATE, "q "],
    [KINDS.TEMPLATE, " z"],
    [KINDS.BLOCK, " block "],
  ]);
});

test("a template's hole is code, and a template, a string or a regex nested in one is a literal of its own", () => {
  const source = "x = `t${ `in${\"s\"}` + /`/.source + {k: 1}.k }u`; // c\n";
  assert.deepEqual(kinds(source), [
    [KINDS.TEMPLATE, "t"],
    [KINDS.TEMPLATE, "in"],
    [KINDS.DOUBLE, "s"],
    [KINDS.TEMPLATE, ""],
    [KINDS.REGEX, "`"],
    [KINDS.TEMPLATE, "u"],
    [KINDS.LINE, " c"],
  ], "the backtick inside the regex ends nothing, and the object's brace does not close the hole");
  assert.equal(maskOf(source, { blank: EVERY }), "x = `    `    \" \" ` + / /.source + {k: 1}.k   `;     \n",
    "the hole's code stands and its own `${` and `}` go with the template");
});

/* One rule for every reader. Three rules stood before, and the operators between them were read one
   way by one checker and the other way by the next. */
test("a slash opens a regex wherever an expression starts, and divides after a value", () => {
  const opens = ["a > /re/", "if (ok) /re/.test(x)", "return /re/", "x = /re/", "f(/re/)", "while (a) /re/",
    "x = ++/re/.lastIndex", "x = --/re/.lastIndex", "a\n++/re/.lastIndex", "a /*\n*/ --/re/.lastIndex",
    "export default /re/"];
  const divides = ["a / b", "(a) / b", "a[0] / b", "a.return / b", "f(x) / b", "1.5 / b", "\"s\" / b",
    "`t` / b", "/re/ / b", "a++ / b", "a-- / b", "a /* c */ ++ / b", "a /* c */ -- / b", "1. / b"];
  for (const said of opens) {
    assert.ok(kinds(said).some(([kind, held]) => kind === KINDS.REGEX && held === "re"), `${said} opens a regex`);
  }
  for (const said of divides) {
    assert.ok(kinds(said).every(([kind, held]) => kind !== KINDS.REGEX || held === "re"), `${said} divides`);
    assert.ok(maskOf(said, { blank: EVERY }).includes("/ b"), `${said} keeps its division as code`);
  }
  assert.equal(maskOf("const n = footypeof /size/u;\n", { blank: EVERY }), "const n = footypeof /size/u;\n",
    "an identifier merely ending in a keyword is a value");
});

test("a quote inside a regex class opens nothing, so what follows it is read for what it is", () => {
  for (const quote of ["'", "\"", "`"]) {
    const source = `const r = /[${quote}]/u;\n// a comment\nconst s = "held";\n`;
    assert.deepEqual(kinds(source), [[KINDS.REGEX, `[${quote}]`], [KINDS.LINE, " a comment"], [KINDS.DOUBLE, "held"]],
      `a ${quote} in a class`);
  }
  assert.deepEqual(kinds("const r = /[/]x/u; const s = 'y';"), [[KINDS.REGEX, "[/]x"], [KINDS.SINGLE, "y"]],
    "and a slash inside a class ends nothing");
});

test("the caller chooses what goes: which kinds, their quotes, and a template's holes", () => {
  const source = "a('s', /r/, `t${h}u`); // c\n";
  assert.equal(maskOf(source, { blank: EVERY }), "a(' ', / /, `   h  `);     \n");
  assert.equal(maskOf(source, { blank: EVERY, quotes: "blank" }), "a(   ,    ,     h   );     \n");
  assert.equal(maskOf(source, { blank: EVERY, holes: "text" }), "a(' ', / /, `      `);     \n");
  assert.equal(maskOf(source, { blank: COMMENTS }), "a('s', /r/, `t${h}u`);     \n",
    "a string's content carried through where only comments are asked for");
  assert.throws(() => maskOf(source, { blank: ["string"] }), /blank takes line block single double template regex/u,
    "a kind the walk does not know is refused rather than ignored");
  assert.throws(() => maskOf(source, { blank: EVERY, quotes: "drop" }), /quotes keep or blank/u);
  assert.throws(() => maskOf(source, { blank: EVERY, holes: "none" }), /holes code or text/u);
});

/* Every index a caller takes off the mask indexes the source, which is the property every reader of
   it stands on: counted in code units, so an astral character moves nothing (ISS-2040). */
test("a line comment and a regex end at any of the four line terminators, each kept where it stood", () => {
  for (const [name, stop] of [["LF", "\n"], ["CR", "\r"], ["LS", "\u2028"], ["PS", "\u2029"]]) {
    const source = `// note${stop}const a = "x";/* one${stop}two */`;
    assert.deepEqual(kinds(source), [[KINDS.LINE, " note"], [KINDS.DOUBLE, "x"], [KINDS.BLOCK, ` one${stop}two `]], name);
    assert.equal(maskOf(source, { blank: EVERY, quotes: "blank" }), `       ${stop}const a =    ;      ${stop}      `, name);
    const unclosed = `x = /ab${stop}const b = "y";`;
    assert.deepEqual(kinds(unclosed), [[KINDS.REGEX, "ab"], [KINDS.DOUBLE, "y"]], `${name}: a regex left open ends at the line`);
  }
});

test("the mask is the source's length, code unit for code unit, with every line break where it stood", () => {
  const source = "const drawn = \"\u{1F600}\";\n/* one\n   two */\nconst three = `a\nb`;\n";
  const mask = maskOf(source, { blank: EVERY, quotes: "blank" });
  assert.equal(mask.length, source.length);
  assert.equal(mask.indexOf("const three"), source.indexOf("const three"));
  assert.deepEqual([...mask.matchAll(/\n/gu)].map((one) => one.index), [...source.matchAll(/\n/gu)].map((one) => one.index));
});
