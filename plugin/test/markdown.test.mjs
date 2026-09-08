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
  CODE_SPAN_NONEMPTY_PATTERN,
  CODE_SPAN_PATTERN,
  LINK_TARGET_OPEN_PATTERN,
  LINK_TARGET_PATTERN,
  LINK_TEXT_PATTERN,
  MARKUP_PATTERN,
  TABLE_ROW_PATTERN,
  TABLE_SEPARATOR_PATTERN,
  withoutMarkup,
  withoutSpans,
} from "../src/markdown.mjs";
import { FENCE_PATTERN } from "../src/tracker/rest.mjs";
import { typed } from "../src/hooks/shell-spans.mjs";
import { DATA_FIELD, sseData } from "../src/sse.mjs";
import { checkStructure } from "../src/checks/claude-md.mjs";
import { protectInline, verify } from "../vi-natural/format/doc.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const MARKDOWN = "plugin/src/markdown.mjs";
const SHELL = "plugin/src/hooks/shell-spans.mjs";
const SSE = "plugin/src/sse.mjs";
const TRANSPORT = "plugin/src/tracker/rest.mjs";
const HELP_WORD = "plugin/src/resolve/help-word.mjs";
const LOG_READS = "plugin/src/hooks/log-reads.mjs";
const SPEC_PARSE = "plugin/src/spec/parse.mjs";
const CANONICAL = "plugin/src/resolve/canonical.mjs";
const MEDIAN = "plugin/src/stats/median.mjs";
const JSONL = "plugin/src/hooks/hook-log-file.mjs";
const DOC_SHAPE = "plugin/src/checks/doc-shape.mjs";

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

const LINE_AT_FORMS = [String.raw`.split("\n").length`, String.raw`.split('\n').length`];

/* Two modules count the lines of a whole text rather than of a prefix, which is a different question with the same tail and no home to be sent to. Named here rather than narrowed out of the needle: one cut until it matches only the copies already found catches no later one. */
const WHOLE_TEXT = ["plugin/src/checks/claude-md.mjs", "plugin/src/codex/codex-plan.mjs"];

/* The extension class alone: a reader set spelled twice is a gate refusing what the profiler cannot count. */
const LOG_FORMS = [String.raw`log|out|output|err`];

/* The tree's document grammar, which the shape rules and the parser both read. Each is the pattern's own bytes: a checker re-spelling one reads a different document from the parser. */
const SPEC_FORMS = [
  String.raw`\*\*(AC-\d+(?:-\d+)*)\*\*`,
  String.raw`\*\*Status: proposal\b`,
  String.raw`/^Rev:/u`,
  String.raw`/^\s*←/u`,
];

/* The body of the fallback, not the call: `realpathSync` opens every reader of a link, and what makes a copy is answering with the path itself where it resolves to nothing. `codex-tools.mjs` falls back to `resolve(path)` — a different answer to the same question, and not a copy. */
const CANONICAL_FORM = new RegExp(
  String.raw`realpathSync\([^)]*\);?\s*\}\s*catch\s*\{\s*return (?:path|root|said|full|p);`, "u");
/* `settled` answers with the directory a name would sit in, not the name — a different question with
   the same opening, and the second `catch` of the pair is what the needle sees. */
const OWN_FALLBACK = ["plugin/hooks/_hook.mjs"];

/* The idiom, not the sort: the ascending comparator alone fires on four modules that order numbers and compute no middle, and a median is nowhere to send them. The backreference is why both spellings the finding named — `(a, b) => a - b` and `(left, right) => left - right` — are one needle, along with a third nobody has written. Two of the three are one shape in both orderings, the sort before the middle and the middle before it, because the second was a copy the first let through (ISS-364 F1). What none of them catches, and none has a spelling in this tree: a median whose sort and whose middle sit more than 160 characters apart, and one over an array a caller has already sorted, which has no comparator to match. */
const MEDIAN_FORMS = [
  new RegExp(String.raw`\.sort\(\((\w+),\s*(\w+)\) => \1 - \2\)[\s\S]{0,160}\.length\s*\/\s*2`, "u"),
  new RegExp(String.raw`\.length\s*\/\s*2\)[\s\S]{0,160}\.sort\(\((\w+),\s*(\w+)\) => \1 - \2\)`, "u"),
  new RegExp(String.raw`\[(\w+) - 1\]\s*\+\s*\w+\[\1\]\)\s*\/\s*2`, "u"),
];

