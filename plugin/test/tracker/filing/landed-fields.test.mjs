/* The read-back of a filing, held against the create it read back: what the row stores in place of
   what was sent is said on the last line, beside the id, and nothing of it refuses the filing. The
   ladder of what the read itself answered is `landed.test.mjs`'s. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, neutralRoom, projectRecord, ranAsync, tempHome } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const state = { issues: [], comments: {}, calls: [], memory: {}, answer: {} };
const tracker = await fakeTracker(state);

const ENV = { ...tracker.env, HOME: tracker.env.XDG_CONFIG_HOME };
projectRecord(neutralRoom(), tracker.env.XDG_CONFIG_HOME, OWN);
test.after(() => tracker.close());

/* Set before the module loads: `settings()` resolves the endpoint out of this directory once. */
process.env.XDG_CONFIG_HOME = tracker.env.XDG_CONFIG_HOME;
const { issueLanded } = await import("../../../src/tracker/filing/landed.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const room = tempHome("landed-fields").path;

const before = () => {
  state.issues = [];
  state.comments = {};
  state.calls = [];
  state.memory = {};
  state.answer = {};
  state.unasked = [];
};

const lastOf = (text) => text.trimEnd().split("\n").at(-1);

// ---------------------------------------------------------------- one field at a time

/* The create as `fileIssue` sends it, and the row a tracker holding it verbatim would answer with. */
const SENT = { title: "a filing names what the tracker stored", description: "## Outcome\n\nSaid.\n",
  status: "open", priority: "high", category: "bug", complexity: "s" };
const storedAs = (changes = {}) => ({ documentId: "uuid-820", issueId: "ISS-820", labels: [],
  relations: { blocks: [], blockedBy: [], relates: [] }, ...SENT, ...changes });
const heldBack = (row) => {
  state.answer = { forge_issues: () => row };
};

test("a row holding every field as sent ends on the line a filing always ended on", async () => {
  before();
  heldBack(storedAs());
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent: SENT });
  assert.equal(landed.line, "ISS-820 is filed at uuid-820, read back from the tracker.");
  assert.equal(landed.rank, "held");
});

/* The intake gate of forge-core's create service: a would-be open create stored at draft, with the
   `intake` label attached before the create answers. */
test("an open filing the intake gate stored at draft names both statuses, the gate and the way out", async () => {
  before();
  heldBack(storedAs({ status: "draft", labels: [{ id: "l-1", name: "intake", isPrimary: false }] }));
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent: SENT });
  assert.match(landed.line, /^ISS-820 is filed at uuid-820, read back from the tracker, and it stores status draft where this filing asked for open/u);
  assert.match(landed.line, /the project's intake gate/u);
  assert.match(landed.line, /`forge advance ISS-820 --set open --why <w>`/u);
  assert.doesNotMatch(landed.line, /Do not send this call again/u, "the row was read, so nothing is owed a resend warning");
  assert.equal(landed.line.split("\n").length, 1, "one line, so the id stays on the last one");
});

test("a status stored otherwise with no intake label is named without the gate named as its cause", async () => {
  before();
  heldBack(storedAs({ status: "draft" }));
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent: SENT });
  assert.match(landed.line, /status draft where this filing asked for open/u);
  assert.doesNotMatch(landed.line, /intake gate/u);
});

test("an intake label on a row stored at a status other than draft names no gate either", async () => {
  before();
  heldBack(storedAs({ status: "closed", labels: [{ id: "l-1", name: "intake" }] }));
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent: SENT });
  assert.match(landed.line, /status closed where this filing asked for open/u);
  assert.doesNotMatch(landed.line, /intake gate/u);
});

test("an asked status other than open names no gate, whatever the row carries", async () => {
  before();
  heldBack(storedAs({ status: "draft", labels: [{ id: "l-1", name: "intake" }] }));
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent: { ...SENT, status: "on_hold" } });
  assert.match(landed.line, /status draft where this filing asked for on_hold/u);
  assert.doesNotMatch(landed.line, /intake gate/u);
});

test("each scalar field stored otherwise is named with the value stored and the value asked", async () => {
  before();
  heldBack(storedAs({ priority: "medium", category: "feature", complexity: "m", title: "another title" }));
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent: SENT });
  assert.match(landed.line, /priority medium where this filing asked for high/u);
  assert.match(landed.line, /category feature where this filing asked for bug/u);
  assert.match(landed.line, /complexity m where this filing asked for s/u);
  assert.match(landed.line, /title "another title" where this filing asked for "a filing names what the tracker stored"/u);
  assert.deepEqual({ rank: landed.rank, stored: landed.stored }, { rank: "moved", stored: "medium" });
});

test("a field a flag carried is compared like the ones the route decides", async () => {
  before();
  heldBack(storedAs({ severity: "minor" }));
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent: { ...SENT, severity: "major" } });
  assert.match(landed.line, /severity minor where this filing asked for major/u);
});

test("a description the tracker rewrote is said as rewritten, and neither body comes back", async () => {
  before();
  heldBack(storedAs({ description: "## Outcome\n\nSaid, sanitised.\n" }));
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent: SENT });
  assert.match(landed.line, /the description as the tracker rewrote it on the way in/u);
  assert.doesNotMatch(landed.line, /sanitised|Said\./u, "no body is printed");
});

