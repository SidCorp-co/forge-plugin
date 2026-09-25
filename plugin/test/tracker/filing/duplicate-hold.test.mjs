/* The duplicate hold `forge new` puts on a filing that reads like an open issue, and the one flag
   that declines it, spawned against a tracker. A split's sibling reads like its parent by
   construction, and a hold whose only way through is a reworded title is the case these pin
   (ISS-2527); what `--new` does to the fold is beside.test.mjs's. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectRecord, ranAsync, tempHome } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const home = tempHome("duplicate-hold");
process.env.XDG_CONFIG_HOME = home.path;

const PARENT = { issueId: "ISS-45", documentId: "uuid-45", status: "open",
  title: "forge google --dry-run exchanges no token and sends nothing" };
const OTHER = { issueId: "ISS-52", documentId: "uuid-52", status: "open",
  title: "the consult log records the effort it asked for" };
const SIBLING = "forge google --dry-run exchanges no token before it prints the request";

const WHOLE = [
  "## Outcome",
  "",
  "The printed request is the one a real call would send, read before any credential moves.",
  "",
  "## Rules",
  "",
  "- Nothing leaves this machine while the flag is given.",
  "",
  "## Out of scope",
  "",
  "The request's own shape.",
].join("\n");

const state = { issues: [PARENT, OTHER], comments: {}, calls: [] };
const tracker = await fakeTracker(state);
const ENV = { ...tracker.env, HOME: tracker.env.XDG_CONFIG_HOME };
projectRecord(new URL("../../../../", import.meta.url).pathname, tracker.env.XDG_CONFIG_HOME, OWN);
test.after(() => tracker.close());

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const room = tempHome("duplicate-hold-room").path;
mkdirSync(join(home.path, "forge"), { recursive: true });
writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url: tracker.url, token: "t", retrySeconds: 0 }));

const filed = (body, ...argv) => {
  state.calls = [];
  const path = join(room, "body.md");
  writeFileSync(path, `${body}\n`);
  return ranAsync(FORGE, ["new", path, "--title", SIBLING, ...argv], ENV);
};
const created = () => state.calls.find((one) => one.name === "forge_issues" && one.args.action === "create");

test("a sibling naming its parent through --with is filed under --new, and the reply names the parent", async () => {
  const run = await filed(WHOLE, "--category", "feature", "--with", PARENT.issueId, "--new");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "the sibling was filed");
  assert.equal(created().args.data.title, SIBLING, "under the title it was given, not a reworded one");
  assert.match(run.stdout,
    /--new declined the duplicate hold: the title of this filing reads like ISS-45 `forge google --dry-run exchanges no token and sends nothing` at 0\.\d\d/u);
  assert.doesNotMatch(run.stdout, /--new declined nothing/u, "and the flag is not also said to have done nothing");
});

test("under --new a filing naming no --with is filed too, and the reply names what it read like", async () => {
  const run = await filed(WHOLE, "--category", "feature", "--new");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(created(), "the filing was made");
  assert.match(run.stdout, /--new declined the duplicate hold: the title of this filing reads like ISS-45 [^\n]* at 0\.\d\d/u);
});

test("without --new the filing is held, and the hold names the split route beside the comment", async () => {
  const run = await filed(WHOLE, "--category", "feature", "--with", PARENT.issueId);
  assert.equal(run.status, 1);
  assert.equal(created(), undefined, "nothing was filed");
  assert.match(run.stderr, /read: the title of this filing, against ISS-45 [^\n]*, overlapping at 0\.\d\d/u);
  assert.match(run.stderr,
    /clear: forge comment ISS-45 <body> --title "<title>"; or, for a split of its own, the same\s+forge new with --with ISS-45 --new/u);
});

test("--new declines the duplicate line alone: a body the shape refuses is still refused for its shape", async () => {
  const run = await filed(WHOLE, "--category", "bug", "--with", PARENT.issueId, "--new");
  assert.equal(run.status, 1);
  assert.equal(created(), undefined, "nothing was filed");
  assert.match(run.stderr, /What happened/u, "the missing section is what the refusal names");
  assert.doesNotMatch(run.stderr, /overlapping at/u, "and the declined duplicate is not among its lines");
});

test("forge new -h says --new declines the duplicate hold as well as the fold", async () => {
  const run = await ranAsync(FORGE, ["new", "-h"], ENV);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /--new {10}file it even where it reads like an open issue — the duplicate hold or the fold\n\s+onto a neighbour — and say which/u);
});

test("--new leaves the route hold standing: a fix-shaped body is still asked for its route", async () => {
  const run = await filed("`plugin/src/commands.mjs` should take the dry-run route.", "--category", "feature", "--new");
  assert.equal(run.status, 1);
  assert.equal(created(), undefined, "nothing was filed");
  assert.match(run.stderr, /--complexity xs\|s\|m\|l\|xl/u, "the route the refusal owes is named");
  assert.doesNotMatch(run.stderr, /overlapping at/u, "and the declined duplicate is not among its lines");
});
