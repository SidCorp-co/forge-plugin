/* A primitive declared twice is a selector that can drift on one side only, which is what happened here:
   one run added a copy of each without ever seeing the set (ISS-101). So the copies are gone, a guard says
   they cannot come back over every home and not only the markdown one — two copies of the shell-word quoter
   survived a scan of two directories — and each pattern whose bytes moved is watched on the input that
   moved it, over this repository's own markdown and its own paths, not over invented lines. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CODE_SPAN_PATTERN,
  LINK_TARGET_PATTERN,
  LINK_TEXT_PATTERN,
  MARKUP_PATTERN,
  TABLE_ROW_PATTERN,
  TABLE_SEPARATOR_PATTERN,
  withoutMarkup,
  withoutSpans,
} from "../src/markdown.mjs";
import { FENCE_PATTERN } from "../src/flow/machine.mjs";
import { typed } from "../src/hooks/shell-spans.mjs";
import { DATA_FIELD, sseData } from "../src/sse.mjs";
import { checkStructure } from "../src/checks/claude-md.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const MARKDOWN = "plugin/src/markdown.mjs";
const SHELL = "plugin/src/hooks/shell-spans.mjs";
const SSE = "plugin/src/sse.mjs";
const MACHINE = "plugin/src/flow/machine.mjs";
const FLAGS = "plugin/src/resolve/flags.mjs";

/* The forms replaced, as they stood at 70674ca, and the markup class as it stood at 29e74e9. A copy
   in a test is a historical record and not a second authority: it exists so a later run cannot move
   a selector with nothing to notice. */