/* The three logs this tool keeps are all append-only JSONL: mkdir, create at 0600 while empty, append one line. The create
   mode is what makes the needle the store's rather than any append's — `openSync(_, "w", 0o600)` in `resolve/config.mjs` is an atomic replace, a different act with the same permission. */
const JSONL_APPEND = [new RegExp(String.raw`openSync\([^,]*, "a", 0o600\)[\s\S]{0,140}appendFileSync`, "u")];
/* Three doc checks exempt the journal and each keeps its own predicate; the path is the part that may have only one spelling.
   Both spellings, because the copies removed were regex sources and a plain-string needle cannot see `docs\/issue-flow-dry-runs\.md`, which is how all three wrote it. */
const JOURNAL_PATH = [new RegExp(String.raw`docs\\?/issue-flow-dry-runs\\?\.md`, "u")];

const NEEDLES = [
  ["an inline code span", MARKDOWN, [CODE_SPAN_PATTERN]],
  ["a non-empty inline code span", MARKDOWN, [CODE_SPAN_NONEMPTY_PATTERN]],
  /* A prefix of the closed form, so one row watches both spellings; the closed needle could not see the one copy in the tree that had lost its paren. */
  ["a link target", MARKDOWN, [LINK_TARGET_OPEN_PATTERN]],
  ["a link text", MARKDOWN, [LINK_TEXT_PATTERN]],
  ["a table row", MARKDOWN, [String.raw`\|.*\|`, String.raw`\|(.*)\|`]],
  ["a table separator", MARKDOWN, [String.raw`[\s:|-]+\|`, String.raw`[\s|:-]+\|`]],
  ["a markup class", MARKDOWN, [MARKUP_PATTERN]],
  ["a shell word", SHELL, [String.raw`[\w./@+][\w./@+-]*`, SHELL_ESCAPE]],
  ["an SSE frame reader", SSE, SSE_NEEDLES],
  ["the untrusted-data fence", TRANSPORT, [FENCE_WORD]],
  ["the help predicate", HELP_WORD, HELP_FORMS],
  ["a line number from an index", MARKDOWN, LINE_AT_FORMS, WHOLE_TEXT],
  ["a log's name", LOG_READS, LOG_FORMS],
  ["the tree's document grammar", SPEC_PARSE, SPEC_FORMS],
  ["a path's canonical form", CANONICAL, [CANONICAL_FORM], OWN_FALLBACK],
  ["a median over numbers", MEDIAN, MEDIAN_FORMS],
  ["an append-only JSONL store", JSONL, JSONL_APPEND],
  ["the journal's path", DOC_SHAPE, JOURNAL_PATH],
];

/* A needle is a primitive's bytes, or a shape where the primitive is one — a fallback body is the same reading whatever its parameter is called, and no substring tells those copies apart. */
const found = (text, needle) => (typeof needle === "string" ? text.includes(needle) : needle.test(text));

const redeclared = (sources) =>
  sources.flatMap(({ rel, text }) =>
    NEEDLES
      .filter(([, home, needles, except = []]) =>
        rel !== home && !except.includes(rel) && needles.some((one) => found(text, one)))
      .map(([what, home]) => `${rel} declares ${what} of its own; ${home} holds it`));

const listed = (...paths) =>
  execFileSync("git", ["-C", ROOT, "ls-files", "-z", ...paths], { encoding: "utf8", maxBuffer: 8e6 })
    .split("\0")
    .filter(Boolean);

const read = (rel) => ({ rel, text: readFileSync(join(ROOT, rel), "utf8") });
/* Every module, since a copy lands wherever a run writes: this read `checks` and `spec` and both quoter copies sat outside them. `vendor/` is another package's, and its `.js` is not this filter's.
   `plugin/vi-natural/` is in because a copy there has a route to a shared home: an import may run from that tree into `plugin/src/`, which is README's Layout section and not this file's to argue. */
const modules = () => listed("plugin/src", "plugin/hooks", "plugin/vi-natural").filter((one) => one.endsWith(".mjs")).map(read);
const markdown = () => listed("*.md", "docs", "plugin").filter((one) => one.endsWith(".md")).map(read);

test("no module of the plugin declares a primitive another module is the home of", () => {
  const found = modules();
  assert.ok(found.length >= 60, `${found.length} module(s) scanned; the selector matches too little`);
  for (const home of [MARKDOWN, SHELL, SSE, TRANSPORT, HELP_WORD, LOG_READS, MEDIAN, JSONL, DOC_SHAPE]) {
    assert.ok(found.some(({ rel }) => rel === home), `${home} is out of the scan the guard runs`);
  }
  assert.deepEqual(redeclared(found), []);
});

