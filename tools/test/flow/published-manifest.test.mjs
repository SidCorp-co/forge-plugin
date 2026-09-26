/* A release whose change edited the root manifest publishes a whole-table result for the head it
   ships. The manifest keys every step's digest, so a scoped gate that skipped the steps not claiming
   it left them held at no content, and every release after such an edit published a part (ISS-2564).
   The scratch holds the real gate code and runs its own gate, so the record read is the one a landing
   leaves. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

import { projectRecord, tempHome, tempRoom } from "../../../plugin/test/fixtures.mjs";
import { git, run, scratch } from "../gates/scratch.mjs";
import { STEPS } from "../../gates/steps.mjs";

const HOME = tempHome("published-manifest").path;
process.env.XDG_CONFIG_HOME = HOME;
const { publishedFor } = await import("../../../plugin/src/flow/earned/published.mjs");
const { heldIn, publishes } = await import("../../run/publish.mjs");

const SLUG = "a-tree-whose-manifest-moved";

test("a release after a scoped gate over a root manifest edit publishes the whole table", () => {
  const { work } = scratch("published-manifest", [], [], { also: [join("tools", "gates", "green.mjs")] });
  const bare = tempRoom("published-manifest-remote-");
  spawnSync("git", ["init", "-q", "--bare", bare], { cwd: dirname(bare), encoding: "utf8" });
  git(work, "remote", "add", "origin", bare);
  projectRecord(work, HOME, { slug: SLUG });

  const base = run(work);
  assert.equal(base.status, 0, `the base is gated whole first, as the head before a change is: ${base.stdout}${base.stderr}`);

  const manifest = JSON.parse(readFileSync(join(work, "package.json"), "utf8"));
  writeFileSync(join(work, "package.json"),
    JSON.stringify({ ...manifest, scripts: { ...manifest.scripts, "generate:spec": "node -e \"\"" } }, null, 2));
  git(work, "commit", "-qam", "a script beside the others, the version where it stood");
  const scoped = run(work);
  assert.equal(scoped.status, 0, scoped.stdout + scoped.stderr);
  assert.match(scoped.stdout, /=== scope: 1 path\(s\) since/u, `the run is a scoped one: ${scoped.stdout}`);

  git(work, "push", "-q", "origin", "HEAD:master");
  const head = git(work, "rev-parse", "HEAD").stdout.trim();
  const lines = [];
  publishes(work, "master", "1.0.0", { say: lines.push.bind(lines) });
  const stored = publishedFor(SLUG, head);
  assert.ok(stored, `the release published nothing, where it said: ${lines.join("\n")}`);
  assert.equal(stored.result, `nothing fails: all ${STEPS.length} gate step(s) green at this commit`,
    `the whole table and not the steps that claim the manifest, where it said: ${lines.join("\n")}`);
  assert.deepEqual(heldIn(work), { green: STEPS.length, of: STEPS.length });
});