const OLD = {
  claudeRow: /^\s*\|.*\|\s*$/u,
  specRow: /^\s*\|(.*)\|\s*$/u,
  specSeparator: /^\s*\|[\s:|-]+\|\s*$/u,
  span: /`[^`\n]*`/g,
  linkTarget: /\]\(([^)\s]+)\)/g,
  docIndexLink: /\]\(([^)\s]+)\)/u,
  linkText: /\[([^\]]*)\]\([^)]*\)/gu,
  claudeMarkup: /[*`_>[\]()]/gu,
  dupMarkup: /[*`_>[\]()]/g,
};

/* The escape is the whole call and not the four bytes `'\''`, which is how anything quotes for a shell:
   written short it refuses a module with its own reason to write them, and names no route out. */
const SHELL_ESCAPE = ".replace(/'/gu, String.raw`'\\''`)";

/* The typed width alone: `startsWith("data:")` also fires on a module testing a `data:` URI, and the
   refusal would send it to a frame reader. What that leaves uncaught spells the field and derives
   from it, so it carries no count and is not the drift this pair was filed for. */
const SSE_NEEDLES = ["line.slice(5)", ".slice(5).trim()"];
/* The fence without its anchors: a copy compiled with other flags is the same pattern, and a module that only names the wrapper is not one. */
const FENCE_WORD = String.raw`⟦(?:END_)?UNTRUSTED_DATA[^⟧]*⟧`;

/* The comparison a copy writes, and the pair a copy declaring the words as a list would write. */
const HELP_FORMS = ['=== "-h"', '"-h", "--help"'];

/* Two modules read a help flag anywhere in a line rather than as its first word and spell the same
   two words to do it; no needle over text tells either from a copy, and neither is one. Named here,
   where a run widening this scan reads it; docs/cli/the-primitives.md carries why. */
const ANY_POSITION = ["plugin/src/codex/codex.mjs", "plugin/hooks/gates/codex-order.mjs"];

const NEEDLES = [
  ["an inline code span", MARKDOWN, [CODE_SPAN_PATTERN]],
  ["a link target", MARKDOWN, [LINK_TARGET_PATTERN]],
  ["a link text", MARKDOWN, [LINK_TEXT_PATTERN]],
  ["a table row", MARKDOWN, [String.raw`\|.*\|`, String.raw`\|(.*)\|`]],
  ["a table separator", MARKDOWN, [String.raw`[\s:|-]+\|`, String.raw`[\s|:-]+\|`]],
  ["a markup class", MARKDOWN, [MARKUP_PATTERN]],
  ["a shell word", SHELL, [String.raw`[\w./@+][\w./@+-]*`, SHELL_ESCAPE]],
  ["an SSE frame reader", SSE, SSE_NEEDLES],
  ["the untrusted-data fence", MACHINE, [FENCE_WORD]],
  ["the help predicate", FLAGS, HELP_FORMS, ANY_POSITION],
];

const redeclared = (sources) =>
  sources.flatMap(({ rel, text }) =>
    NEEDLES
      .filter(([, home, needles, except = []]) =>
        rel !== home && !except.includes(rel) && needles.some((one) => text.includes(one)))
      .map(([what, home]) => `${rel} declares ${what} of its own; ${home} holds it`));

const listed = (...paths) =>
  execFileSync("git", ["-C", ROOT, "ls-files", "-z", ...paths], { encoding: "utf8", maxBuffer: 8e6 })
    .split("\0")
    .filter(Boolean);

const read = (rel) => ({ rel, text: readFileSync(join(ROOT, rel), "utf8") });
/* Every module, since a copy lands wherever a run writes: this read `checks` and `spec` and both quoter copies sat outside them. `vendor/` is another package's, and its `.js` is not this filter's.
   `plugin/vi-natural/` is out by judgement and not by physics: an import upward would resolve, and nothing enforces the boundary. It is the repository's other CLI, with its own document and its own config, and its reader is a different reader — it trims a line before testing the field and parses each line alone, so the shared form cannot serve it. Its typed width is real and routed to its own issue, not answered here. */
const modules = () => listed("plugin/src", "plugin/hooks").filter((one) => one.endsWith(".mjs")).map(read);
const markdown = () => listed("*.md", "docs", "plugin").filter((one) => one.endsWith(".md")).map(read);

test("no module of the plugin declares a primitive another module is the home of", () => {
  const found = modules();
  assert.ok(found.length >= 60, `${found.length} module(s) scanned; the selector matches too little`);
  for (const home of [SHELL, SSE, MACHINE, FLAGS]) {
    assert.ok(found.some(({ rel }) => rel === home), `${home} is out of the scan the guard runs`);
  }
  assert.deepEqual(redeclared(found), []);
});

test("the guard fires on a module that re-declares one", () => {
  const copies = [
    { rel: "a.mjs", text: `const SPANNED = /${CODE_SPAN_PATTERN}/gu;` },
    { rel: "b.mjs", text: String.raw`const ROW = /^\s*\|(.*)\|\s*$/u;` },
    { rel: "c.mjs", text: String.raw`const SEP = /^\|[\s|:-]+\|$/u;` },
    { rel: "d.mjs", text: "const MARKUP = /[*`_>[\\]()]/g;" },
    { rel: "e.mjs", text: String.raw`const bare = /^[\w./@+][\w./@+-]*$/u;` },
    { rel: "f.mjs", text: "const q = (one) => `'${one.replace(/'/gu, String.raw`'\\''`)}'`;" },
    { rel: "h.mjs", text: "for (const line of lines) held += line.slice(5);" },
    { rel: "i.mjs", text: "const payload = (one) => one.slice(5).trim();" },
    { rel: "j.mjs", text: String.raw`const FENCE = /⟦(?:END_)?UNTRUSTED_DATA[^⟧]*⟧/u;` },
    { rel: "m.mjs", text: 'const asked = word === "-h" || word === "--help";' },
    { rel: "n.mjs", text: 'const HELP = ["-h", "--help"];' },
  ];
  assert.deepEqual(redeclared(copies), [
    `a.mjs declares an inline code span of its own; ${MARKDOWN} holds it`,
    `b.mjs declares a table row of its own; ${MARKDOWN} holds it`,
    `c.mjs declares a table separator of its own; ${MARKDOWN} holds it`,
    `d.mjs declares a markup class of its own; ${MARKDOWN} holds it`,
    `e.mjs declares a shell word of its own; ${SHELL} holds it`,
    `f.mjs declares a shell word of its own; ${SHELL} holds it`,
    `h.mjs declares an SSE frame reader of its own; ${SSE} holds it`,
    `i.mjs declares an SSE frame reader of its own; ${SSE} holds it`,
    `j.mjs declares the untrusted-data fence of its own; ${MACHINE} holds it`,
    `m.mjs declares the help predicate of its own; ${FLAGS} holds it`,
    `n.mjs declares the help predicate of its own; ${FLAGS} holds it`,
  ]);
});

/* A rename would leave the exclusion excusing nothing and still reading as though it did. */
test("the two any-position readers are excluded by name, and both are still in the scan", () => {
  const own = 'const asked = [sub, ...rest].some((one) => one === "-h" || one === "--help");';
  for (const rel of ANY_POSITION) assert.deepEqual(redeclared([{ rel, text: own }]), []);
  const found = modules().map(({ rel }) => rel);
  for (const rel of ANY_POSITION) assert.ok(found.includes(rel), `${rel} is no longer a module the scan reads`);
  assert.deepEqual(redeclared([{ rel: "o.mjs", text: own }]),
    [`o.mjs declares the help predicate of its own; ${FLAGS} holds it`],
    "and the same text anywhere else is still a copy");
});

test("spawning a program with --help, and a pattern reading -h out of prose, are not the predicate", () => {
  const cases = [
    { rel: "p.mjs", text: 'const run = spawnSync(BUNDLED, ["--help"], { encoding: "utf8" });' },
    { rel: "q.mjs", text: String.raw`const TOOL_HELP = /\x60([a-z][\w-]*)\s+(?:-h|--help)\x60/g;` },
  ];
  for (const { rel, text } of cases) {
    assert.ok(text.includes("--help"), `${rel}: the word is there, so only the comparison tells a copy apart`);
  }
  assert.deepEqual(redeclared(cases), []);
});

test("escaping an apostrophe for a shell is not re-declaring the quoter", () => {
  const own = String.raw`const wrap = (one) => "'" + one.split("'").join("'\''") + "'";`;
  assert.ok(own.includes(String.raw`'\''`), "the idiom is there, so only the whole call tells a copy apart");
  assert.deepEqual(redeclared([{ rel: "g.mjs", text: own }]), []);
});

/* Tied back to the home's own source, so the needle cannot drift from the pattern it watches. */
test("the fence needle is the source machine.mjs holds, and catches a copy anchored any way", () => {
  assert.ok(FENCE_PATTERN.includes(FENCE_WORD), "the needle no longer occurs in the pattern it watches");
  const copies = [
    String.raw`const F = /^⟦(?:END_)?UNTRUSTED_DATA[^⟧]*⟧\s*$/gmu;`,
    String.raw`const F = new RegExp("⟦(?:END_)?UNTRUSTED_DATA[^⟧]*⟧", "u");`,
  ];
  for (const text of copies) {
    assert.deepEqual(redeclared([{ rel: "k.mjs", text }]),
      [`k.mjs declares the untrusted-data fence of its own; ${MACHINE} holds it`]);
  }
});

/* A needle on the word alone would refuse every comment that mentions the fence; the pattern is the class between the brackets. */
test("naming the untrusted-data wrapper in prose is not re-declaring the fence", () => {
  const own = "/* ⟦UNTRUSTED_DATA⟧ is off by the time this reads: unwrap took it. */";
  assert.ok(own.includes("UNTRUSTED_DATA"), "the word is there, so only the class tells a copy apart");
  assert.deepEqual(redeclared([{ rel: "l.mjs", text: own }]), []);
});

/* The margin admits a carriage return because the CLAUDE.md checker runs on checkouts this tree
   never sees, and narrowing it to a space and a tab would have failed nothing here. */
test("the shared row matches a CRLF-terminated table row, where a space-and-tab margin does not", () => {
  const row = "| a | b |\r";
  assert.equal(new RegExp(TABLE_ROW_PATTERN, "u").test(row), true);
  assert.equal(new RegExp(String.raw`^[ \t]*\|.*\|[ \t]*$`, "u").test(row), false);
  assert.equal(OLD.claudeRow.test(row), true, "and the form it replaced matched it too");
});

test("the shared row compiled gm leaves the line count the space-and-tab form left", () => {
  const doc = "| a | b |\n| c | d |\n";
  const was = doc.replace(/^[ \t]*\|.*\|[ \t]*$/gm, "X");
  assert.equal(doc.replace(new RegExp(TABLE_ROW_PATTERN, "gmu"), "X"), was);
  assert.equal(doc.replace(new RegExp(String.raw`^\s*\|.*\|\s*$`, "gmu"), "X"), "X\nX",
    "any-whitespace margins would have eaten a line break, which is why the class is closed");
});

/* An empty span is markup to remove and not a claim to read, so the capturing `+` form claude-md
   keeps for repo claims is deliberately not this pattern. */
test("the span pattern removes an empty span, which the capturing form does not match", () => {
  assert.equal(withoutSpans("a `` b"), "a   b");
  assert.equal(/`([^`\n]+)`/u.test("a `` b"), false);
});

/* Where a span and a quoted run overlap, whichever delimiter opens first wins — so one alternation
   and never a pass each. Two passes would leave `properly` standing and report it. */
test("the quote stripping is one alternation, pinned where two passes disagree", () => {
  const text = '"properly `a" b` c';
  assert.deepEqual(checkStructure(text).vague, []);
  const twoPasses = withoutSpans(text).replace(/"[^"\n]*"|«[^»\n]*»/gu, " ");
  assert.match(twoPasses, /properly/u, "the shape this pins against would have kept the word");
});

