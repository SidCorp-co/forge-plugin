/* One doctor call reads each contract part of each shipped flow once (ISS-2720, the doctor half of
   ISS-1136). Counted in file reads in a process of its own, the way plugin/test/guides/reads-once.test.mjs
   counts a guide call: a count taken after another call in the same process would be a count of what
   that call left behind. The `serves` reading is the one whose rows the contract check writes, and
   with no credential in the home it stops at the endpoint, so nothing here reaches a tracker. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../fixtures.mjs";
import { FLOW_SLUGS } from "../../../src/guides/flow.mjs";

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const CLI = join(PLUGIN, "src", "cli.mjs");
const CONTRACT = join(PLUGIN, "guides", "contract");

/* Loaded ahead of the CLI, it records every markdown file read and writes the list where the case
   names. Written at run time, so no file in the tree is a module nothing imports. */
const counter = () => {
  const room = tempRoom("doctor-reads-once-counter-");
  const path = join(room, "count-reads.mjs");
  writeFileSync(path, [
    'import fs from "node:fs";',
    'import { syncBuiltinESMExports } from "node:module";',
    "const read = fs.readFileSync;",
    "const reads = [];",
    'fs.readFileSync = (path, ...rest) => { if (String(path).endsWith(".md")) reads.push(String(path)); return read(path, ...rest); };',
    "syncBuiltinESMExports();",
    'process.on("exit", () => fs.writeFileSync(process.env.COUNT_READS_TO, JSON.stringify(reads)));',
  ].join("\n"));
  return { preload: path, count: join(room, "reads.json") };
};

const served = () => {
  const { preload, count } = counter();
  const home = tempRoom("doctor-reads-once-home-");
  const ran = spawnSync(process.execPath, ["--import", preload, CLI, "doctor", "serves"], {
    encoding: "utf8",
    cwd: tempRoom("doctor-reads-once-cwd-"),
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home, COUNT_READS_TO: count },
  });
  /* This home holds no credential, and `1` is what the report exits on for that alone. */
  assert.equal(ran.status, 1,
    `the report exited ${ran.signal ? `on ${ran.signal}` : ran.status} rather than printing: ${ran.stderr}`);
  return { out: ran.stdout, reads: JSON.parse(readFileSync(count, "utf8")) };
};

const partsOf = (flow) => readdirSync(join(CONTRACT, flow))
  .filter((one) => one.endsWith(".md")).map((one) => join(CONTRACT, flow, one)).sort();

test("one doctor call reads each contract part of each shipped flow exactly once", () => {
  const { out, reads } = served();
  const times = reads
    .filter((one) => one.startsWith(`${CONTRACT}/`))
    .reduce((all, one) => all.set(one, (all.get(one) ?? 0) + 1), new Map());
  assert.deepEqual([...times.keys()].sort(), FLOW_SLUGS.flatMap(partsOf).sort(),
    "the call missed a contract part of a shipped flow, or read one no flow ships");
  const twice = [...times].filter(([, n]) => n > 1).map(([file, n]) => `${file} ×${n}`);
  assert.deepEqual(twice, [], "these contract parts were read more than once in one doctor call");
  /* The rows the reads answer, so a call that read once by printing less is no pass. */
  assert.match(out, /\[ {2}ok {2}\] contract\s+\S+ states contract 1 — `forge guide contract`/u);
  for (const flow of FLOW_SLUGS) {
    assert.match(out, new RegExp(`\\] flow set\\s+${flow}: ${partsOf(flow).length} part\\(s\\) — `, "u"));
  }
});