test("the guard fires on a module that re-declares one", () => {
  const copies = [
    { rel: "a.mjs", text: `const SPANNED = /${CODE_SPAN_PATTERN}/gu;` },
    { rel: "a2.mjs", text: `const SPAN = /${CODE_SPAN_NONEMPTY_PATTERN}/gu;` },
    { rel: "a3.mjs", text: `const TARGET = /${LINK_TARGET_OPEN_PATTERN}/g;` },
    { rel: "a4.mjs", text: `const TARGET = /${LINK_TARGET_PATTERN}/gu;` },
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
    { rel: "o.mjs", text: 'const at = (text, i) => text.slice(0, i).split("\\n").length;' },
    { rel: "p.mjs", text: "const at = (text, i) => text.slice(0, i).split('\\n').length;" },
    { rel: "q.mjs", text: String.raw`const CRITERION = /^\s*[-*]\s+\*\*(AC-\d+(?:-\d+)*)\*\*\s*(.*)$/u;` },
    { rel: "r.mjs", text: String.raw`const FIELD_LINE = /^Rev:/u;` },
    { rel: "s.mjs", text: "const real = (p) => { try { return realpathSync(p); } catch { return p; } };" },
    /* Neither spelling is any of the three the finding removed: a third pair of parameter names with no space after the comma, and an even-length mean over an array a caller sorted. */
    { rel: "t.mjs", text: "const mid = (rows) => { const s = [...rows].sort((x,y) => x - y); return s[Math.floor(s.length/2)]; };" },
    { rel: "u.mjs", text: "const mid = (ranked, at) => (ranked[at - 1] + ranked[at]) / 2;" },
    { rel: "v.mjs", text: "const mid = (values) => { const middle = Math.floor(values.length / 2); const sorted = [...values].sort((left, right) => left - right); return sorted[middle]; };" },
    { rel: "w.mjs", text: 'if (!existsSync(p)) closeSync(openSync(p, "a", 0o600));\nappendFileSync(p, `${JSON.stringify(one)}\\n`);' },
    { rel: "x.mjs", text: String.raw`const UNCAPPED = /^docs\/issue-flow-dry-runs\.md$/u;` },
    { rel: "x2.mjs", text: 'const JOURNAL = "docs/issue-flow-dry-runs.md";' },
  ];
  assert.deepEqual(redeclared(copies), [
    `a.mjs declares an inline code span of its own; ${MARKDOWN} holds it`,
    `a2.mjs declares a non-empty inline code span of its own; ${MARKDOWN} holds it`,
    `a3.mjs declares a link target of its own; ${MARKDOWN} holds it`,
    `a4.mjs declares a link target of its own; ${MARKDOWN} holds it`,
    `b.mjs declares a table row of its own; ${MARKDOWN} holds it`,
    `c.mjs declares a table separator of its own; ${MARKDOWN} holds it`,
    `d.mjs declares a markup class of its own; ${MARKDOWN} holds it`,
    `e.mjs declares a shell word of its own; ${SHELL} holds it`,
    `f.mjs declares a shell word of its own; ${SHELL} holds it`,
    `h.mjs declares an SSE frame reader of its own; ${SSE} holds it`,
    `i.mjs declares an SSE frame reader of its own; ${SSE} holds it`,
    `j.mjs declares the untrusted-data fence of its own; ${TRANSPORT} holds it`,
    `m.mjs declares the help predicate of its own; ${HELP_WORD} holds it`,
    `n.mjs declares the help predicate of its own; ${HELP_WORD} holds it`,
    `o.mjs declares a line number from an index of its own; ${MARKDOWN} holds it`,
    `p.mjs declares a line number from an index of its own; ${MARKDOWN} holds it`,
    `q.mjs declares the tree's document grammar of its own; ${SPEC_PARSE} holds it`,
    `r.mjs declares the tree's document grammar of its own; ${SPEC_PARSE} holds it`,
    `s.mjs declares a path's canonical form of its own; ${CANONICAL} holds it`,
    `t.mjs declares a median over numbers of its own; ${MEDIAN} holds it`,
    `u.mjs declares a median over numbers of its own; ${MEDIAN} holds it`,
    `v.mjs declares a median over numbers of its own; ${MEDIAN} holds it`,
    `w.mjs declares an append-only JSONL store of its own; ${JSONL} holds it`,
    `x.mjs declares the journal's path of its own; ${DOC_SHAPE} holds it`,
    `x2.mjs declares the journal's path of its own; ${DOC_SHAPE} holds it`,
  ]);
});