/* The corpus below cannot tell a target that forbids a space from one that allows it, because no
   document here holds such a link. So each primitive is also pinned on the input that separates it
   from the plausible neighbour a later run might reach for. */
test("each primitive is pinned where a looser neighbour would differ", () => {
  const target = new RegExp(LINK_TARGET_PATTERN, "u");
  assert.equal(target.exec("see [a](one.md).")?.[1], "one.md");
  assert.equal(target.test("see [a](one two.md)."), false, "a target holds no space; [^)]+ would take it");
  assert.equal("see [the words](one.md).".replace(new RegExp(LINK_TEXT_PATTERN, "gu"), "$1"), "see the words.");
  const separator = new RegExp(TABLE_SEPARATOR_PATTERN, "u");
  assert.equal(separator.test("|---|:--:|"), true);
  assert.equal(separator.test("| a | b |"), false, "a row of cells is not the row under the header");
  assert.equal(new RegExp(TABLE_ROW_PATTERN, "u").exec("  | a | b |  ")?.[1], " a | b ");
  assert.equal(withoutSpans("a `b` c"), "a   c");
});

/* Every pattern the unification calls output-neutral, judged over this repository's own markdown
   rather than asserted: a disagreement is a line, named. */
test("no pattern called output-neutral disagrees with the form it replaced", () => {
  const docs = markdown();
  assert.ok(docs.length >= 20, `${docs.length} document(s) read; the corpus is too small to judge on`);
  const row = new RegExp(TABLE_ROW_PATTERN, "u");
  const separator = new RegExp(TABLE_SEPARATOR_PATTERN, "u");
  const linkTarget = new RegExp(LINK_TARGET_PATTERN, "gu");
  const linkText = new RegExp(LINK_TEXT_PATTERN, "gu");
  const one = new RegExp(LINK_TARGET_PATTERN, "u");
  const moved = [];
  for (const { rel, text } of docs) {
    if (withoutSpans(text) !== text.replace(OLD.span, " ")) moved.push(`${rel}: the span strip`);
    if (withoutMarkup(text) !== text.replace(OLD.claudeMarkup, "")) moved.push(`${rel}: the claude-md markup strip`);
    if (withoutMarkup(text) !== text.replace(OLD.dupMarkup, "")) moved.push(`${rel}: the duplication markup strip`);
    for (const [index, line] of text.split("\n").entries()) {
      const at = `${rel}:${index + 1}`;
      if (row.test(line) !== OLD.claudeRow.test(line)) moved.push(`${at}: the claude-md row`);
      if (JSON.stringify(row.exec(line)) !== JSON.stringify(OLD.specRow.exec(line))) moved.push(`${at}: the spec row`);
      if (separator.test(line) !== OLD.specSeparator.test(line)) moved.push(`${at}: the spec separator`);
      if (JSON.stringify([...line.matchAll(linkTarget)]) !== JSON.stringify([...line.matchAll(OLD.linkTarget)])) {
        moved.push(`${at}: the link target`);
      }
      if (JSON.stringify(one.exec(line)) !== JSON.stringify(OLD.docIndexLink.exec(line))) {
        moved.push(`${at}: the doc-index link`);
      }
      if (line.replace(linkText, "$1") !== line.replace(OLD.linkText, "$1")) moved.push(`${at}: the link text`);
    }
  }
  assert.deepEqual(moved, []);
});

