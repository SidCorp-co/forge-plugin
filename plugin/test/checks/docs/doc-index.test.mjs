/* Sixty-seven thousand characters in one file, and every run pointed at it whole: the index is what
   every run reads and a topic is what one run reads once. Nothing held a document to a size before
   this, and the split would have moved the same text out of the gates with nothing failing. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  INDEX, LEAD_MAX, ROW_MAX, TOPIC_MAX, docsCited, indexProblems, overCap,
} from "../../../src/checks/doc-index.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;
const chars = (rel) => readFileSync(join(ROOT, rel), "utf8").length;

const tracked = (pattern) =>
  execFileSync("git", ["-C", ROOT, "ls-files", pattern], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);

const topics = () => readdirSync(join(ROOT, "docs", "cli")).filter((one) => one.endsWith(".md"));

test("the CLI document is an index: one paragraph, and one row per topic that resolves", () => {
  const held = topics();
  assert.ok(held.length >= 10, `${held.length} topic file(s) under docs/cli/; the selector found none`);
  const said = indexProblems({
    text: readFileSync(join(ROOT, INDEX), "utf8"),
    topics: held.map((one) => `cli/${one}`),
    path: INDEX,
  });
  assert.deepEqual(said, [], said.join("\n"));
});

test("no document under docs/ is longer than one pass", () => {
  const docs = tracked("docs/**/*.md").concat(tracked("docs/*.md"));
  assert.ok(docs.length >= 20, `${docs.length} document(s) tracked under docs/`);
  const said = overCap(docs.map((rel) => ({ rel, chars: chars(rel) })));
  assert.deepEqual(said, [], said.join("\n"));
});

/* The measurement the cap was chosen against: the one document this repository keeps whole. */
test("docs/HOOKS.md is one file and the cap is the reason it may stay one", () => {
  const size = chars(join("docs", "HOOKS.md"));
  assert.ok(size <= TOPIC_MAX, `docs/HOOKS.md is ${size} characters, over ${TOPIC_MAX}: split it`);
});

/* Both boundaries are spelled out here rather than read off the module: a case taking its
   expectation from the constant it is checking passes at whatever that constant becomes. */
const ROW_OPEN = "| [one more](cli/one-more.md) | ";
const LEAD_OPEN = "# A title\n\n";
const rowOf = (size) => `${ROW_OPEN}${"a".repeat(size - ROW_OPEN.length - 2)} |`;
const leadOf = (size) => `${LEAD_OPEN}${"a".repeat(size - LEAD_OPEN.length)}`;

/* The wall three runs met: a topic cannot be added to a tree whose index has no room for its row,
   while the remedy `overCap` prints for an oversized topic is that exact move (ISS-665). */
test("an index is budgeted per row and per opening paragraph, and a topic added to a full index is green", () => {
  assert.deepEqual([ROW_MAX, LEAD_MAX], [300, 800], "the two numbers the cases below are written to");
  assert.deepEqual([rowOf(300).length, leadOf(800).length], [300, 800]);
  const text = readFileSync(join(ROOT, INDEX), "utf8");
  const held = [...topics().map((one) => `cli/${one}`), "cli/one-more.md"];
  const grown = `${text.trimEnd()}\n${rowOf(300)}\n`;
  assert.ok(grown.length > TOPIC_MAX, `the grown index is ${grown.length} characters, under the cap`);
  const said = indexProblems({ text: grown, topics: held, path: INDEX });
  assert.deepEqual(said, [], said.join("\n"));
  assert.deepEqual(overCap([{ rel: INDEX, chars: grown.length }]), []);
  assert.equal(overCap([{ rel: "docs/cli/one-more.md", chars: TOPIC_MAX + 1 }]).length, 1);
  const over = indexProblems({ text: `${text.trimEnd()}\n${rowOf(301)}\n`, topics: held, path: INDEX });
  assert.deepEqual(over, [`${INDEX} gives cli/one-more.md a row of 301 characters, over the 300 one`
    + " row is read in — tighten that row and no other. A row is the whole of an index's budget, so"
    + " the room the next topic has is this number whatever the rows already here come to"]);
  const rows = "| Topic | The decision it holds |\n|---|---|\n| [`new`](cli/new.md) | what it reads |";
  const one = ["cli/new.md"];
  assert.deepEqual(indexProblems({ text: `${leadOf(800)}\n\n${rows}`, topics: one }), []);
  assert.deepEqual(indexProblems({ text: `${leadOf(801)}\n\n${rows}`, topics: one }), [
    "the index takes 801 characters before its table, over the 800 an index's own heading and"
      + " paragraph are read in — cut them back to what the tree is for. Splitting the index and"
      + " shortening a row both buy nothing here: every other budget is one row's, and the file"
      + " itself is held to no length at all",
  ]);
});

const sources = () => {
  const out = [];
  const walk = (dir) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) {
        if (one.name !== "vendor") walk(join(dir, one.name));
      } else if (one.name.endsWith(".mjs")) {
        out.push({ rel: join(dir, one.name).slice(ROOT.length), text: readFileSync(join(dir, one.name), "utf8") });
      }
    }
  };
  walk(join(ROOT, "plugin", "src"));
  walk(join(ROOT, "plugin", "hooks"));
  return out;
};

