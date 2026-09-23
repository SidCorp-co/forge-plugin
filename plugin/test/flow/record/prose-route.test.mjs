/* A prose flag handed `@file` published the path as the record, and a record is never edited or
   removed (ISS-820): a route to the text and a blank are both refused before anything is sent. */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

import { ranAsync, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("prose-route-");
const { SHAPES } = await import("../../../src/flow/machine.mjs");
const { NOTE_PROSE, proseChecked, proseHelp } = await import("../../../src/flow/record/prose-route.mjs");
const { Refused } = await import("../../../src/refusal.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const room = tempRoom("prose-route-files-");
const FILE = join(room, "finding.md");
writeFileSync(FILE, "the finding, two paragraphs long\n");

const issue = {
  documentId: "prose-uuid",
  issueId: "ISS-7",
  status: "in_progress",
  title: "a record written from a file",
  description: "x",
};
const project = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [issue],
  comments: { "prose-uuid": [] },
  answer: {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: project.issues, returned: 1, hasMore: false };
      if (args.action === "update") return Object.assign(issue, args.data);
      return issue;
    },
  },
};
const { tracker, env } = await trackerFor(project);
test.after(() => tracker.close());
for (const again of [1, 2]) assert.ok(again && await ranAsync(FORGE, ["claim", "ISS-7", "--unheld"], env));

const posts = () => project.calls.filter((one) => one.name === "forge_comments" && one.args.action === "create");
const write = async (argv) => {
  const before = posts().length;
  const run = await ranAsync(FORGE, ["record", ...argv], env);
  return { ...run, posted: posts().length - before };
};
const confirmation = (...extra) =>
  ["confirmation", "ISS-7", "--is", "what it is", "--where", "plugin/src/a.mjs", "--finding", "holds", ...extra];

test("--detail @file is refused before the write, naming the flag, the file and the call to run", async () => {
  const run = await write(confirmation("--detail", `@${FILE}`));
  assert.equal(run.status, 1, run.stdout);
  assert.equal(run.posted, 0, "no comment went up");
  assert.ok(run.stderr.includes(`--detail @${FILE} reads as the file \`${FILE}\`, and --detail takes the text`), run.stderr);
  assert.match(run.stderr, /would be published as --detail, and a record is never edited or removed/u);
  const call = run.stderr.split("\n").find((one) => one.startsWith("  forge record confirmation"));
  assert.ok(call, run.stderr);
  assert.ok(call.includes(`--detail "$(cat -- ${FILE})"`), call);
  assert.ok(call.includes("--finding holds") && !call.includes(`@${FILE}`), "the rest of the call as typed, the route replaced");
});

test("a bare `-` is refused as a route, and a value that is only a file's name goes up as written", async () => {
  const dash = await write(confirmation("--detail", "-"));
  assert.equal(dash.status, 1, dash.stdout);
  assert.equal(dash.posted, 0);
  assert.match(dash.stderr, /--detail - reads as stdin/u);
  /* A correction's --moved names the file a landing wrote, and `developed` reads that name back. */
  const named = await write(["correction", "ISS-7", "--moved", FILE, "--why", "the file that landed"]);
  assert.equal(named.status, 0, named.stderr);
  assert.equal(named.posted, 1);
  assert.ok(posts().at(-1).args.data.body.includes(`moved: ${FILE}`), "stored as the text it is");
});

test("a blank value is refused by the flag's name, the empty string as well as whitespace", async () => {
  for (const [value, said] of [["", "empty"], ["   ", "as whitespace alone"]]) {
    const run = await write(["park", "ISS-7", "--kind", "question", "--why", value]);
    assert.equal(run.status, 1, run.stdout);
    assert.equal(run.posted, 0);
    assert.match(run.stderr, new RegExp(`record park: --why arrived ${said}`, "u"), run.stderr);
  }
});

const proseRows = () => [
  ...Object.entries(SHAPES).flatMap(([kind, shape]) =>
    shape.fields.filter((one) => one.prose).map((field) => ({ kind, field }))),
  ...Object.values(NOTE_PROSE).map((field) => ({ kind: "note", field })),
];

const refusal = (kind, field, value) => {
  try {
    proseChecked(kind, field, value);
    return null;
  } catch (error) {
    if (error instanceof Refused) return error.message;
    throw error;
  }
};

test("every prose row meets every check, so a row declared later is covered with no second edit", async () => {
  const rows = proseRows();
  assert.ok(rows.length >= 20, `the walk reaches ${rows.length} rows, not the table`);
  for (const { kind, field } of rows) {
    for (const value of [`@${FILE}`, "-", "", "  "]) {
      assert.ok(refusal(kind, field, value), `record ${kind} --${field.flag} ${JSON.stringify(value)}`);
    }
    for (const value of ["a sentence of its own", FILE]) assert.equal(refusal(kind, field, value), null);
    const flag = `--${field.flag}`;
    const extra = kind === "note" && field.flag === "why" ? ["--skip"] : [];
    const run = await write([kind, "ISS-7", ...extra, flag, `@${FILE}`]);
    assert.equal(run.status, 1, `${kind} ${flag}: ${run.stdout}`);
    assert.equal(run.posted, 0);
    assert.ok(run.stderr.includes(`${flag} takes the text`),
      `record ${kind} ${flag} is wired to the check: ${run.stderr}`);
  }
});

test("a place field takes a path that exists, and two lines opening `@` go up as written", async () => {
  const placed = await write(["confirmation", "ISS-7", "--is", "what it is", "--where", FILE, "--finding", "holds"]);
  assert.equal(placed.status, 0, placed.stderr);
  assert.equal(placed.posted, 1);
  const detail = "@thanh read this first\nand then the second line";
  const lines = await write(confirmation("--detail", detail));
  assert.equal(lines.status, 0, lines.stderr);
  assert.match(posts().at(-1).args.data.body, /^detail: @thanh read this first\n {2}and then the second line$/mu);
});

test("a kind's own help names its prose flags and the form a file is passed in", async () => {
  assert.deepEqual(proseHelp("verification"), [], "a kind with no prose says nothing");
  const help = await ranAsync(FORGE, ["record", "confirmation", "-h"], env);
  assert.match(help.stdout, /^Text only on --is and --detail: pass a file as --detail "\$\(cat -- file\.md\)", never `@file`\.$/mu, help.stdout);
});
