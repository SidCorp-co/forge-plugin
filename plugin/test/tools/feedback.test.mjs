/* Every case is spawned from a checkout that is NOT this plugin's: where the note lands is the whole
   point, and a case run from here would pass either way. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const OPEN = "33333333-3333-4333-8333-333333333333";
const TITLE = "a refused record prints its usage instead of the flag values it takes";

/* The caller: another project, and one asking for Vietnamese prose, since the target's language is
   the target's and a note translated on the way out is not the note the run wrote. */
const elsewhere = tempRoom("feedback-caller-");
writeFileSync(join(elsewhere, ".forge.json"), JSON.stringify({ slug: "somewhere-else", translate: "vi" }));

const BODY = [
  "## What happened",
  "",
  "`forge record confirmation -h` answered with a refusal naming one flag instead of the usage.",
  "",
  "## Outcome",
  "",
  "Asking for help on a record kind prints what to type and the values each flag takes.",
  "",
  "## Rules",
  "",
  "A help request is answered before any argument is read against the shape it needs.",
  "",
  "## Out of scope",
  "",
  "The wording of the refusal itself, which is right when a flag really is missing.",
].join("\n");

const note = (body = BODY) => {
  const path = join(elsewhere, `note-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(path, `${body}\n`);
  return path;
};

const state = { issues: [], comments: {}, calls: [], status: 0 };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const send = async (argv, { issues = [], answer = undefined } = {}) => {
  state.issues = issues;
  state.calls = [];
  state.answer = answer;
  const run = await ranAsync(FORGE, argv, tracker.env, elsewhere);
  const of = (name, action) => state.calls.filter((one) => one.name === name && one.args.action === action);
  return { ...run, of, filed: of("forge_issues", "create")[0], said: of("forge_comments", "create")[0] };
};

test("a note filed from another project lands on this plugin's, as a bug", async () => {
  const run = await send(["feedback", note(), "--title", TITLE]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /forge_issues -> project forge-plugin \(from the CLI, for feedback on this plugin\)/u);
  assert.ok(run.filed, "nothing was filed");
  assert.equal(run.filed.args.data.category, "bug");
  assert.equal(run.filed.args.data.title, TITLE);
  assert.equal(run.filed.slug, "forge-plugin", "the filing went out under the caller's project header");
  assert.match(run.stdout, /No open issue on forge-plugin carries this title/u);
});

test("the Where section is written by the verb and names the copy, the version and the caller", async () => {
  const run = await send(["feedback", note(), "--title", TITLE]);
  const filed = run.filed.args.data.description;
  assert.match(filed, /^## Where$/mu);
  assert.match(filed, /^- forge \d+\.\d+\.\d+/mu);
  assert.match(filed, /^- the (?:checkout|installed|this) copy at \//mu);
  assert.match(filed, /^- met from project somewhere-else \(\.forge\.json\), prose vi$/mu);
  assert.match(filed, /^- agent .+, in /mu);
});

/* The caller asked for Vietnamese; the destination did not, and the destination decides. */
test("a note from a project with a prose language reaches this one as written", async () => {
  const run = await send(["feedback", note(), "--title", TITLE]);
  assert.match(run.stderr, /prose as written/u);
  assert.ok(run.filed.args.data.description.startsWith("## What happened"), run.filed.args.data.description);
});

test("a body missing a section the bug shape needs is refused, and nothing is written", async () => {
  const short = BODY.slice(0, BODY.indexOf("## Out of scope"));
  const run = await send(["feedback", note(short), "--title", TITLE]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /out-of-scope/u);
  assert.equal(run.filed, undefined, "a refused body reached the tracker");
});

/* `forge new` short-circuits on both of these, offering a route a note does not have; read against
   the shortcut, a note missing two of its four sections filed clean (F2). */
test("a body that would earn forge new a route offer is read against every section", async () => {
  const named = "`forge record` answered a help request with a refusal naming one missing flag.";
  const run = await send(["feedback", note(`## What happened\n\n${named}\n`), "--title", TITLE]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /rule/u);
  assert.match(run.stderr, /out-of-scope/u);
  assert.equal(run.filed, undefined, "a note with no rules and no out-of-scope was filed");
});