test("every document a source file cites is one that is there", () => {
  let cited = 0;
  for (const { rel, text } of sources()) {
    const named = docsCited(text);
    cited += named.length;
    const gone = named.filter((one) => !existsSync(join(ROOT, one)));
    assert.deepEqual(gone, [], `${rel} cites ${gone.join(", ")}`);
  }
  assert.ok(cited > 20, `${cited} document citation(s) in the source: the pattern found nothing`);
});

/* One trailing space on the separator refused a correct index and named a missing header, which is
   a refusal nobody can act on: the character is invisible (ISS-101). The strict form it replaced is
   compiled here, because a widening this file did not watch is one that could drift back. */
test("a separator carrying invisible whitespace is a separator, where the strict form refused it", () => {
  const rows = "| Topic | The decision it holds |\n|---|---| \n| [`new`](cli/new.md) | what it reads |";
  const text = `# A title\n\nWhat it is for.\n\n${rows}`;
  assert.deepEqual(indexProblems({ text, topics: ["cli/new.md"] }), []);
  const strict = /^\|[\s|:-]+\|$/u;
  assert.equal(strict.test("|---| "), false, "the form replaced read that row as no separator at all");
  assert.equal(strict.test("|---|"), true, "and read the same row without the space as one");
});

/* Four shapes, each of which the split could have shipped and nothing would have failed. */
test("a second paragraph, a dead row, an unindexed topic and an oversized file each fail", () => {
  const rows = "| Topic | The decision it holds |\n|---|---|\n| [`new`](cli/new.md) | what it reads |";
  const one = ["cli/new.md"];
  assert.deepEqual(indexProblems({ text: `# A title\n\nWhat it is for.\n\n${rows}`, topics: one }), []);
  assert.deepEqual(
    indexProblems({ text: `# A title\n\nWhat it is for.\n\nAnd more.\n\n${rows}`, topics: one }),
    ["the index is heading, prose, prose, table and an index is a heading, one paragraph saying what"
      + " the tree is for, and one table"],
  );
  /* The table before the paragraph, and the header taken on trust: each reads as an index and is not. */
  assert.deepEqual(
    indexProblems({ text: `# A title\n\n${rows}\n\nWhat it is for.`, topics: one }),
    ["the index is heading, table, prose and an index is a heading, one paragraph saying what the"
      + " tree is for, and one table"],
  );
  const headless = "the index opens its table with no two-column header and separator, so its first row"
    + " goes unread — the words of the header are yours, a link in it is a topic mistaken for one";
  assert.deepEqual(
    indexProblems({ text: "# A title\n\nWhat it is for.\n\n| [`new`](cli/new.md) | what it reads |", topics: one }),
    [headless, "cli/new.md is named by 0 row(s) of the index and wants exactly one"],
  );
  /* A topic row taken for the header: the row is real, the topic it names goes unread. */
  assert.deepEqual(
    indexProblems({ text: `# A title\n\nWhat it is for.\n\n| [\`new\`](cli/new.md) | what it reads |\n|---|---|`, topics: one }),
    [headless, "cli/new.md is named by 0 row(s) of the index and wants exactly one"],
  );
  assert.deepEqual(
    indexProblems({ text: `# A title\n\nWhat it is for.\n\n${rows}\n| [\`spec\`](cli/spec.md) |`, topics: one }),
    ["a row of the index is not a topic and a sentence: | [`spec`](cli/spec.md) |"],
  );
  assert.deepEqual(
    indexProblems({ text: `# A title\n\nWhat it is for.\n\n${rows}`, topics: ["cli/renamed.md"] }),
    ["the index links cli/new.md, which is not there",
      "cli/renamed.md is named by 0 row(s) of the index and wants exactly one"],
  );
  assert.deepEqual(
    indexProblems({ text: `# A title\n\nWhat it is for.\n\n${rows}`, topics: [...one, "cli/orphan.md"] }),
    ["cli/orphan.md is named by 0 row(s) of the index and wants exactly one"],
  );
  assert.deepEqual(overCap([{ rel: "docs/cli/big.md", chars: TOPIC_MAX + 1 }], TOPIC_MAX), [
    `docs/cli/big.md is ${TOPIC_MAX + 1} characters, over the ${TOPIC_MAX} a topic is read in one`
      + " pass — split it and give each half its own index row. The cap is the round number above"
      + " docs/HOOKS.md, the one document this repository keeps whole",
  ]);
  /* The two exemptions and the near misses either side of them: an exemption proved only by the
     path it was written for is one a widened pattern takes silently. */
  assert.deepEqual(overCap([
    { rel: "docs/requirements/README.md", chars: TOPIC_MAX * 2 },
    { rel: "docs/issue-flow-dry-runs.md", chars: TOPIC_MAX * 8 },
  ]), []);
  assert.equal(overCap([{ rel: "docs/requirements-old/topic.md", chars: TOPIC_MAX * 2 }]).length, 1);
  assert.equal(overCap([{ rel: "docs/issue-flow-copy.md", chars: TOPIC_MAX * 2 }]).length, 1);
  assert.deepEqual(docsCited("/* one home: docs/cli/new.md, docs/cli/new.md and docs/HOOKS.md */"),
    ["docs/HOOKS.md", "docs/cli/new.md"]);
  /* The example a note prints is quoted, and a quoted path is nobody's claim that the file exists. */
  assert.deepEqual(docsCited("/* `port-plan.md` for `docs/port-plan.md` is worth one line */"), []);
});
