/* A name an agent has to translate is a round, and the trai-heo run spent Phase 7 unable to judge
   eight criteria because the credential lived in a field no verb named (ISS-92). The vocabulary
   only stays the CLI's if nothing may print the tracker's. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { COLUMNS, printedAliases, printedColumns, quoted } from "../../src/checks/tracker-names.mjs";

const ROOT = new URL("../../..", import.meta.url).pathname;

const sources = () => {
  const out = [];
  const walk = (dir, at) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) {
        if (one.name !== "vendor") walk(join(dir, one.name), `${at}/${one.name}`);
      } else if (one.name.endsWith(".mjs")) {
        out.push({ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") });
      }
    }
  };
  walk(join(ROOT, "plugin", "src"), "plugin/src");
  walk(join(ROOT, "plugin", "hooks"), "plugin/hooks");
  return out;
};

test("no string this CLI holds prints the tracker's name for a column it reads", () => {
  const files = sources();
  assert.ok(files.length > 40, `${files.length} source(s) walked; the selector matches too little`);
  const found = files.flatMap(({ rel, text }) => printedColumns(text, rel));
  assert.deepEqual(found, [], `a developer would be shown a name only the tracker uses:\n${found.join("\n")}`);
});

test("the reader that fetches a column passes, and a string holding the same name does not", () => {
  const reads = "const { previewDeploy } = answer.project;\nconst held = config?.baseBranch ?? null;\n";
  assert.deepEqual(printedColumns(reads, "reader.mjs"), []);
  const prints = 'line(OK, "baseBranch", held);\nfail(`no previewDeploy on ${slug}`);\n';
  assert.deepEqual(printedColumns(prints, "printer.mjs"), [
    "printer.mjs:1 prints baseBranch",
    "printer.mjs:2 prints previewDeploy",
  ]);
  /* The complexity is spoken as the tracker spells it — this CLI has no second word for it — so a
     string holding that name is not this rule's (ISS-701, docs/cli/the-kinds.md). */
  assert.deepEqual(printedColumns("fail(`no complexity on ${slug}`);", "printer.mjs"), []);
});

/* The other half of the same rule: `docs/cli/the-kinds.md` decided that the tracker's `complexity`
   and the contract's `rung` each have one word, and three aliases outlived the decision for two
   releases because nothing checked it (ISS-822). */
test("no string this CLI holds says a third word for the complexity or the rung", () => {
  const files = sources();
  const found = files.flatMap(({ rel, text }) => printedAliases(text, rel));
  assert.deepEqual(found, [], `a reader would be handed a second word for one of the two:\n${found.join("\n")}`);
});

test("each alias is refused with the line and the noun meant, and each measurement passes", () => {
  const refused = [
    ["fail(`the band is unset`);", "band", "the tracker's complexity"],
    ["line(`nothing owed at any tier`);", "tier", "the contract's rung"],
    ["say(`untiered`);", "untiered", "the contract's rung"],
    ["say(`Size: fix -> feature`);", "Size: fix", "the contract's rung"],
    /* The retired mark was handed a value from either vocabulary, so the colon reads both; and a template's hole holds code, so a string inside one is a span of its own rather than the delimiter that ends the span around it, while a sentence a hole breaks is still read whole. */
    ["say(`Size: xs -> l`);", "Size: xs", "the tracker's complexity"],
    ["say(`Size: xl`);", "Size: xl", "the tracker's complexity"],
    ["say(`--size feature`);", "--size feature", "the tracker's complexity"],
    ["say(`a batch is fix-size throughout`);", "fix-size", "the contract's rung"],
    ["say(`outer ${`tier`}`);", "tier", "the contract's rung"],
    ["say(`nobody sized ${lead} on the ladder`);", "sized",
      "one of the two the same string already names"],
  ];
  for (const [source, word, meant] of refused) {
    assert.deepEqual(printedAliases(source, "printer.mjs"),
      [`printer.mjs:1 says \`${word}\`, where the word is ${meant}`], source);
  }
  assert.deepEqual(printedAliases("say(`nobody sized this lead, so the ladder runs it as a feature`);", "printer.mjs"),
    ["printer.mjs:1 says `sized`, where the word is one of the two the same string already names"],
    "and the word itself where the same string names what it would be a second word for");
  /* Three measurements this CLI is right to make, one of them `forge doctor`'s own line. */
  for (const passing of [
    "say(`size: 4096 bytes`);",
    "line(OK, `claude.md size`, held);",
    "say(`${items.size} held`);",
    "say(`  --size n           runs per window; fifty unless you say otherwise`);",
    "fail(`stats eval: --size takes an integer of 1 or more`);",
    "say(`the complexity is `s``);",
    "say(`Lane at `fix` — every status from where it stands`);",
  ]) {
    assert.deepEqual(printedAliases(passing, "printer.mjs"), [], passing);
  }
});

/* A retired spelling has to live somewhere or a record written before the rename reads as nothing;
   a path or file exemption is where a rule like this goes to die, so the boundary is the one
   declaration shape and the rest of that line is judged as any other. */
test("an alias stands as a retired declaration's own value, and nowhere else on that line", () => {
  for (const held of ['const RETIRED_STAMP = "tier";', 'export const RETIRED_TABLE = "band";',
    'const RETIRED_MARK = "size: fix";']) {
    assert.deepEqual(printedAliases(held, "reader.mjs"), [], held);
  }
  assert.deepEqual(printedAliases('const RETIRED_STAMP = "tier"; say(`tier`);', "reader.mjs"),
    ["reader.mjs:1 says `tier`, where the word is the contract's rung"],
    "a second string on the line is refused, so the boundary is the value and not the line");
  assert.equal(printedAliases('const HELD = "tier";', "reader.mjs").length, 1,
    "and a name that does not say the spelling is retired earns no boundary at all");
});

test("a comment may name the column it fetches, which is the carve-out the rule keeps", () => {
  const said = `/* the tracker's field alone calls it ${COLUMNS[0].source} */\n// and ${COLUMNS[1].source} too\n`;
  assert.deepEqual(printedColumns(said, "commented.mjs"), []);
  assert.deepEqual(quoted(said), [], "a comment holds no span at all");
});

/* One regex the scanner walks into leaves every later span in that file out by a literal, so a comment's words arrive as string content and satisfy a row together with a string thirty lines above. Watched on the shape this tree holds — `contract.mjs`'s own `SPAN` (ISS-1110). */
test("a delimiter inside a regex literal ends nothing, and division still divides", () => {
  const held = 'const SPAN = /`([^`]+)`/gu;\nconst a = "its size in characters";\n/* the ladder */\nconst b = "plain";\n';
  assert.deepEqual(quoted(held).map((one) => one.held), ["its size in characters", "plain"],
    "a backtick inside the class opened a span, so the comment below it was read as string content");
  assert.deepEqual(printedAliases(held, "reader.mjs"), [],
    "and the two halves of a row's rule were satisfied by one pseudo-span across a comment");
  assert.deepEqual(quoted("const half = total / 2;\nconst s = \"kept\";\n").map((one) => one.held),
    ["kept"], "a slash after a value divides, and reading it as a literal would swallow the rest");
  assert.deepEqual(quoted('const q = /["\']/u;\nconst s = "kept";\n').map((one) => one.held),
    ["kept"], "and a quote inside a regex is no delimiter either");
  assert.deepEqual(quoted('const p = /[/]\\//u;\nconst s = "kept";\n').map((one) => one.held),
    ["kept"], "a slash inside a class, and an escaped one, end the literal nowhere");
});