/* The two forms replaced, as they stood at b8cd67d in codex-log.mjs and codex-second.mjs — byte-identical
   to each other, which is the drift this guard exists to keep from starting. */
const SHELL_WAS = {
  log: (one) => (/^[\w./@+][\w./@+-]*$/u.test(one) ? one : `'${one.replace(/'/gu, String.raw`'\''`)}'`),
  gate: (one) =>
    /^[\w./@+][\w./@+-]*$/u.test(one) ? one : `'${one.replace(/'/gu, String.raw`'\''`)}'`,
};

/* A refusal names this repository's own paths; the rest are shapes no tracked path has. */
const SHELL_CASES = ["", " ", "a b.md", "it's.md", "-flag", "'", "''", "a'b'c", "a\nb", "a\tb",
  "$HOME", "`x`", "~/x", "a;b", "a|b", "*.md", "a\\b", "ü.md", "a b 'c' -d"];

test("the shared shell word agrees with both forms it replaced, over every path this repository tracks", () => {
  const paths = listed();
  assert.ok(paths.length >= 300, `${paths.length} path(s) read; the corpus is too small to judge on`);
  const moved = [];
  for (const one of [...paths, ...SHELL_CASES]) {
    for (const [where, was] of Object.entries(SHELL_WAS)) {
      if (typed(one) !== was(one)) moved.push(`${where}: ${JSON.stringify(one)} -> ${JSON.stringify(typed(one))}`);
    }
  }
  assert.deepEqual(moved, []);
});

