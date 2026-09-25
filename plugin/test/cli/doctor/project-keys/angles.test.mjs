/* Which angles review a consult here is the project's `codex.angles`, written by `forge doctor --set`
   and judged against the shipped `ANGLES` where it is typed rather than at the next consult (ISS-2470).
   docs/cli/the-project-file.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import { escaped, homeEnv, projectEntry, projectRoom, ranAsync, tempHome } from "../../../fixtures.mjs";
import { ANGLES } from "../../../../src/codex/codex-api.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

const HELD = `{\n  "slug": "a-tree",\n  "codex": { "check": "npm test", "angles": ["tech"] }\n}\n`;

const room = tempHome("doctor-set-angles");
test.after(() => room.remove());
const env = homeEnv("doctor-set-angles");
const file = projectEntry(projectRoom(room.path, env.XDG_CONFIG_HOME, {}), env.XDG_CONFIG_HOME);

const fresh = (text = HELD) => writeFileSync(file, text);
const now = () => readFileSync(file, "utf8");
const ask = (...argv) => ranAsync(FORGE, ["doctor", ...argv], env, room.path);
const angles = () => JSON.parse(now()).codex.angles;
const NAMES = Object.keys(ANGLES);

test("the project's angles are written through the level-named key and read back off the file", async () => {
  fresh();
  const run = await ask("--set", "project.codex.angles=tech,debt");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(angles(), ["tech", "debt"]);
  assert.match(run.stdout, new RegExp(`^project\\.codex\\.angles: \\["tech","debt"\\] {2}← ${escaped(file)}`, "mu"),
    run.stdout);
});

test("the bare key writes the same list to the same file, and names no gateway flag", async () => {
  fresh();
  const run = await ask("--set", "codex.angles=tech,debt");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(angles(), ["tech", "debt"]);
  assert.doesNotMatch(run.stdout + run.stderr, /--codex-url|--codex-key|MACHINE's/u);
});

test("a codex key the project does not hold is refused with angles among the project's codex paths", async () => {
  fresh();
  const run = await ask("--set", "project.codex.anglez=tech");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /whose paths are [^\n]*\bcodex\.angles\b/u, run.stderr);
  assert.equal(now(), HELD);
});

test("a name that is no angle is refused with the nearest and the whole set, at either spelling", async () => {
  for (const key of ["project.codex.angles", "codex.angles"]) {
    fresh();
    const run = await ask("--set", `${key}=tech,dbet`);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /No angle named dbet\. Did you mean: debt\?/u, run.stderr);
    for (const name of NAMES) assert.match(run.stderr, new RegExp(`\\b${name}\\b`, "u"), `${name} is named: ${run.stderr}`);
    assert.equal(now(), HELD, "and the file is byte for byte what it held");
  }
});

test("a list naming no angle is refused at either spelling, and nothing is written", async () => {
  for (const key of ["project.codex.angles", "codex.angles"]) {
    fresh();
    const run = await ask("--set", `${key}=`);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /`codex\.angles` in \S+ names no angle/u, run.stderr);
    assert.equal(now(), HELD);
  }
});

/* The names come off the shipped table, so an angle added to it is writable with no second list. */
test("every angle the shipped table holds is accepted by the write", async () => {
  fresh();
  const run = await ask("--set", `project.codex.angles=${NAMES.join(",")}`);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(angles(), NAMES);
});

test("where debt is off, show and doctor name the write that turns it on, and that write does", async () => {
  fresh();
  const show = spawnSync(FORGE, ["codex", "show"], { cwd: room.path, env, encoding: "utf8" });
  const route = "forge doctor --set project.codex.angles=tech,debt";
  assert.match(show.stdout, new RegExp(`^angles {4}: tech {2}← [^\\n]*debt is available and off here: \`${escaped(route)}\` adds it$`, "mu"),
    show.stdout + show.stderr);
  const doctor = await ask();
  assert.match(doctor.stdout, new RegExp(`codex\\.angles +tech {2}← [^\\n]*\`${escaped(route)}\` adds it$`, "mu"), doctor.stdout);
  assert.equal((await ask("--set", route.split(" ").at(-1))).status, 0);
  const after = spawnSync(FORGE, ["codex", "show"], { cwd: room.path, env, encoding: "utf8" });
  assert.match(after.stdout, /^angles {4}: tech, debt {2}← [^\n]* — debt is on$/mu, after.stdout);
});
