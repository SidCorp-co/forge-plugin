/* The enum-valued project keys, each declared once in resolve/project/enum-keys.mjs: every row held to what
   each of its consumers answers — the resolver, the write's judge, the report's row — so a row added
   to the table is covered here with no case of its own, and a list of values restated anywhere else
   in the source is a second declaration this names. */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { ENUM_FLAGS, ENUM_KEYS, meaningOf, pathOf, valuesOf } from "../../src/resolve/project/enum-keys.mjs";
import { enumOf, machineLeftovers } from "../../src/resolve/settings.mjs";
import { PROJECT_KEYS } from "../../src/tools/services/project-file.mjs";
import { enumRow, leftoverRows } from "../../src/tools/services/doctor/keys.mjs";
import { usageOf } from "../../src/resolve/visibility.mjs";

const SRC = new URL("../../src/", import.meta.url).pathname;
const TABLE = "resolve/project/enum-keys.mjs";
const DEFAULT = "the plugin's default";
const FILE = "the file under test";

/* What each key took and fell back to before the table existed, spelled here rather than read off
   it: a case comparing the table with itself would pass whatever the table said. */
const BEFORE = {
  shape: { values: ["storefront", "staged", "direct"], fallback: null },
  landing: { values: ["after-merge", "before-merge"], fallback: null },
  redBatch: { values: ["attribute-then-split", "one-by-one"], fallback: "attribute-then-split" },
  ship: { values: ["self", "ready"], fallback: "self" },
  "asks.mode": { values: ["off", "decide"], fallback: "off" },
  release: { values: ["auto", "manual"], fallback: null },
  report: { values: ["off", "daily"], fallback: "off" },
};

/* A project record holding `value` at the key's own path, `asks.mode` inside its table. */
const recordWith = (key, value) => pathOf(key).reduceRight((inner, one) => ({ [one]: inner }), value);

const judged = (key, value) => {
  const [top] = pathOf(key);
  return PROJECT_KEYS[top].judge(recordWith(key, value)[top]);
};

test("the table declares the keys and the values each took before it, with the same fallbacks", () => {
  assert.deepEqual(Object.keys(ENUM_KEYS).sort(), Object.keys(BEFORE).sort());
  for (const [key, before] of Object.entries(BEFORE)) {
    assert.deepEqual(valuesOf(key), before.values, `${key}'s values`);
    assert.equal(ENUM_KEYS[key].fallback, before.fallback, `${key}'s fallback`);
    for (const value of before.values) assert.ok(meaningOf(key, value)?.trim(), `${key}=${value} carries a meaning`);
    if (before.fallback === null) {
      assert.ok(ENUM_KEYS[key].unset?.trim() && ENUM_KEYS[key].reads?.trim(),
        `${key} resolves to no value where unset, so it says what that reads as`);
    }
  }
});

test("each row resolves a listed, an absent and an unlisted word to the value and source it resolved to before", () => {
  for (const [key, { values, fallback }] of Object.entries(BEFORE)) {
    const absentFrom = fallback === null ? null : DEFAULT;
    for (const value of values) {
      assert.deepEqual(enumOf(key, recordWith(key, value), FILE), { value, from: FILE }, `${key}=${value}`);
    }
    assert.deepEqual(enumOf(key, {}, FILE), { value: fallback, from: absentFrom }, `${key} absent`);
    assert.deepEqual(enumOf(key, recordWith(key, null), FILE), { value: fallback, from: absentFrom }, `${key}: null`);
    assert.deepEqual(enumOf(key, null, FILE), { value: fallback, from: absentFrom }, `${key} with no record`);
    assert.deepEqual(enumOf(key, recordWith(key, "bogus"), FILE),
      { value: fallback, from: absentFrom, unknown: "bogus" }, `${key}=bogus`);
  }
});

test("each row's write judge takes every value it lists and refuses any other word with the values it takes", () => {
  for (const key of Object.keys(ENUM_KEYS)) {
    for (const value of valuesOf(key)) assert.equal(judged(key, value), null, `${key}=${value}`);
    assert.match(judged(key, "bogus"),
      new RegExp(`^\`${key.replace(".", "\\.")}\` in .+ is one of ${valuesOf(key).join(", ")}, not \`"bogus"\`\\.$`, "u"));
  }
});

test("each row's report row carries the value in force with its meaning, its unset sentence, or a miss", () => {
  for (const key of Object.keys(ENUM_KEYS)) {
    const row = ENUM_KEYS[key];
    for (const value of valuesOf(key)) {
      assert.deepEqual(enumRow(key, enumOf(key, recordWith(key, value), FILE)),
        { label: key, detail: `${value} — ${meaningOf(key, value)}  ← ${FILE}` });
    }
    const absent = enumRow(key, enumOf(key, {}, FILE));
    assert.equal(absent.detail, row.fallback === null ? row.unset
      : `${row.fallback} — ${meaningOf(key, row.fallback)}  ← ${DEFAULT}`, `${key} absent`);
    const miss = enumRow(key, enumOf(key, recordWith(key, "bogus"), FILE));
    assert.equal(miss.level, "miss");
    assert.match(miss.detail, new RegExp(`^bogus is no value of this key — it takes ${valuesOf(key).join(", ")}; `
      + `reading ${row.fallback ?? row.reads}`, "u"));
  }
});

