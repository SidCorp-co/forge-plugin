/* A primitive declared twice is a selector that can drift on one side only, which is what happened
   here: one run added a copy of each without ever seeing the set (ISS-101). So the copies are gone,
   a guard says they cannot come back, and each pattern whose bytes moved is watched on the input
   that moved it — over this repository's own markdown, not over invented lines. */
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
import { checkStructure } from "../src/checks/claude-md.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const HOME = "plugin/src/markdown.mjs";

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

const NEEDLES = [
  ["an inline code span", [CODE_SPAN_PATTERN]],
  ["a link target", [LINK_TARGET_PATTERN]],
  ["a link text", [LINK_TEXT_PATTERN]],
  ["a table row", [String.raw`\|.*\|`, String.raw`\|(.*)\|`]],
  ["a table separator", [String.raw`[\s:|-]+\|`, String.raw`[\s|:-]+\|`]],
  ["a markup class", [MARKUP_PATTERN]],
];

const redeclared = (sources) =>
  sources.flatMap(({ rel, text }) =>
    NEEDLES
      .filter(([, needles]) => needles.some((one) => text.includes(one)))
      .map(([what]) => `${rel} declares ${what} of its own; ${HOME} holds it`));

const listed = (...paths) =>
  execFileSync("git", ["-C", ROOT, "ls-files", "-z", ...paths], { encoding: "utf8", maxBuffer: 8e6 })
    .split("\0")
    .filter(Boolean);

const read = (rel) => ({ rel, text: readFileSync(join(ROOT, rel), "utf8") });
const modules = () => listed("plugin/src/checks", "plugin/src/spec").filter((one) => one.endsWith(".mjs")).map(read);
const markdown = () => listed("*.md", "docs", "plugin").filter((one) => one.endsWith(".md")).map(read);

test("no module under checks or spec declares a primitive of its own", () => {
  const found = modules();
  assert.ok(found.length >= 10, `${found.length} module(s) scanned; the selector matches too little`);
  assert.deepEqual(redeclared(found), []);
});

test("the guard fires on a module that re-declares one", () => {
  const copies = [
    { rel: "a.mjs", text: `const SPANNED = /${CODE_SPAN_PATTERN}/gu;` },
    { rel: "b.mjs", text: String.raw`const ROW = /^\s*\|(.*)\|\s*$/u;` },
    { rel: "c.mjs", text: String.raw`const SEP = /^\|[\s|:-]+\|$/u;` },
    { rel: "d.mjs", text: "const MARKUP = /[*`_>[\\]()]/g;" },
  ];
  assert.deepEqual(redeclared(copies), [
    `a.mjs declares an inline code span of its own; ${HOME} holds it`,
    `b.mjs declares a table row of its own; ${HOME} holds it`,
    `c.mjs declares a table separator of its own; ${HOME} holds it`,
    `d.mjs declares a markup class of its own; ${HOME} holds it`,
  ]);
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
