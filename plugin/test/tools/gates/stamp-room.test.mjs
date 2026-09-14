/* The gate hands its own root to every step as `TMPDIR`, so a room a fixture keeps inside it is
   still taken when the gate goes — the one cleanup that reaches a kept room without reading its
   name. A child is what proves it: the removal is an exit handler, and this process is not exiting. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { tempRoom } from "../../fixtures.mjs";

const MODULE = pathToFileURL(join(process.cwd(), "tools", "gates", "stamp-room.mjs")).href;
const KEEP = "KEEP_TEST_ROOMS";
const WITHOUT = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== KEEP));

/* The path goes out on stdout because the flag's own notice goes to stderr, and this case reads both. */
const MAKES = `
  const { gateTmp } = await import("${MODULE}");
  process.stdout.write(gateTmp());
`;

const madeIn = (room, env = {}) =>
  spawnSync(process.execPath, ["--input-type=module", "-e", MAKES], {
    encoding: "utf8",
    env: { ...WITHOUT, TMPDIR: room, ...env },
  });

test("the gate's temp root goes when the process that made it goes", () => {
  const room = tempRoom("gate-root-");
  const run = madeIn(room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(existsSync(run.stdout), false, `${run.stdout} outlived the gate that made it, and nothing sweeps one`);
  assert.deepEqual(readdirSync(room), [], `the gate left ${readdirSync(room).join(", ")} in the root it was given`);
});

test("a gate root the flag asked to keep outlives its process, at the path it printed", () => {
  const room = tempRoom("gate-root-kept-");
  const run = madeIn(room, { [KEEP]: "1" });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(existsSync(run.stdout), true,
    `the gate root was taken anyway, so every room kept under it went with it: ${run.stdout}`);
  assert.match(run.stderr, new RegExp(run.stdout, "u"),
    `the kept root's path was never printed, so what a step left in it is unreadable: ${run.stderr || "(silent)"}`);
});
