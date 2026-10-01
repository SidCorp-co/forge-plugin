/* What a refusal prints of what a call kept, and when a kept body stops being owed. A body kept so
   nothing loses it prints ahead of the refusal, so the call still ends on the reason (ISS-2092); one
   whose write landed is dropped by its own caller, so a later failure prints neither it nor a
   `null` line (ISS-3032). Each case runs in a child, since `fail` ends the process it runs in. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, neutralRoom, projectRecord, ranAsync, tempHome } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";
import { keepOnFailure } from "../../../src/refusal.mjs";

const REFUSAL = new URL("../../../src/refusal.mjs", import.meta.url).href;
const SAY = new URL("../../../src/tracker/filing/say.mjs", import.meta.url).href;

const OPEN = { issueId: "ISS-45", documentId: "uuid-45", status: "open", title: "the attach verb refuses a name already on the issue" };
const state = { issues: [OPEN], comments: {}, calls: [], memory: {} };
const tracker = await fakeTracker(state);
const ENV = { ...tracker.env, HOME: tracker.env.XDG_CONFIG_HOME };
projectRecord(neutralRoom(), tracker.env.XDG_CONFIG_HOME, OWN);
test.after(() => tracker.close());

const room = tempHome("kept").path;

const script = async (name, source, stdin = null) => {
  const path = join(room, `${name}.mjs`);
  writeFileSync(path, source);
  return ranAsync(process.execPath, [path], ENV, neutralRoom(), stdin);
};

const lines = (text) => text.split("\n").filter((one) => one.trim() !== "");

test("a body kept ahead prints before the refusal, and a line answering for it prints after, in order", async () => {
  const run = await script("order", `
    import { fail, keepOnFailure } from ${JSON.stringify(REFUSAL)};
    keepOnFailure("first answering line");
    keepOnFailure("Your note, so that nothing here loses it:\\n\\nTHE BODY", { ahead: true });
    keepOnFailure("second answering line");
    fail("the call was refused: THE REASON");
  `);
  assert.equal(run.status, 1);
  assert.deepEqual(lines(run.stderr), [
    "Your note, so that nothing here loses it:",
    "THE BODY",
    "the call was refused: THE REASON",
    "first answering line",
    "second answering line",
  ]);
});

test("a null text is refused at the call, and nothing is kept for it", async () => {
  assert.throws(() => keepOnFailure(null), /function its own registration returned/u);
  const run = await script("null", `
    import { fail, keepOnFailure } from ${JSON.stringify(REFUSAL)};
    const drop = keepOnFailure("Your body, so that nothing here loses it:\\n\\nTHE BODY", { ahead: true });
    try { keepOnFailure(null); } catch { /* refused, as asked */ }
    drop();
    fail("a later step failed");
  `);
  assert.equal(run.status, 1);
  assert.deepEqual(lines(run.stderr), ["a later step failed"]);
});

const BODY = [
  "## What happened",
  "",
  "`forge attach issue ISS-45 ./gate.txt` puts a second document of that name beside the first.",
  "",
  "## Why it happens",
  "",
  "`plugin/src/commands.mjs` uploads under the name it was handed, reading nothing already there.",
  "",
  "## Where",
  "",
  "`plugin/src/commands.mjs`, the attach verb.",
  "",
  "## Outcome",
  "",
  "One name on one issue names one document, whichever verb put it there.",
  "",
  "## Rules",
  "",
  "- A name already on the issue is refused rather than attached twice.",
  "",
  "## Out of scope",
  "",
  "The names already doubled.",
].join("\n");

/* The step after the write is the reply's first line on stdout, the answer's echo, which both routes
   print once the write has landed: failing there is a later step failing on a write that stands. */
const filing = (extra) => script(`filing-${Math.random().toString(36).slice(2)}`, `
  import { fail, keepOnFailure } from ${JSON.stringify(REFUSAL)};
  import { fileAndSay } from ${JSON.stringify(SAY)};
  const log = console.log;
  console.log = (line) => {
    if (String(line).startsWith("{")) fail("a later step failed");
    log(line);
  };
  keepOnFailure("a line another part of the call kept");
  const dropKept = keepOnFailure("Your body, so that nothing here loses it:\\n\\nKEPT-BODY-MARK");
  await fileAndSay({ title: "one name on an issue resolves to one document", body: ${JSON.stringify(BODY)},
    kind: "bug", ...${JSON.stringify(extra)} }, { dropKept });
`);

const created = () => state.calls.find((one) => one.name === "forge_issues" && one.args.action === "create");
const commented = () => state.calls.find((one) => one.name === "forge_comments" && one.args.action === "create");

test("a filing whose create landed and whose next step fails prints neither its body nor a null", async () => {
  state.calls = [];
  state.memory = {};
  const run = await filing({ fresh: true });
  assert.ok(created(), `nothing was filed, so nothing here is past a landed write: ${run.stderr}`);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /a later step failed/u);
  assert.doesNotMatch(run.stderr, /KEPT-BODY-MARK/u, "the body of a filing that landed was printed back");
  assert.doesNotMatch(run.stderr, /^null$/mu);
  assert.match(run.stderr, /a line another part of the call kept/u, "a line its caller never dropped went too");
});

test("a filing that folded as a comment and whose next step fails prints neither its body nor a null", async () => {
  state.calls = [];
  state.memory = { semantic: [[OPEN.issueId, 0.83]], keyword: [[OPEN.issueId, 0.0608]] };
  try {
    const run = await filing({ complexity: "s" });
    assert.equal(created(), undefined, "the filing did not fold");
    assert.ok(commented(), `no comment landed, so nothing here is past a landed write: ${run.stderr}`);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /a later step failed/u);
    assert.doesNotMatch(run.stderr, /KEPT-BODY-MARK/u, "the body of a fold that landed was printed back");
    assert.doesNotMatch(run.stderr, /^null$/mu);
  } finally {
    state.memory = {};
  }
});
