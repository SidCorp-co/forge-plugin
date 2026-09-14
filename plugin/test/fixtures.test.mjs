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
const STAMPS = "plugin/src/hooks/stamps.mjs";
const GATE_ROOM = "tools/gates/stamp-room.mjs";
/* The identifier rather than the call, so an alias or the async form is caught too, and the three
   files that state the rule name it as well and are not held to it. */
const RAW = /\bmkdtemp(?:Sync)?\b/u;
const STATED = [...FIXTURES, "plugin/test/fixtures.test.mjs"];
const KEEP = "KEEP_TEST_ROOMS";
/* A case about the default states the default: a suite the developer started under the flag would
   otherwise hand it to every child here, which keeps a room and reads as the leak this counts. */
const WITHOUT = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== KEEP));

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
  const run = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...WITHOUT, TMPDIR: room } });
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

/* A gate resolves its stamp room per call under `tmpdir()`, so a test leaving `TMPDIR` alone writes
   a file per session per subject into the room every hook on the machine reaps before every stamp of
   its own (ISS-361). A child spawned with the fixture's environment inherits the room it made. */
const stamps = (fixture) => `
  import "${pathToFileURL(fixture).href}";
  const { askedAlready, stampRoom } = await import("${pathToFileURL(join(ROOT, STAMPS)).href}");
  askedAlready({ session_id: "one" }, "/w/a.md", "learning-gate");
  process.stdout.write(stampRoom());
`;

test("a gate a test process fires stamps inside that process's own root", () => {
  const room = tempRoom("fixture-stamps-");
  const argv = ["--input-type=module", "-e", stamps(join(ROOT, FIXTURES[0]))];
  const run = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...WITHOUT, TMPDIR: room } });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /\/forge-plugin-test-\d+-[^/]+\/forge-hook-stamps-/u, "the room is under the root it removes");
  assert.deepEqual(
    readdirSync(room).filter((name) => name.startsWith("forge-hook-stamps-")),
    [],
    `a test process stamped into ${room}, which on a machine is the room every hook reaps before every stamp`,
  );
});

test("a root its process never got to remove is swept by the next one", () => {
  const room = tempRoom("fixture-sweep-");
  const dead = spawnSync(process.execPath, ["-e", ""], { encoding: "utf8" });
  const stale = join(room, `forge-plugin-test-${dead.pid}-killed`);
  mkdirSync(join(stale, "what it had made"), { recursive: true });
  const argv = ["--input-type=module", "-e", uses(join(ROOT, FIXTURES[0]))];
  const run = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...WITHOUT, TMPDIR: room } });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(existsSync(stale), false, `${stale} outlived the process that made it and nothing else will free it`);
});

test("a room the flag asked to keep is still there once its process has gone, at the path it printed", () => {
  const room = tempRoom("fixture-kept-");
  const argv = ["--input-type=module", "-e", uses(join(ROOT, FIXTURES[0]))];
  const run = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...WITHOUT, TMPDIR: room, [KEEP]: "1" } });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const left = readdirSync(room, { withFileTypes: true }).filter((one) => one.isDirectory()).map((one) => one.name);
  assert.deepEqual(left.length, 1, `asked to keep its room, the process left ${left.length}: ${left.join(", ") || "nothing"}`);
  assert.match(run.stderr, new RegExp(`${room}/${left[0]}`, "u"),
    `the kept room's path was never printed, so the room is a leak nobody can find: ${run.stderr || "(silent)"}`);
});

test("a kept room is not taken by the sweep of the next process to ask for one", () => {
  const room = tempRoom("fixture-kept-sweep-");
  const argv = ["--input-type=module", "-e", uses(join(ROOT, FIXTURES[0]))];
  const keeper = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...WITHOUT, TMPDIR: room, [KEEP]: "1" } });
  assert.equal(keeper.status, 0, `${keeper.stdout}${keeper.stderr}`);
  const kept = readdirSync(room);
  assert.equal(kept.length, 1, `the keeper left ${kept.length} entries, so what this case asserts on is not the kept room`);
  const after = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...WITHOUT, TMPDIR: room } });
  assert.equal(after.status, 0, `${after.stdout}${after.stderr}`);
  assert.deepEqual(readdirSync(room), kept,
    `a later process swept a room that was kept on purpose, and nothing will ever put it back`);
});

/* The gate hands its own root to every step as `TMPDIR`, so it is the ancestor of every room the
   fixtures above make: sparing a room while that root goes would print a path to nothing. Its
   removal is an exit handler, so a child is what proves either way — this process is not exiting. */
const gateRoot = (fixture) => `
  const { gateTmp } = await import("${pathToFileURL(fixture).href}");
  process.stdout.write(gateTmp());
`;

const gateRootIn = (room, env) =>
  spawnSync(process.execPath, ["--input-type=module", "-e", gateRoot(join(ROOT, GATE_ROOM))],
    { encoding: "utf8", env: { ...WITHOUT, TMPDIR: room, ...env } });

test("the gate's own temp root goes when the gate process that made it goes", () => {
  const room = tempRoom("gate-root-");
  const run = gateRootIn(room, {});
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(existsSync(run.stdout), false, `${run.stdout} outlived the gate that made it, and nothing sweeps one`);
});

test("a gate root the flag asked to keep outlives its process, at the path it printed", () => {
  const room = tempRoom("gate-root-kept-");
  const run = gateRootIn(room, { [KEEP]: "1" });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(existsSync(run.stdout), true,
    `the gate root was taken anyway, so every room kept under it went with it: ${run.stdout}`);
  assert.match(run.stderr, new RegExp(run.stdout, "u"),
    `the kept root's path was never printed, so what a step left in it is unreadable: ${run.stderr || "(silent)"}`);
});
