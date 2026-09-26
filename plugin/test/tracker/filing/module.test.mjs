/* `--module` on the two verbs that file: the primary module on the create, read back off the filed
   issue, refused before anything is filed where the target project defines no such module, and
   said where the filing folded onto a neighbour and so wrote none. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectRecord, ranAsync, tempHome } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const home = tempHome("module-filing");
const NEIGHBOUR = { issueId: "ISS-45", documentId: "uuid-45", status: "open",
  title: "the attach verb refuses a name already on the issue" };
const state = { issues: [], labels: [], comments: {}, calls: [], memory: {} };
const tracker = await fakeTracker(state);
const ENV = { ...tracker.env, HOME: tracker.env.XDG_CONFIG_HOME };
projectRecord(new URL("../../../../", import.meta.url).pathname, tracker.env.XDG_CONFIG_HOME, OWN);
test.after(() => tracker.close());

mkdirSync(join(home.path, "forge"), { recursive: true });
writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url: tracker.url, token: "t", retrySeconds: 0 }));

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const room = tempHome("module-filing-room").path;

const BODY = [
  "## What happened", "", "`forge attach issue ISS-45 ./gate.txt` puts a second document of that name beside the first.", "",
  "## Why it happens", "", "`plugin/src/commands.mjs` uploads under the name it was handed, reading nothing already there.", "",
  "## Where", "", "`plugin/src/commands.mjs`, the attach verb.", "",
  "## Outcome", "", "One name on one issue names one document, whichever verb put it there.", "",
  "## Rules", "", "- A name already on the issue is refused rather than attached twice.", "",
  "## Out of scope", "", "The names already doubled.",
].join("\n");
const TITLE = "one name on an issue resolves to one document";

const bodyFile = () => {
  const path = join(room, "body.md");
  writeFileSync(path, `${BODY}\n`);
  return path;
};

const filed = (...argv) => ranAsync(FORGE, ["new", bodyFile(), "--title", TITLE, "--category", "bug", ...argv], ENV);
const noted = (...argv) => ranAsync(FORGE, ["feedback", bodyFile(), "--title", TITLE, ...argv], ENV);

/* The tracker keeps what a create sent, so the read-back reads what the write left, as it would. */
const keeping = (labelsKept = true) => ({
  forge_issues: (args) => {
    if (args.action === "create") {
      const row = { documentId: "filed-uuid", issueId: "ISS-900", ...args.data,
        labels: labelsKept ? (args.data.labels ?? []).map((one) => ({ id: one.labelId, isPrimary: one.isPrimary })) : [] };
      state.issues.push(row);
      return row;
    }
    if (args.action === "get") return state.issues.find((one) => one.documentId === args.documentId) ?? {};
    return undefined;
  },
});

const before = (answer = keeping()) => {
  state.calls = [];
  state.issues = [NEIGHBOUR];
  state.memory = {};
  state.answer = answer;
  state.labels = [
    { id: "m-surf", name: "surface", kind: "module", parentId: null, description: null },
    { id: "l-bug", name: "bug", kind: "label", parentId: null, description: null },
  ];
};

const created = () => state.calls.find((one) => one.name === "forge_issues" && one.args.action === "create");

test("forge new --module files the issue with that module as its primary, read back", async () => {
  before();
  const run = await filed("--module", "surface", "--new");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(created().args.data.labels, [{ labelId: "m-surf", isPrimary: true }]);
  assert.match(run.stdout, /^ISS-900 is filed at filed-uuid under surface, its primary module, read back from the tracker\.$/mu);
});

test("a filing the tracker kept no module on says that half is unverified", async () => {
  before(keeping(false));
  const run = await filed("--module", "surface", "--new");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /the read-back does not carry surface as its primary module, so that half of the filing is unverified/u);
});

test("forge feedback --module files the note on the plugin's project under that module, read back", async () => {
  before();
  const run = await noted("--module", "surface", "--new");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(created().args.data.labels, [{ labelId: "m-surf", isPrimary: true }]);
  const listed = state.calls.find((one) => one.name === "forge_labels");
  assert.equal(listed.slug, OWN.slug, "the modules read are the plugin project's, where the note goes");
  assert.match(run.stdout, /under surface, its primary module, read back from the tracker\.$/mu);
});

test("a --module the project does not define is refused before anything is filed, naming the way to define it", async () => {
  for (const verb of [filed, noted]) {
    before({});
    const run = await verb("--module", "bug", "--new");
    assert.equal(run.status, 1);
    assert.match(run.stderr, /--module names `bug`, which is no module of this project\./u, "a plain label is no module");
    assert.match(run.stderr, /This project defines: surface\./u);
    assert.match(run.stderr, /Nothing was filed: `forge doctor modules --add bug` defines it/u);
    assert.equal(created(), undefined);
  }
});

test("a filing given --module that folds onto a neighbour says no module was written", async () => {
  before({});
  state.memory = { semantic: [[NEIGHBOUR.issueId, 0.83]], keyword: [[NEIGHBOUR.issueId, 0.0608]] };
  const run = await filed("--module", "surface", "--complexity", "s");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(created(), undefined, "it folded");
  assert.match(run.stdout, /^No module was written: the filing folded onto ISS-45 as a comment, and a comment carries none\./mu);
});