test("each row declaring a flag of its own is offered it on the doctor's usage row", () => {
  assert.deepEqual(ENUM_FLAGS, ["ship"], "the one key with a flag of its own today");
  for (const key of ENUM_FLAGS) assert.match(usageOf("doctor"), new RegExp(`\\[--${key} ${valuesOf(key).join("\\|")}\\]`, "u"));
});

const sources = (dir) => readdirSync(dir).flatMap((one) => {
  const path = join(dir, one);
  if (statSync(path).isDirectory()) return sources(path);
  return path.endsWith(".mjs") ? [path] : [];
});

test("no source file but the table spells out a row's list of values", () => {
  const lists = Object.keys(ENUM_KEYS).map((key) => ({ key, list: valuesOf(key).map((one) => `"${one}"`).join(", ") }));
  const found = sources(SRC).filter((path) => relative(SRC, path) !== TABLE).flatMap((path) => {
    const text = readFileSync(path, "utf8");
    return lists.filter((one) => text.includes(one.list)).map((one) => `${relative(SRC, path)} restates ${one.key}`);
  });
  assert.deepEqual(found, []);
});

/* A second retired key, one no declared row replaces, to hold the reader to the whole table rather
   than to the one row it has today. */
const RETIRED = [
  { key: "ship", now: "`ship` in the project's record", route: "`forge doctor --ship <value>`" },
  { key: "oldKey", now: "`newKey` in the project's record", route: "`forge doctor --set newKey=<value>`" },
];

test("every retired machine key present is a leftover, whatever it holds, and one absent is none", () => {
  for (const value of [null, "", "self"]) {
    const left = machineLeftovers(RETIRED, { ship: value });
    assert.deepEqual(left.map((one) => [one.key, one.value]), [["ship", value]]);
  }
  assert.deepEqual(machineLeftovers(RETIRED, { oldKey: 1, ship: "ready" }).map((one) => one.key), ["ship", "oldKey"]);
  assert.deepEqual(machineLeftovers(RETIRED, {}), []);
});

/* A retired key may be one field of a table the machine still owns — `codex.complexityModel` moved to
   the project's record while `codex.url` stayed (ISS-2167) — so presence is read at its last segment. */
test("a dotted retired key is a leftover where its table holds the field, and none where it does not", () => {
  const retired = [{ key: "codex.complexityModel", now: "`codex.complexityModel` in the project's record", route: "`forge doctor --set codex.complexityModel=<model>`" }];
  assert.deepEqual(machineLeftovers(retired, { codex: { url: "u", complexityModel: "cx/luna" } }).map((one) => [one.key, one.value]),
    [["codex.complexityModel", "cx/luna"]]);
  assert.deepEqual(machineLeftovers(retired, { codex: { url: "u" } }), [], "the table alone is no leftover");
  assert.deepEqual(machineLeftovers(retired, {}), []);
  const [moved] = machineLeftovers(undefined, { codex: { url: "u", complexityModel: "cx/luna" } });
  assert.match(leftoverRows([moved])[0].detail,
    /`codex\.complexityModel: "cx\/luna"` in \S+ is ignored — the key that decides this is now `codex\.complexityModel` in this machine's record of that project, written by `forge doctor --set codex\.complexityModel=<model>`/u,
    "and the machine's own table carries that row, naming the command that sets the project's");
  const [left] = machineLeftovers(retired, { codex: { complexityModel: null } });
  assert.match(leftoverRows([left])[0].detail, /is ignored — the key that decides this is now `codex\.complexityModel` in the project's record/u);
});

test("a leftover is said on the row of the key that replaced it, or on a note row of its own", () => {
  const left = machineLeftovers(RETIRED, { oldKey: 1, ship: "ready" });
  const [ship, old] = left;
  const row = enumRow("ship", enumOf("ship", {}, FILE), ship);
  assert.equal(row.level, "note");
  assert.match(row.detail, /; `ship: "ready"` in \S+ is ignored — the key that decides this is now `ship` in the project's record, written by `forge doctor --ship <value>`\. Remove that line by hand$/u);
  assert.deepEqual(leftoverRows(left), [{ level: "note", label: "oldKey", detail:
    `\`oldKey: 1\` in ${old.from} is ignored — the key that decides this is now \`newKey\` in the project's record, `
    + "written by `forge doctor --set newKey=<value>`. Remove that line by hand" }]);
});
