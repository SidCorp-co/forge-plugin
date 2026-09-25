/* A builtin's function replaced on its default object and synced reaches a module that imported it by
   name, under the gate's read audit exactly as without it. The audit resolves those imports to a shim
   of its own, and a shim the runtime's sync does not reach made one case red in every gate and green
   in every run of it alone (ISS-2419). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { auditEnv } from "../../../gates/reads/sets.mjs";
import { write } from "../scratch.mjs";
import { tempRoom } from "../../../../plugin/test/fixtures.mjs";

const READ = "plugin/src/read-me.md";

// A module of the checkout's own, so the audit resolves its import to the shim.
const READER = `import { readFileSync } from "node:fs";
export const read = (path) => readFileSync(path, "utf8");
`;

const SCRIPT = `import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { read } from "./plugin/src/reader.mjs";
const original = fs.readFileSync;
fs.readFileSync = () => "replaced";
syncBuiltinESMExports();
const replaced = read(${JSON.stringify(READ)});
fs.readFileSync = original;
syncBuiltinESMExports();
console.log(JSON.stringify({ replaced, restored: read(${JSON.stringify(READ)}) }));
`;

const ran = (env) => {
  const at = tempRoom("gate-synced-");
  const root = join(at, "checkout");
  const out = join(at, "out");
  mkdirSync(out, { recursive: true });
  write(root, READ, "the file\n");
  write(root, "plugin/src/reader.mjs", READER);
  write(root, "ran.mjs", SCRIPT);
  const said = spawnSync(process.execPath, [join(root, "ran.mjs")],
    { cwd: root, encoding: "utf8", env: { ...process.env, ...env(out, root) } });
  const records = readdirSync(out).map((one) => JSON.parse(readFileSync(join(out, one), "utf8")));
  rmSync(at, { recursive: true, force: true });
  assert.equal(said.status, 0, said.stderr);
  return { ...JSON.parse(said.stdout), records };
};

test("a function replaced on a builtin's default object and synced reaches a by-name importer under the audit", () => {
  const plain = ran(() => ({}));
  assert.deepEqual([plain.replaced, plain.restored], ["replaced", "the file\n"], "the runtime alone, which the audit stands in for");
  const audited = ran(auditEnv);
  assert.equal(audited.replaced, "replaced", "criterion 1: the by-name import calls the replacement once synced");
  assert.equal(audited.restored, "the file\n", "criterion 2: the original put back and synced is called again");
  assert.equal(audited.records.length, 1, JSON.stringify(audited.records));
  assert.ok(audited.records[0].paths.includes(READ),
    `criterion 3: the restored read is the audit's own and records ${READ}, not in ${audited.records[0].paths.join(" ")}`);
});
