/* The parts arm under a project whose keys are not `ISS-`, spawned against a tracker: the prefixes
   are read off the rows the filing already fetched, so what is asserted is the filing refused or
   filed, never the predicate alone — that is parts.test.mjs's (ISS-261). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, neutralRoom, projectRecord, ranAsync, tempHome } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const home = tempHome("parts-prefix");
process.env.XDG_CONFIG_HOME = home.path;

const row = (issueId, title) => ({ issueId, documentId: `uuid-${issueId}`, status: "open", title });
const APP = [row("APP-1", "the export writes one file per ledger"), row("APP-2", "the import reads the header row")];
const ISS = [row("ISS-1", "the export writes one file per ledger"), row("ISS-2", "the import reads the header row")];
const TITLE = "the monthly close locks every ledger it has already reported";

const BODY = [
  "## Outcome",
  "",
  "A ledger reported in a closed month takes no further posting.",
  "",
  "Parts: APP-1 and APP-2 are the halves of it.",
  "",
  "## Rules",
  "",
  "- A posting refused for the lock names the month that holds it.",
  "",
  "## Out of scope",
  "",
  "Reopening a month.",
].join("\n");

const state = { issues: APP, comments: {}, calls: [] };
const tracker = await fakeTracker(state);
const ENV = { ...tracker.env, HOME: tracker.env.XDG_CONFIG_HOME };
projectRecord(neutralRoom(), tracker.env.XDG_CONFIG_HOME, OWN);
test.after(() => tracker.close());

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const room = tempHome("parts-prefix-room").path;
mkdirSync(join(home.path, "forge"), { recursive: true });
writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url: tracker.url, token: "t", retrySeconds: 0 }));

const filed = (rows) => {
  state.issues = rows;
  state.calls = [];
  const path = join(room, "body.md");
  writeFileSync(path, `${BODY}\n`);
  return ranAsync(FORGE, ["new", path, "--title", TITLE, "--category", "feature", "--new"], ENV);
};
const created = () => state.calls.find((one) => one.name === "forge_issues" && one.args.action === "create");

test("under a project keyed APP-, a line naming two of its keys as parts is refused and nothing filed", async () => {
  const run = await filed(APP);
  assert.equal(run.status, 1, run.stdout);
  assert.equal(created(), undefined, "nothing was filed");
  assert.match(run.stderr, /a line naming APP-1 and APP-2 as this issue's parts/u);
  assert.match(run.stderr, /rewording it so `Parts` no longer leads into the keys/u,
    "and the route for a line that only cites them is named beside the split's");
});

test("under a project keyed ISS- alone, the same line names no key of its and is filed", async () => {
  const run = await filed(ISS);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "the filing was made");
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /as this issue's parts/u);
});
