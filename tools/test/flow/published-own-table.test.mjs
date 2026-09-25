/* The table a release publishes from is the shipped tree's, whatever table the releasing process
   loaded at its start (ISS-2541). The scratch holds the real gate code, so the reading is the one a
   landing takes; and it moves a whole-tree test and the table's claim with it, the shape of the
   change whose release published nothing, so this process's own table cannot read that tree. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";

import { projectRecord, tempHome, tempRoom } from "../../../plugin/test/fixtures.mjs";
import { git, RUNNER, scratch } from "../gates/scratch.mjs";

const HOME = tempHome("published-own-table").path;
process.env.XDG_CONFIG_HOME = HOME;
const { publishedFor } = await import("../../../plugin/src/flow/earned/published.mjs");
const { heldIn, publishes } = await import("../../run/publish.mjs");
const { greenHeld } = await import("../../gates/green.mjs");
const { gitFiles } = await import("../../checkout.mjs");

const SLUG = "a-tree-that-moved-its-table";
const WAS = "tools/test/checks/standing.test.mjs";
const NOW = "tools/test/checks/still-standing.test.mjs";
const STEPS = join("tools", "gates", "steps.mjs");

const pushed = (work, message) => {
  git(work, "add", "-A");
  git(work, "commit", "-qm", message);
  git(work, "push", "-q", "origin", "HEAD:master");
  return git(work, "rev-parse", "HEAD").stdout.trim();
};

/* The scratch's own ledger and table, imported off its own paths, so the passes recorded are keyed
   the way the scratch's reader keys them and not the way this checkout's would. */
const greenAll = async (work) => {
  const own = (rel) => import(pathToFileURL(join(work, rel)).href);
  const { TEST_FILE, gateSteps } = await own(STEPS);
  const { ledgerFor, recordPass } = await own(join("tools", "gates", "ledger.mjs"));
  const files = gitFiles(work);
  const { dir, entries } = ledgerFor(gateSteps(files.filter((one) => TEST_FILE.test(one))),
    { root: work, files, runner: join(work, RUNNER) });
  for (const step of entries) recordPass(dir, step, 1);
  return entries.length;
};

const says = (work) => {
  const lines = [];
  publishes(work, "master", "1.0.0", { say: lines.push.bind(lines) });
  return lines.join("\n");
};

test("a release that moved its step table publishes the count the shipped table earns, off the shipped tree's own reader", async () => {
  const { work } = scratch("published-own-table", [], [], { also: [join("tools", "gates", "green.mjs")] });
  const bare = tempRoom("published-own-table-remote-");
  spawnSync("git", ["init", "-q", "--bare", bare], { encoding: "utf8" });
  git(work, "remote", "add", "origin", bare);
  projectRecord(work, HOME, { slug: SLUG });
  git(work, "mv", WAS, NOW);
  const table = readFileSync(join(work, STEPS), "utf8");
  assert.ok(table.includes(JSON.stringify(WAS)), "the scratch's table claims the test this case moves");
  writeFileSync(join(work, STEPS), table.replace(JSON.stringify(WAS), JSON.stringify(NOW)));
  const head = pushed(work, "the whole-tree test moves, and the table's claim with it");
  assert.throws(() => greenHeld(work), /git reports no test file at tools\/test\/checks\/standing\.test\.mjs/u,
    "this process's own table cannot read the shipped tree, which is the reading the release took");
  const of = await greenAll(work);
  assert.match(says(work), /whole-tree result is published/u, "the release publishes off the shipped tree's reading");
  assert.deepEqual(heldIn(work), { green: of, of }, "which is that tree's own reader counting its own table, green");
  assert.equal(publishedFor(SLUG, head).result, `nothing fails: all ${of} gate step(s) green at this commit`,
    "for the head it shipped, with the count the shipped table earns");
});

test("a shipped tree holding no gate reader of its own gets nothing published, and the line quotes why", () => {
  const { work } = scratch("published-no-reader", [], []);
  const bare = tempRoom("published-no-reader-remote-");
  spawnSync("git", ["init", "-q", "--bare", bare], { encoding: "utf8" });
  git(work, "remote", "add", "origin", bare);
  projectRecord(work, HOME, { slug: `${SLUG}-bare` });
  const head = pushed(work, "pushed as it stands");
  assert.match(says(work),
    /nothing is published for \w{7}: the gate's record could not be read \(Cannot find module '[^']*tools\/gates\/green\.mjs'/u,
    "the reader the tree does not hold is named in the line, rather than this process's own standing in for it");
  assert.equal(publishedFor(`${SLUG}-bare`, head), null, "and nothing is stored for that head");
});