/* Each transport's frame reader at 1d40447, kept here so the shared one can be judged against them. */
const SSE_WAS = {
  rpc: (text) =>
    text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join(""),
  codex: (frame) =>
    frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join(""),
};

/* Nothing this repository tracks is a frame, so they are built: every arrangement up to three of the
   lines below, under both separators — exhaustive over the arrangement and not over the alphabet. */
const SSE_LINES = ['data: {"type":"x"}', 'data:{"type":"x"}', "data: [DONE]", "data:  padded  ",
  "event: message_start", "event:content_block_delta", "id: 42", "retry: 3000", ": keep-alive", "",
  "data:", "data: ", "data : spaced", "datax: another field"];

const frames = function* () {
  for (const separator of ["\n", "\r\n"]) {
    yield "";
    for (const first of SSE_LINES) {
      yield first;
      for (const second of SSE_LINES) {
        yield [first, second].join(separator);
        for (const third of SSE_LINES) yield [first, second, third].join(separator);
      }
    }
  }
};

test("the shared frame reader agrees with both forms it replaced, over every frame either transport can be handed", () => {
  const moved = [];
  let read = 0;
  for (const frame of frames()) {
    read += 1;
    for (const [where, was] of Object.entries(SSE_WAS)) {
      if (sseData(frame) !== was(frame)) moved.push(`${where}: ${JSON.stringify(frame)} -> ${JSON.stringify(sseData(frame))}`);
    }
  }
  assert.equal(read, 2 * (1 + 14 + 14 ** 2 + 14 ** 3), `${read} frame(s) read; the generator moved`);
  assert.deepEqual(moved, []);
});

test("the field width comes from the field name, so a longer field name would move the cut with it", () => {
  assert.equal(DATA_FIELD.length, 5, "the 5 both call sites typed, now derived rather than counted");
  assert.equal(sseData('data: {"a":1}'), '{"a":1}');
  assert.equal(sseData("data:"), "", "a bare field is the empty payload, not a line to skip");
  assert.equal(sseData("data : spaced"), "", "the field is `data:` exactly; a space before the colon is another line");
  assert.equal(sseData('event: ping\ndata: {"a":1}\n'), '{"a":1}', "a line of another field is not this reader's");
  /* A divergence pinned, not compliance: the wire format strips one leading space and joins with a
     line feed, so matching it would change two callers rather than fix one function. */
  assert.equal(sseData("data: a\ndata: b"), "ab", "concatenated, where the standard would answer a\nb");
  assert.equal(sseData("data:  padded  "), "padded", "trimmed whole, where the standard would keep all but one leading space");
});

test("a shell word is quoted where a shell would split it and bare where it would not", () => {
  assert.equal(typed("plain.md"), "plain.md");
  assert.equal(typed("a b.md"), "'a b.md'");
  assert.equal(typed("it's.md"), String.raw`'it'\''s.md'`);
  assert.equal(typed(""), "''", "an empty word has to survive as an argument");
  assert.equal(typed("-flag"), "'-flag'", "a leading dash is quoted here; the ./ layer is codex-log's own");
});
