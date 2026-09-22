/* Whether a change of this project goes out without a person's look: `release`, a key of the
   project's own record as of ISS-2190 and the tracker's `pipelineConfig.autoProdDeploy` before it.
   What is judged here is which level answers, in which order, and that the report says which of the
   two it was — a fallback nobody can see being a precedence nobody can undo. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { escaped, projectEntry, projectRoom, tempRoom } from "../../../fixtures.mjs";
import { whole } from "../../../tools/doctor/fixture.mjs";

const CLI = new URL("../../../../src/cli.mjs", import.meta.url).pathname;

const PUBLISHES = { baseBranch: "master", releaseModel: "publish" };

const reportOf = (pipelineConfig, project) =>
  whole({ ...PUBLISHES, pipelineConfig }, { project: { slug: "release-fixture", ...project } });

const set = (value) => {
  const home = tempRoom("doctor-release-set-");
  const cwd = projectRoom(tempRoom("doctor-release-set-cwd-"), home, { slug: "demo" });
  const env = { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home };
  const wrote = spawnSync(process.execPath, [CLI, "doctor", "--set", `release=${value}`], { encoding: "utf8", cwd, env });
  const entry = projectEntry(cwd, home);
  return { wrote, entry, held: JSON.parse(readFileSync(entry, "utf8")) };
};

test("the project's own key decides the production deploy, and the report names it as the level that answered", async () => {
  const { out, entry } = await reportOf({ autoProdDeploy: true }, { release: "manual" });
  assert.match(out, /\[ {2}ok {2}\] production deploy\s+a person's — a user-facing change waits for a person's look/u,
    "the local key is read over a tracker flag that says the opposite: it is the one source now, not a twin");
  assert.match(out, new RegExp(`production deploy.*← ${escaped(entry)}`, "u"),
    "and the row names the file it was read from rather than the record it moved off");
});

test("the same key the other way round ships without a person over a tracker flag that is false", async () => {
  const { out, entry } = await reportOf({ autoProdDeploy: false }, { release: "auto" });
  assert.match(out, /\[ {2}ok {2}\] production deploy\s+automatic — a user-facing change ships without a person's look/u);
  assert.match(out, new RegExp(`production deploy.*← ${escaped(entry)}`, "u"));
});

/* The whole of what makes this a move rather than a reversal: the flag is live on projects this code
   cannot see, so a project that has not set the key is a project the upgrade did not touch. */
test("a project that declares nothing locally still reads the tracker's flag, and the report says which level answered", async () => {
  const { out } = await reportOf({ autoProdDeploy: true }, {});
  assert.match(out, /\[ {2}ok {2}\] production deploy\s+automatic — a user-facing change ships without a person's look/u,
    "which is what the same project read before the key existed");
  assert.match(out, /production deploy.*← the tracker's project config, this project's own `release` key being unset/u,
    "and the fallback is named, a precedence a reader cannot see being one nobody can undo");
});

test("neither level having spoken is a person's look, which is the reading that stops", async () => {
  const { out } = await reportOf({}, {});
  assert.match(out, /\[ {2}ok {2}\] production deploy\s+a person's — a user-facing change waits for a person's look/u);
  assert.match(out, /this project's own `release` key being unset/u);
});

/* Every key of this file falls back rather than refusing a call that has nothing to do with it, and
   this row is the only surface that would name it: silent here, a typo would read as a project that
   declared nothing while the tracker quietly went on answering. */
test("a word the release key does not take is named in the row rather than read as no declaration", async () => {
  const { out } = await reportOf({ autoProdDeploy: true }, { release: "manul" });
  assert.match(out, /\[ {2}ok {2}\] production deploy\s+automatic — /u, "the tracker's flag still answers");
  assert.match(out, /this project's own `release` key holding `manul`, which is no value of it — it takes auto, manual/u);
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
