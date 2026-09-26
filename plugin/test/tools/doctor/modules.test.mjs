/* `forge doctor modules` end to end against a tracker whose labels and issues a case sets: the
   reading, the three writes and every refusal that sends nothing, and the row a bare reading prints. */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../../fixtures.mjs";
import { movedLabels } from "../../../src/tools/services/doctor/modules.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "cli.mjs");
const SLUG = "modules-fixture";

const state = { issues: [], labels: [], calls: [], answer: {
  "forge_projects.list": () => ({ projects: [{ slug: SLUG, id: "1e1c1a1e-0000-4000-8000-000000000021" }] }),
} };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const room = (config = {}) => projectRoom(tempRoom("doctor-modules-"), tracker.env.XDG_CONFIG_HOME,
  { slug: SLUG, ...config });
const plain = room();
const ran = (argv, cwd = plain) => ranAsync(process.execPath, [CLI, "doctor", ...argv], tracker.env, cwd);

const module = (id, name, parentId = null, description = null) =>
  ({ id, name, kind: "module", parentId, description, color: "#000000" });

const issue = (key, status, labels = []) => ({ issueId: key, documentId: `u-${key}`, status, labels,
  title: key, priority: "medium", category: "bug", createdAt: "2026-09-01T00:00:00.000Z" });

const seed = () => {
  state.labels = [
    module("m-tool", "tooling", null, "What the repository's own gate runs on."),
    module("m-gate", "gate", "m-tool"),
    module("m-surf", "surface"),
    { id: "l-bug", name: "bug", kind: "label", parentId: null, description: null, color: "#ffffff" },
  ];
  state.issues = [
    issue("ISS-1", "open", [{ id: "m-gate", isPrimary: true }, { id: "l-bug", isPrimary: false }]),
    issue("ISS-2", "confirmed", [{ id: "m-surf", isPrimary: true }]),
    issue("ISS-3", "open", [{ id: "l-bug", isPrimary: false }]),
    issue("ISS-4", "open"),
    issue("ISS-5", "closed", [{ id: "m-surf", isPrimary: true }]),
    issue("ISS-6", "open", [{ id: "m-tool", isPrimary: false }, { id: "m-surf", isPrimary: true }]),
  ];
  state.calls.length = 0;
};

const sent = (name, action) => state.calls.filter((call) => call.name === name && call.args?.action === action);
const writes = () => state.calls.filter((call) => ["POST", "PATCH", "DELETE"].includes(call.method));