/* Why the median row needs no exclusion list, held to the four real modules rather than to invented ones: the argument is beside the needle, and this is what turns red if the row loses it. */
test("a module that sorts numbers and takes no middle is not re-declaring the median", () => {
  const sorters = [
    "plugin/src/checks/retired-names.mjs",
    "plugin/src/flow/earned.mjs",
    "plugin/src/flow/record/record.mjs",
    "plugin/src/spec/rules.mjs",
  ].map(read);
  for (const { rel, text } of sorters) {
    assert.match(text, /\.sort\(\((\w+), (\w+)\) => \1 - \2\)/u, `${rel}: the comparator is there, so only the middle tells a copy apart`);
  }
  assert.deepEqual(redeclared(sorters), []);
});

/* The row carried one exclusion, for a verb that read the word in any position — held to be another question and so not a copy. It was this question, over two slots the predicate now names, and the third slot it also read made a `--note` of the word a help ask (ISS-305). So the row excludes nothing, and what stands in its place is that the codex verb is watched like every other module. */
test("the any-position reading was this one, and no module is excused from the row", () => {
  const own = 'const asked = [sub, ...rest].some((one) => one === "-h" || one === "--help");';
  const said = `declares the help predicate of its own; ${HELP_WORD} holds it`;
  assert.deepEqual(redeclared([{ rel: "plugin/src/codex/codex.mjs", text: own }]),
    [`plugin/src/codex/codex.mjs ${said}`], "the verb that carried the exclusion is now watched");
  assert.deepEqual(redeclared([{ rel: "o.mjs", text: own }]), [`o.mjs ${said}`],
    "and the same text anywhere else is still a copy");
  assert.ok(modules().map(({ rel }) => rel).includes("plugin/src/codex/codex.mjs"),
    "which is worth nothing if that module is out of the scan");
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
test("the fence needle is the source the transport holds, and catches a copy anchored any way", () => {
  assert.ok(FENCE_PATTERN.includes(FENCE_WORD), "the needle no longer occurs in the pattern it watches");
  const copies = [
    String.raw`const F = /^⟦(?:END_)?UNTRUSTED_DATA[^⟧]*⟧\s*$/gmu;`,
    String.raw`const F = new RegExp("⟦(?:END_)?UNTRUSTED_DATA[^⟧]*⟧", "u");`,
  ];
  for (const text of copies) {
    assert.deepEqual(redeclared([{ rel: "k.mjs", text }]),
      [`k.mjs declares the untrusted-data fence of its own; ${TRANSPORT} holds it`]);
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

/* An empty span is markup to remove and not a claim to read. Both forms are read off the home here, so neither can drift out from under this. */
test("the span pattern removes an empty span, which the non-empty form does not match", () => {
  assert.equal(withoutSpans("a `` b"), "a   b");
  assert.equal(new RegExp(CODE_SPAN_NONEMPTY_PATTERN, "u").test("a `` b"), false);
});

/* The other half of that character: on a double-backtick span the strip form takes the two empty pairs and hands the model the content bare, which is the failure protectInline exists to prevent. */
test("the masker takes the inner span of a double-backtick run, where the strip form takes the delimiters", () => {
  const slots = [];
  assert.equal(protectInline("say ``word`` twice", slots), "say `⟦VI0⟧` twice");
  assert.deepEqual(slots, ["`word`"]);
  assert.equal("say ``word`` twice".replace(new RegExp(CODE_SPAN_PATTERN, "gu"), "X"), "say XwordX twice",
    "the strip form leaves the content the model would reword");
});

/* The input that tells the two link targets apart: a title is valid Markdown the closed form reads nothing from, so a rewritten url under it would go unreported (ISS-138). */
test("a rewritten target inside a titled link is reported, where the closed form sees no target at all", () => {
  const [source, translated] = ['[label](url "title")', '[nhãn](other "tiêu đề")'];
  assert.equal(verify(source, translated), "link target changed");
  const closed = (text) => [...text.matchAll(new RegExp(LINK_TARGET_PATTERN, "gu"))].map((one) => one[1]);
  assert.deepEqual(closed(source), [], "the closed form is why this had to stay the opener's");
  assert.deepEqual(closed(translated), []);
  assert.equal(verify(source, '[nhãn](url "tiêu đề")'), null, "and translating the title alone still passes");
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
  rest: (text) =>
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