test("a description differing only in trailing whitespace is the one sent", async () => {
  before();
  heldBack(storedAs({ description: "## Outcome\n\nSaid." }));
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent: SENT });
  assert.equal(landed.line, "ISS-820 is filed at uuid-820, read back from the tracker.");
});

test("a relation sent and not stored is named, and an edge the row holds beyond it is not", async () => {
  before();
  const other = { edgeId: "e-2", kind: "relates", fromIssueId: "uuid-820", toIssueId: "uuid-77", otherDisplayId: "ISS-77" };
  heldBack(storedAs({ relations: { blocks: [], blockedBy: [], relates: [other] } }));
  const sent = { ...SENT, relations: [{ kind: "relates", blocksId: "uuid-45" }] };
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent });
  assert.match(landed.line, /no relates edge to uuid-45/u);
  assert.doesNotMatch(landed.line, /uuid-77|ISS-77/u);
  const held = { ...SENT, relations: [{ kind: "relates", blocksId: "uuid-77" }] };
  assert.equal((await issueLanded({ documentId: "uuid-820" }, { sent: held })).line,
    "ISS-820 is filed at uuid-820, read back from the tracker.");
});

test("a label the tracker added beside the module sent is no difference", async () => {
  before();
  const module = { id: "m-1", name: "tracker" };
  heldBack(storedAs({ labels: [{ id: "m-1", name: "tracker", isPrimary: true }, { id: "l-1", name: "intake" }] }));
  const sent = { ...SENT, labels: [{ labelId: "m-1", isPrimary: true }] };
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent, module });
  assert.equal(landed.line, "ISS-820 is filed at uuid-820 under tracker, its primary module, read back from the tracker.");
});

test("a module the row does not carry is still said, with what else it stores otherwise", async () => {
  before();
  heldBack(storedAs({ status: "draft" }));
  const landed = await issueLanded({ documentId: "uuid-820" },
    { sent: { ...SENT, labels: [{ labelId: "m-1", isPrimary: true }] }, module: { id: "m-1", name: "tracker" } });
  assert.match(landed.line, /does not carry tracker as its primary module, so that half of the filing is unverified, and it stores status draft where this filing asked for open/u);
});

test("a field sent that the row does not carry is named as not read back, never as matching", async () => {
  before();
  const row = storedAs();
  delete row.complexity;
  delete row.priority;
  heldBack(row);
  const landed = await issueLanded({ documentId: "uuid-820" }, { sent: SENT });
  assert.match(landed.line, /, and the read-back carries no priority, complexity to compare with what was sent\.$/u);
  assert.equal(landed.rank, "unread");
});

// ----------------------------------------------------------------------- end to end

const BODY = [
  "## What happened",
  "",
  "A filing the tracker stored at another status was reported as landed as asked.",
  "",
  "## Why it happens",
  "",
  "The reply read the row back and compared nothing of it with the create.",
  "",
  "## Where",
  "",
  "`plugin/src/tracker/filing/landed.mjs`",
  "",
  "## Outcome",
  "",
  "The reply names each field the tracker stored otherwise.",
  "",
  "## Rules",
  "",
  "- The read-back compares every field the create sent.",
  "",
  "## Out of scope",
  "",
  "The tracker's own intake policy.",
].join("\n");

const TITLE = "the read-back of a filing names what the tracker stored otherwise";

const bodyFile = () => {
  const path = join(room, "body.md");
  writeFileSync(path, `${BODY}\n`);
  return path;
};

/* A tracker that stores the create, with `rewrite` applied to what it was sent first. */
const stores = (rewrite) => {
  state.answer = {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "create") {
        const row = { ...args.data, ...rewrite(args.data), documentId: "uuid-810", issueId: "ISS-810" };
        state.issues = [...state.issues, row];
        return row;
      }
      return state.issues.find((one) => one.documentId === args.documentId) ?? {};
    },
  };
};

test("forge new --status open on a project whose intake gate stores it at draft says so, and exits 0", async () => {
  before();
  stores(() => ({ status: "draft", labels: [{ id: "l-1", name: "intake" }] }));
  const run = await ranAsync(FORGE,
    ["new", bodyFile(), "--title", TITLE, "--category", "bug", "--status", "open", "--priority", "high", "--complexity", "s"], ENV);
  assert.equal(run.status, 0, run.stderr);
  assert.match(lastOf(run.stdout), /^ISS-810 is filed at uuid-810, read back from the tracker, and it stores status draft where this filing asked for open, which is the project's intake gate/u);
  assert.match(run.stdout, /^ISS-810 is filed, priority high, as given\.$/mu, "the rank was stored as typed, so the line may say so");
});

test("a rank the tracker stored otherwise is never said as given", async () => {
  before();
  stores(() => ({ priority: "medium" }));
  const run = await ranAsync(FORGE,
    ["new", bodyFile(), "--title", TITLE, "--category", "bug", "--priority", "high", "--complexity", "s"], ENV);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /as given/u);
  assert.match(run.stdout, /^ISS-810 is filed, priority medium, where high was asked\.$/mu);
  assert.match(lastOf(run.stdout), /priority medium where this filing asked for high/u);
});
