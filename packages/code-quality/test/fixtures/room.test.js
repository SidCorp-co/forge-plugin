import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tempRoom } from "./room.js";

const HELPER = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "room.js")).href;
const USES = `
  import { tempRoom } from "${HELPER}";
  tempRoom("counted ");
  tempRoom("counted again ");
`;
const KEEP = "KEEP_TEST_ROOMS";
/* A case about the default states the default: a suite the developer started under the flag would
   otherwise hand it to every child here, which keeps a room and reads as the leak this counts. */
const WITHOUT = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== KEEP));

/* A leak reads like a clean run until a tmpfs runs out of inodes, so a run's leavings are counted:
   a child whose whole temporary directory is one room, and what is left in it once it exits. */
test("a test process removes every directory the fixture made", () => {
  const room = tempRoom("room leavings ");
  const argv = ["--input-type=module", "-e", USES];
  const run = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...WITHOUT, TMPDIR: room } });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const left = readdirSync(room, { withFileTypes: true }).filter((one) => one.isDirectory());
  assert.deepEqual(
    left.map((one) => one.name),
    [],
    `a process using the fixture exited leaving ${left.length} directory(ies) behind; each is an inode nothing will free`,
  );
});

test("a root its process never got to remove is swept by the next one", () => {
  const room = tempRoom("room sweep ");
  const dead = spawnSync(process.execPath, ["-e", ""], { encoding: "utf8" });
  const stale = path.join(room, `code-quality-test-${dead.pid}-killed`);
  mkdirSync(path.join(stale, "what it had made"), { recursive: true });
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", USES], {
    encoding: "utf8",
    env: { ...WITHOUT, TMPDIR: room },
  });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(existsSync(stale), false, `${stale} outlived the process that made it and nothing else will free it`);
});

const asked = (room, env) =>
  spawnSync(process.execPath, ["--input-type=module", "-e", USES], {
    encoding: "utf8",
    env: { ...WITHOUT, TMPDIR: room, ...env },
  });

test("a room the flag asked to keep is still there once its process has gone, at the path it printed", () => {
  const room = tempRoom("room kept ");
  const run = asked(room, { [KEEP]: "1" });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const left = readdirSync(room, { withFileTypes: true }).filter((one) => one.isDirectory()).map((one) => one.name);
  assert.equal(left.length, 1, `asked to keep its room, the process left ${left.length}: ${left.join(", ") || "nothing"}`);
  assert.ok(run.stderr.includes(`${room}/${left[0]}`),
    `the kept room's path was never printed, so the room is a leak nobody can find: ${run.stderr || "(silent)"}`);
});

test("a kept room is not taken by the sweep of the next process to ask for one", () => {
  const room = tempRoom("room kept sweep ");
  const keeper = asked(room, { [KEEP]: "1" });
  assert.equal(keeper.status, 0, `${keeper.stdout}${keeper.stderr}`);
  const kept = readdirSync(room);
  assert.equal(kept.length, 1, `the keeper left ${kept.length} entries, so what this case asserts on is not the kept room`);
  const after = asked(room, {});
  assert.equal(after.status, 0, `${after.stdout}${after.stderr}`);
  assert.deepEqual(readdirSync(room), kept,
    `a later process swept a room that was kept on purpose, and nothing will ever put it back`);
});