test("a body calling itself a fix is read against every section all the same", async () => {
  const run = await send(["feedback", note(`${BODY.slice(0, BODY.indexOf("## Rules"))}\nSize: fix.\n`), "--title", TITLE]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /rule/u);
  assert.equal(run.filed, undefined, "the mark exempted a note from its sections");
});

test("a title already open there takes the note as a comment, and files nothing", async () => {
  const held = { documentId: OPEN, issueId: "ISS-9", status: "open", title: `  ${TITLE.toUpperCase()} ` };
  const run = await send(["feedback", note(), "--title", TITLE], { issues: [held] });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.filed, undefined, "a second issue was filed under a title already open");
  assert.equal(run.said?.args.data.issue, OPEN);
  assert.match(run.stdout, /ISS-9 is open on forge-plugin under this title/u);
  assert.equal(run.of("forge_issues", "update").length, 0, "the verb wrote to the issue it commented on");
});

/* The run has already spent the turn writing the note, and a body from stdin is nowhere else. */
test("a credential the project refuses is told so, with the note echoed back", async () => {
  const run = await send(["feedback", note(), "--title", TITLE], {
    answer: {
      forge_issues: (args) =>
        (args.action === "create" ? { refused: "this credential may not write to forge-plugin" } : { issues: [], returned: 0 }),
    },
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /may not write to forge-plugin/u);
  assert.match(run.stderr, /Your note, so that nothing here loses it:/u);
  assert.match(run.stderr, /forge record confirmation -h/u, "the body was not echoed back");
});

/* A tool that says no is not the only refusal: an endpoint answering 401 exits before any tool
   result exists, and a note piped in has no file to read back from. */
test("a note piped in survives a refusal that never reached a tool", async () => {
  state.status = 401;
  try {
    const run = await ranAsync(FORGE, ["feedback", "-", "--title", TITLE], tracker.env, elsewhere, BODY);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Forge answered 401/u);
    assert.match(run.stderr, /Your note, so that nothing here loses it:/u);
    assert.match(run.stderr, /forge record confirmation -h/u, "the piped body was lost with the process");
  } finally {
    state.status = 0;
  }
});

test("a body the shape refuses is printed back too, having arrived on stdin", async () => {
  const short = BODY.slice(0, BODY.indexOf("## Out of scope"));
  const run = await ranAsync(FORGE, ["feedback", "-", "--title", TITLE], tracker.env, elsewhere, short);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /out-of-scope/u);
  assert.match(run.stderr, /Your note, so that nothing here loses it:/u);
});

test("the verb takes --title and refuses a flag that would aim it somewhere else", async () => {
  const run = await send(["feedback", note(), "--title", TITLE, "--kind", "feature"]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--kind names no flag of it/u);
  assert.equal(run.filed, undefined);
});

/* The gate record is the CALLER's project's, and this verb's project is not that one: a measurement
   from somebody else's checkout hiding it would hide the verb that exists to reach past it (F1). */
test("a forge_issues gate recorded in the caller's project does not withhold it", async () => {
  const path = join(tracker.env.XDG_CONFIG_HOME, "forge", "config.json");
  const held = readFileSync(path, "utf8");
  writeFileSync(path, JSON.stringify({
    ...JSON.parse(held),
    capabilities: { "somewhere-else": { checkedAt: "2026-09-04T00:00:00.000Z", forge_issues: "not for this token" } },
  }));
  try {
    const listed = await send(["-h"]);
    assert.match(listed.stdout, /^ {2}feedback /mu, "the verb left the help");
    const run = await send(["feedback", note(), "--title", TITLE]);
    assert.equal(run.status, 0, run.stderr);
    assert.ok(run.filed, "the verb was refused for a gate measured on another project");
  } finally {
    writeFileSync(path, held);
  }
});

test("its help says what to type and where the note goes", async () => {
  const run = await send(["feedback", "-h"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Usage: forge feedback <file\.md\|@file\|-> --title T$/mu);
  assert.match(run.stdout, /The destination is forge-plugin, fixed here/u);
  assert.match(run.stdout, /No lease is taken/u);
});
