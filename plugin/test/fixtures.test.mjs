/* A leak reads exactly like a clean run — empty directories, a green suite — until a tmpfs runs out
   of inodes. So what a process leaves is counted, inside a directory of this case's own. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tempRoom } from "./fixtures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const FIXTURES = ["plugin/test/fixtures.mjs", "packages/code-quality/test/fixtures/room.js"];
/* The identifier rather than the call, so an alias or the async form is caught too, and the three
   files that state the rule name it as well and are not held to it. */
const RAW = /\bmkdtemp(?:Sync)?\b/u;
const STATED = [...FIXTURES, "plugin/test/fixtures.test.mjs"];

/* Everything the fixture can be asked for, from a process whose whole temporary directory is the
   room handed in, so what it leaves behind is whatever is still in there once it has exited. */
const uses = (fixture) => `
  import { dirtyRepo, homeEnv, tempHome, tempRoom } from "${pathToFileURL(fixture).href}";
  tempRoom("counted-");
  tempHome("counted");
  homeEnv("counted");
  dirtyRepo();
`;

test("a test process removes every directory its fixture made", () => {
  const room = tempRoom("fixture-leavings-");
  const argv = ["--input-type=module", "-e", uses(join(ROOT, FIXTURES[0]))];
  const run = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...process.env, TMPDIR: room } });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  /* Directories only: a stamp is a file, written by the code under test, and is ISS-126's. */
  const left = readdirSync(room, { withFileTypes: true }).filter((one) => one.isDirectory());
  assert.deepEqual(
    left.map((one) => one.name),
    [],
    `a process using the fixture exited leaving ${left.length} directory(ies) behind; each is an inode nothing will free`,
  );
});

test("no test file makes a temporary directory of its own", () => {
  const files = execFileSync("git", ["-C", ROOT, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 8e6 })
    .split("\0")
    .filter((one) => /(?:^|\/)test\/.+\.[cm]?[jt]sx?$/u.test(one) && !STATED.includes(one));
  assert.ok(files.length > 50, `${files.length} test files tracked; the selector matches too little`);
  const found = files.filter((rel) => RAW.test(readFileSync(join(ROOT, rel), "utf8")));
  assert.deepEqual(
    found,
    [],
    `these name mkdtemp themselves, so a directory they make is one nothing removes; take the room from ${FIXTURES.join(" or ")} instead:\n${found.join("\n")}`,
  );
});

test("a root its process never got to remove is swept by the next one", () => {
  const room = tempRoom("fixture-sweep-");
  const dead = spawnSync(process.execPath, ["-e", ""], { encoding: "utf8" });
  const stale = join(room, `forge-plugin-test-${dead.pid}-killed`);
  mkdirSync(join(stale, "what it had made"), { recursive: true });
  const argv = ["--input-type=module", "-e", uses(join(ROOT, FIXTURES[0]))];
  const run = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...process.env, TMPDIR: room } });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(existsSync(stale), false, `${stale} outlived the process that made it and nothing else will free it`);
});
