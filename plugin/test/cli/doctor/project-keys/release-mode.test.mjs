/* Whether a change of this project goes out without a person's look: `release`, a key of the
   project's own record as of ISS-2190 and the tracker's `pipelineConfig.autoProdDeploy` before it.
   What is judged here is the surface alone — that the report's row reaches the derivation and cites
   the file the key was read from, and that `--set` writes the key into that same file and refuses a
   value it does not take. Which level answers in which order is a pure function of the two and is
   proven where it is derived, at no process spawn per row (ISS-2219). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { escaped, projectEntry, projectRoom, tempRoom } from "../../../fixtures.mjs";
import { whole } from "../../../tools/doctor/fixture.mjs";

const CLI = new URL("../../../../src/cli.mjs", import.meta.url).pathname;

const set = (value) => {
  const home = tempRoom("doctor-release-set-");
  const cwd = projectRoom(tempRoom("doctor-release-set-cwd-"), home, { slug: "demo" });
  const env = { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home };
  const wrote = spawnSync(process.execPath, [CLI, "doctor", "--set", `release=${value}`], { encoding: "utf8", cwd, env });
  const entry = projectEntry(cwd, home);
  return { wrote, entry, held: JSON.parse(readFileSync(entry, "utf8")) };
};

test("the project's own key decides the production deploy, and the report names it as the level that answered", async () => {
  const { out, entry } = await whole(
    { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true } },
    { project: { release: "manual" } },
  );
  assert.match(out, /\[ {2}ok {2}\] production deploy\s+a person's — a user-facing change waits for a person's look/u,
    "the local key is read over a tracker flag that says the opposite: it is the one source now, not a twin");
  assert.match(out, new RegExp(`production deploy.*← ${escaped(entry)}`, "u"),
    "and the row names the file it was read from rather than the record it moved off");
});

test("the key is written by --set, and a value outside the set is refused naming it", () => {
  const wrote = set("auto");
  assert.deepEqual(wrote.held, { slug: "demo", release: "auto" });
  assert.match(wrote.wrote.stdout, new RegExp(escaped(wrote.entry), "u"));
  const refused = set("sometimes");
  assert.notEqual(refused.wrote.status, 0);
  assert.match(refused.wrote.stderr, /is one of auto, manual, not `"sometimes"`/u);
  assert.deepEqual(refused.held, { slug: "demo" }, "nothing was written");
});