test("the reading names each module's parent, description and open primaries, and the unassigned share", async () => {
  seed();
  const run = await ran(["modules"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^3 module\(s\) on the tracker of modules-fixture\.$/mu, "a plain label is no module");
  assert.match(run.stdout, /^ {2}tooling {2}parent none {2}0 open as primary/mu);
  assert.match(run.stdout, /^ {6}What the repository's own gate runs on\.$/mu, "its description under it");
  assert.match(run.stdout, /^ {4}gate {2}parent tooling {2}1 open as primary/mu, "a child indented under its parent");
  assert.match(run.stdout, /^ {2}surface {2}parent none {2}2 open as primary/mu, "a closed issue is not open");
  assert.match(run.stdout, /^2 of 5 open issue\(s\) carry no module \(40%\)\.$/mu,
    "a plain label is not a module, and the share is over every open issue");
  assert.deepEqual(writes(), [], "a reading writes nothing");
});

test("each module prints the weight it scores with and where that weight was read", async () => {
  seed();
  const weighed = room({ rank: { module: { tooling: -4, unset: 2 } } });
  const run = await ran(["modules"], weighed);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /tooling {2}parent none .* {2}weight -4 ← rank\.module\.tooling in \S+config\.json$/mu);
  assert.match(run.stdout, /gate {2}parent tooling .* {2}weight -4 ← rank\.module\.tooling, its ancestor's, in /mu);
  assert.match(run.stdout, /surface {2}parent none .* {2}weight 2 ← rank\.module\.unset in /mu);
  const bare = await ran(["modules"]);
  assert.match(bare.stdout, /surface .* {2}weight 0 ← no rank\.module table in \S+, so no module is weighed$/mu);
});

test("--add defines a module under the parent and with the text given, and prints it read back", async () => {
  seed();
  const run = await ran(["modules", "--add", "docs", "--parent", "tooling", "--description", "The docs tree."]);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(sent("forge_labels", "create").map((call) => call.args.data),
    [{ name: "docs", kind: "module", parentId: "m-tool", description: "The docs tree." }]);
  assert.match(run.stdout, /^Added docs, parent tooling, described "The docs tree\.", read back off the tracker\.$/mu);
  assert.match(run.stdout, /^ {4}docs {2}parent tooling/mu, "and the reading after it holds it");
});

test("--edit --parent moves a module under another, and --parent none to the top", async () => {
  seed();
  const moved = await ran(["modules", "--edit", "surface", "--parent", "tooling"]);
  assert.equal(moved.status, 0, moved.stderr);
  assert.match(moved.stdout, /^Edited surface, parent tooling, no description, read back/mu);
  const top = await ran(["modules", "--edit", "gate", "--parent", "none"]);
  assert.equal(top.status, 0, top.stderr);
  assert.deepEqual(sent("forge_labels", "update").map((call) => [call.args.labelId, call.args.data]),
    [["m-surf", { parentId: "m-tool" }], ["m-gate", { parentId: null }]]);
  assert.match(top.stdout, /^ {2}gate {2}parent none/mu);
});

test("--edit --description replaces the module's text", async () => {
  seed();
  const run = await ran(["modules", "--edit", "gate", "--description", "The gate's own checks."]);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(sent("forge_labels", "update").map((call) => call.args.data), [{ description: "The gate's own checks." }]);
  assert.match(run.stdout, /^Edited gate, parent tooling, described "The gate's own checks\.", read back/mu);
});

test("--remove deletes a module that no issue and no child carries", async () => {
  seed();
  state.labels.push(module("m-idle", "idle"));
  const run = await ran(["modules", "--remove", "idle"]);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(sent("forge_labels", "delete").map((call) => call.args.labelId), ["m-idle"]);
  assert.match(run.stdout, /^Removed idle, read back gone off the tracker\.$/mu);
  assert.ok(!state.labels.some((one) => one.id === "m-idle"));
});

test("--remove of a module issues carry sends no delete and names how many and the --to form", async () => {
  seed();
  const run = await ran(["modules", "--remove", "surface"]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /3 issue\(s\) carry surface, and the tracker refuses a delete while any does\. Nothing was sent\./u,
    "the closed issue carries it too, and holds the delete back like the open ones");
  assert.match(run.stderr, /`forge doctor modules --remove surface --to <module>`/u);
  assert.match(run.stderr, /`--to none`/u);
  assert.deepEqual(writes(), []);
});

test("--remove of a module holding a child sends no delete and names the child's --edit call", async () => {
  seed();
  const run = await ran(["modules", "--remove", "tooling", "--to", "none"]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /tooling holds 1 child module\(s\), which the tracker would move to the top unsaid\. Nothing was sent\./u);
  assert.match(run.stderr, /`forge doctor modules --edit gate --parent <module\|none>`/u);
  assert.deepEqual(writes(), []);
});

test("--remove --to moves every carrier onto the target keeping its primary, and deletes only after", async () => {
  seed();
  const run = await ran(["modules", "--remove", "surface", "--to", "tooling"]);
  assert.equal(run.status, 0, run.stderr);
  const byKey = (key) => state.issues.find((one) => one.issueId === key).labels;
  assert.deepEqual(byKey("ISS-2"), [{ id: "m-tool", isPrimary: true }]);
  assert.deepEqual(byKey("ISS-5"), [{ id: "m-tool", isPrimary: true }], "a closed carrier moves too");
  assert.deepEqual(byKey("ISS-6"), [{ id: "m-tool", isPrimary: true }],
    "where it already carried the target, the target takes the primary the removed one held");
  const order = writes().map((call) => call.method);
  assert.deepEqual(order, ["PATCH", "PATCH", "PATCH", "DELETE"], "three moves, then the one delete");
  assert.match(run.stdout, /^Removed surface, read back gone off the tracker\. 3 issue\(s\) moved to tooling, each read back\.$/mu);
});

test("--remove --to none takes the module off every carrier, other labels kept, then deletes it", async () => {
  seed();
  const run = await ran(["modules", "--remove", "gate", "--to", "none"]);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(state.issues.find((one) => one.issueId === "ISS-1").labels, [{ id: "l-bug", isPrimary: false }]);
  assert.deepEqual(sent("forge_labels", "delete").map((call) => call.args.labelId), ["m-gate"]);
  assert.match(run.stdout, /1 issue\(s\) moved off it, each read back\./u);
});

test("a name the project does not define is refused before anything is sent, naming what is defined", async () => {
  seed();
  for (const [argv, flag] of [
    [["--edit", "gat", "--description", "x"], "--edit"],
    [["--remove", "nothing"], "--remove"],
    [["--add", "docs", "--parent", "tolling"], "--parent"],
    [["--remove", "gate", "--to", "elsewhere"], "--to"],
  ]) {
    const run = await ran(["modules", ...argv]);
    assert.equal(run.status, 1, argv.join(" "));
    assert.match(run.stderr, new RegExp(`${flag} names \`[a-z]+\`, which is no module of this project\\.`, "u"));
    assert.match(run.stderr, /This project defines: tooling, gate, surface\./u);
    assert.match(run.stderr, /Nothing was sent\./u);
  }
  assert.deepEqual(writes(), []);
});

test("the project reading prints the module count and the unassigned share on one row", async () => {
  seed();
  const run = await ran(["project"]);
  assert.match(run.stdout, /\[ {2}ok {2}\] modules {16}3 defined; 2 of 5 open issue\(s\) carry none \(40%\) — `forge doctor modules`$/mu);
  state.labels = [];
  const none = await ran(["project"]);
  assert.match(none.stdout, /\[ {2}ok {2}\] modules {16}none defined, so every open issue carries none \(100%\)/mu);
});

test("a flag belongs to its write, and two writes are two calls", async () => {
  seed();
  const stray = await ran(["modules", "--to", "none"]);
  assert.match(stray.stderr, /--to belongs to --remove, and this call writes nothing\. Nothing was sent\./u);
  const two = await ran(["modules", "--add", "a", "--remove", "gate"]);
  assert.match(two.stderr, /--add and --remove are two writes, and a call makes one\./u);
  assert.deepEqual(writes(), []);
});

test("the moved label set swaps the module for the target, keeping the primary, and sends plain labels by id", () => {
  const labels = [{ id: "m-a", isPrimary: true }, { id: "l-x", isPrimary: false }];
  assert.deepEqual(movedLabels(labels, "m-a", "m-b"), ["l-x", { labelId: "m-b", isPrimary: true }]);
  assert.deepEqual(movedLabels(labels, "m-a", null), ["l-x"]);
  assert.deepEqual(movedLabels([{ id: "m-a", isPrimary: false }, { id: "m-b", isPrimary: true }], "m-a", "m-b"),
    [{ labelId: "m-b", isPrimary: true }], "a secondary removed leaves the target's own primary");
});
