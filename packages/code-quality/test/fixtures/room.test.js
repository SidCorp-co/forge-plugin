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

/* A leak reads like a clean run until a tmpfs runs out of inodes, so a run's leavings are counted:
   a child whose whole temporary directory is one room, and what is left in it once it exits. */
test("a test process removes every directory the fixture made", () => {
  const room = tempRoom("room leavings ");
  const argv = ["--input-type=module", "-e", USES];
  const run = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...process.env, TMPDIR: room } });
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
    env: { ...process.env, TMPDIR: room },
  });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(existsSync(stale), false, `${stale} outlived the process that made it and nothing else will free it`);
});
