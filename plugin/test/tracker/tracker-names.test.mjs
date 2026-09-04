/* A name an agent has to translate is a round, and the trai-heo run spent Phase 7 unable to judge
   eight criteria because the credential lived in a field no verb named (ISS-92). The vocabulary
   only stays the CLI's if nothing may print the tracker's. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { COLUMNS, printedColumns, quoted } from "../../src/checks/tracker-names.mjs";

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
});

test("a comment may name the column it fetches, which is the carve-out the rule keeps", () => {
  const said = `/* the tracker's field alone calls it ${COLUMNS[0].source} */\n// and ${COLUMNS[1].source} too\n`;
  assert.deepEqual(printedColumns(said, "commented.mjs"), []);
  assert.deepEqual(quoted(said), [], "a comment holds no span at all");
});
