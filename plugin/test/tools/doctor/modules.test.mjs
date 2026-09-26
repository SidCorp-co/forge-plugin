/* `forge doctor modules` end to end against a tracker whose labels and issues a case sets: the
   reading, the three writes and every refusal that sends nothing, and the row a bare reading prints. */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../../fixtures.mjs";
import { movedLabels } from "../../../src/tools/services/doctor/modules/manage.mjs";

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
    issue("ISS-7", "open", [{ id: "m-gate", isPrimary: true }, { id: "m-surf", isPrimary: false }]),
  ];
  state.calls.length = 0;
  state.page = undefined;
  delete state.answer.forge_issues;
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
  assert.match(run.stdout, /^ {4}gate {2}parent tooling {2}2 open as primary/mu, "a child indented under its parent");
  assert.match(run.stdout, /^ {2}surface {2}parent none {2}2 open as primary/mu,
    "a closed issue is not open, and a secondary carrier is not a primary one");
  assert.match(run.stdout, /^2 of 6 open issue\(s\) carry no module \(33%\)\.$/mu,
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
  assert.match(run.stderr, /4 issue\(s\) carry surface, and the tracker refuses a delete while any does\. Nothing was sent\./u,
    "the closed issue and the secondary carrier hold the delete back like the open primaries");
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
  state.page = 2;
  const run = await ran(["modules", "--remove", "surface", "--to", "tooling"]);
  assert.equal(run.status, 0, run.stderr);
  const byKey = (key) => state.issues.find((one) => one.issueId === key).labels;
  assert.deepEqual(byKey("ISS-2"), [{ id: "m-tool", isPrimary: true }]);
  assert.deepEqual(byKey("ISS-5"), [{ id: "m-tool", isPrimary: true }], "a closed carrier moves too");
  assert.deepEqual(byKey("ISS-6"), [{ id: "m-tool", isPrimary: true }],
    "where it already carried the target, the target takes the primary the removed one held");
  assert.deepEqual(byKey("ISS-7"), [{ id: "m-gate", isPrimary: true }, { id: "m-tool", isPrimary: false }],
    "a secondary carrier gets the target as secondary, its own primary kept");
  const walked = state.calls.filter((call) => call.args?.action === "attributed" && call.args.module === "m-surf");
  assert.equal(walked.length, 3, "two pages of two find the four carriers, and one empty page finds none left");
  const moves = state.calls.filter((call) => ["PATCH", "DELETE"].includes(call.method)
    || (call.method === "GET" && /^\/api\/issues\/[^/]+$/u.test(call.path)));
  const shape = moves.map((call) => (call.method === "GET" ? `GET ${call.path.split("/").pop()}` : call.method));
  assert.deepEqual(shape.filter((one) => !one.startsWith("GET")), ["PATCH", "PATCH", "PATCH", "PATCH", "DELETE"],
    "four moves, then the one delete");
  for (const [at, one] of shape.entries()) {
    if (one === "PATCH") assert.match(shape[at + 1] ?? "", /^GET u-ISS-\d$/u, "every move is read back before the next write");
  }
  assert.match(run.stdout, /^Removed surface, read back gone off the tracker\. 4 issue\(s\) moved to tooling, each read back\.$/mu);
});

test("--remove --to sends no delete where a move does not read back as written", async () => {
  seed();
  state.answer.forge_issues = (args) => (args.action === "update"
    ? { documentId: args.documentId } : undefined);
  const run = await ran(["modules", "--remove", "gate", "--to", "none"]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /ISS-\d did not move off gate: .* So gate was not deleted\. The same call again moves the issues still carrying it\./su);
  assert.deepEqual(sent("forge_labels", "delete"), [], "the delete waits on every move reading back");
});

test("a module may not be called none or unset, and none is refused where a module holds that name", async () => {
  seed();
  for (const name of ["none", "unset"]) {
    const run = await ran(["modules", "--add", name]);
    assert.equal(run.status, 1, name);
    assert.match(run.stderr, new RegExp(`\`${name}\` is .*, so a module by that name could not be told from it\. Nothing was sent`, "u"));
  }
  state.labels.push(module("m-none", "none"));
  const ambiguous = await ran(["modules", "--remove", "gate", "--to", "none"]);
  assert.equal(ambiguous.status, 1);
  assert.match(ambiguous.stderr, /--to none means no module, and this project also defines a module named `none`/u);
  assert.deepEqual(writes(), []);
});

test("--remove --to none takes the module off every carrier, other labels kept, then deletes it", async () => {
  seed();
  const run = await ran(["modules", "--remove", "gate", "--to", "none"]);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(state.issues.find((one) => one.issueId === "ISS-1").labels, [{ id: "l-bug", isPrimary: false }]);
  assert.deepEqual(state.issues.find((one) => one.issueId === "ISS-7").labels, [{ id: "m-surf", isPrimary: false }]);
  assert.deepEqual(sent("forge_labels", "delete").map((call) => call.args.labelId), ["m-gate"]);
  assert.match(run.stdout, /2 issue\(s\) moved off it, each read back\./u);
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
  assert.match(run.stdout, /\[ {2}ok {2}\] modules {16}3 defined; 2 of 6 open issue\(s\) carry none \(33%\) — `forge doctor modules`$/mu);
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
