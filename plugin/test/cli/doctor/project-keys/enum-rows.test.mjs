/* The enum-valued project keys as a developer meets them: the rows `forge doctor project` prints for
   each, `--set` writing and refusing each, and a key's own flag refusing exactly what `--set` refuses
   for it. Spawned, because the report and the refusals are what a developer reads. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { ENUM_FLAGS, ENUM_KEYS, pathOf, valuesOf } from "../../../../src/resolve/enum-keys.mjs";
import { escaped, projectEntry, projectRoom, tempRoom } from "../../../fixtures.mjs";

const CLI = new URL("../../../../src/cli.mjs", import.meta.url).pathname;

const room = (config) => {
  const home = tempRoom("doctor-enum-");
  const cwd = projectRoom(tempRoom("doctor-enum-cwd-"), home, config);
  const env = { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home };
  const run = (argv) => spawnSync(process.execPath, [CLI, "doctor", ...argv], { encoding: "utf8", cwd, env });
  const entry = projectEntry(cwd, home);
  return { run, entry, held: () => JSON.parse(readFileSync(entry, "utf8")) };
};

const valueAt = (record, key) => pathOf(key).reduce((held, one) => held?.[one], record);

test("release and report each have a row of their own, with the value's meaning and where it was read", () => {
  const { run, entry } = room({ slug: "demo", release: "manual", report: "daily" });
  const out = run(["project"]).stdout;
  assert.match(out, new RegExp(`\\[ {2}ok {2}\\] release\\s+manual — a user-facing change waits for a person's look {2}← ${escaped(entry)}`, "u"), out);
  assert.match(out, new RegExp(`\\[ {2}ok {2}\\] report\\s+daily — a session start writes yesterday's page, and the acts \`reportOn\` names rewrite the current report {2}← ${escaped(entry)}`, "u"), out);
});

test("a key that resolves to no value is printed with its own unset sentence", () => {
  const out = room({ slug: "demo" }).run(["project"]).stdout;
  assert.match(out, /\[ {2}ok {2}\] release\s+unset, so the tracker's own pipeline setting says whether a change waits for a person's look$/mu, out);
  assert.match(out, /\[ {2}ok {2}\] report\s+off — no session start or release writes the harness report {2}← the plugin's default$/mu, out);
});

test("a word a key does not take is a miss naming the word, what it takes and what is read instead", () => {
  const out = room({ slug: "demo", release: "sometimes", report: "weekly" }).run(["project"]).stdout;
  assert.match(out, /\[ miss \] release\s+sometimes is no value of this key — it takes auto, manual; reading the tracker's own pipeline setting$/mu, out);
  assert.match(out, /\[ miss \] report\s+weekly is no value of this key — it takes off, daily; reading off {2}← the plugin's default$/mu, out);
});

test("--set writes each key's listed value into the project record, and refuses a word it does not take", () => {
  for (const key of Object.keys(ENUM_KEYS)) {
    const [, value] = valuesOf(key);
    const { run, entry, held } = room({ slug: "demo" });
    const wrote = run(["--set", `${key}=${value}`]);
    assert.equal(wrote.status, 0, wrote.stderr);
    assert.equal(valueAt(held(), key), value, `${key} reads back`);
    const refused = run(["--set", `${key}=bogus`]);
    assert.notEqual(refused.status, 0);
    assert.equal(refused.stderr.trim(), `--set: \`${key}\` in ${entry} is one of ${valuesOf(key).join(", ")}, `
      + `not \`"bogus"\`. Nothing was written: ${entry} is as it was.`);
    assert.equal(valueAt(held(), key), value, `${key} is as it was`);
  }
});

test("a key's own flag and --set refuse a word it does not take with one sentence, and write nothing", () => {
  for (const key of ENUM_FLAGS) {
    const { run, held } = room({ slug: "demo" });
    const flag = run([`--${key}`, "bogus"]);
    const set = run(["--set", `${key}=bogus`]);
    assert.notEqual(flag.status, 0);
    assert.notEqual(set.status, 0);
    assert.equal(flag.stderr.replace(`--${key}: `, ""), set.stderr.replace("--set: ", ""));
    assert.deepEqual(held(), { slug: "demo" });
  }
});

test("a key's own flag given nothing is refused with the values the key takes, and writes nothing", () => {
  for (const key of ENUM_FLAGS) {
    const { run, entry, held } = room({ slug: "demo" });
    const empty = run([`--${key}`, ""]);
    assert.notEqual(empty.status, 0);
    assert.equal(empty.stderr.trim(), `--${key}: \`${key}\` in ${entry} is one of ${valuesOf(key).join(", ")}, `
      + `not \`""\`. Nothing was written: ${entry} is as it was.`);
    assert.deepEqual(held(), { slug: "demo" });
  }
});

test("a key's own flag leaves the record holding what --set leaves it holding, and says what the value means", () => {
  for (const key of ENUM_FLAGS) {
    for (const value of valuesOf(key)) {
      const byFlag = room({ slug: "demo" });
      const bySet = room({ slug: "demo" });
      const said = byFlag.run([`--${key}`, value]);
      bySet.run(["--set", `${key}=${value}`]);
      assert.deepEqual(byFlag.held(), bySet.held());
      assert.match(said.stdout, new RegExp(`\`demo\` now reads \`${key}\` as ${value}: ${escaped(ENUM_KEYS[key].values[value])}\\. `
        + "No other project on this machine is moved by it\\.", "u"));
    }
  }
});
