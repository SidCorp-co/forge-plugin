/* The row `forge doctor` prints for R-11's escapes, spawned rather than called: what is under test is
   that the report reaches the terminal and that a fault in it is a non-zero exit, neither of which a
   direct call to the row builder can show (codex F2). The tree it judges is this checkout's own, so
   the expectations below are derived from it rather than written out. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, projectRecord, ranAsync } from "../../fixtures.mjs";

const { escapesIn } = await import("../../../src/spec/claims/proof.mjs");
const { specTreeRead } = await import("../../../src/spec/tree.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;

const ESCAPES = escapesIn(specTreeRead().documents);
const KEYS = [...new Set(ESCAPES.map((one) => one.key))];
const MOST = [...ESCAPES.reduce((held, one) =>
  held.set(one.file, (held.get(one.file) ?? 0) + 1), new Map())]
  .sort((one, two) => two[1] - one[1])[0];

const row = (rows) => ({ issues: rows, returned: rows.length, hasMore: false });
const asIssues = (status) => KEYS.map((key, at) => ({
  documentId: `0000000${at}-2222-4222-8222-222222222222`, issueId: key, status, title: key,
}));

const state = {
  issues: [],
  comments: {},
  answer: {
    forge_issues: (args) => (args.action === "list"
      ? (state.refuses ? { refused: state.refuses } : row(state.rows))
      : { documentId: args.documentId, ...(args.data ?? {}) }),
    forge_config: () => ({ config: { baseBranch: "master" } }),
    forge_project_pm: () => ({}),
  },
  refuses: null,
  rows: [],
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());
projectRecord(ROOT, tracker.env.XDG_CONFIG_HOME, { slug: "forge-plugin" });
const doctor = () => ranAsync(FORGE, ["doctor", "repo"], tracker.env, ROOT);

test("forge doctor names the escapes it read, the ones no longer owed and the document carrying most of those", async () => {
  state.refuses = null;
  state.rows = asIssues("closed");
  const run = await doctor();
  assert.match(run.stdout, new RegExp(`^\\[ miss \\] proof escapes\\s+${ESCAPES.length} of `
    + `${ESCAPES.length} escape\\(s\\) under docs/requirements/ are owed to an issue that no `
    + "longer owes the case", "mu"), run.stdout);
  assert.ok(run.stdout.includes(`Most of them are in ${MOST[0]} (${MOST[1]})`),
    `the worst document off this tree, not the first one read: ${run.stdout}`);
});

test("one escape no longer owed makes the reading exit non-zero", async () => {
  state.refuses = null;
  state.rows = [...asIssues("open").slice(1), { ...asIssues("closed")[0] }];
  const run = await doctor();
  assert.equal(run.status, 1, `one stale escape is a fault, not a note: ${run.stdout}`);
  assert.match(run.stdout, /^\[ miss \] proof escapes\s+1 of \d+ escape\(s\)/mu, run.stdout);
  state.rows = asIssues("open");
  const clean = await doctor();
  assert.equal(clean.status, 0, clean.stdout);
  assert.match(clean.stdout,
    new RegExp(`^\\[ {2}ok {2}\\] proof escapes\\s+${ESCAPES.length} escape\\(s\\) under `
      + "docs/requirements/, every one of them owed to an issue that still owes the case", "mu"),
    clean.stdout);
});

test("a tracker that refused the issue list leaves the escapes unjudged and the reading green", async () => {
  state.refuses = "403 the list is not yours";
  state.rows = [];
  const run = await doctor();
  assert.equal(run.status, 0, `an unanswered tracker is not a red on any escape: ${run.stdout}`);
  assert.match(run.stdout, new RegExp(`^\\[ note \\] proof escapes\\s+${ESCAPES.length} of `
    + `${ESCAPES.length} escape\\(s\\) under docs/requirements/ went unjudged: the tracker `
    + "refused the issue list", "mu"), run.stdout);
  assert.doesNotMatch(run.stdout, /^\[ miss \] proof escapes/mu,
    "and nothing is passed or failed on a reading that did not reach it");
});
