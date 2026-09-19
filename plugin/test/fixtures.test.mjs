/* A leak reads exactly like a clean run — empty directories, a green suite — until a tmpfs runs out
   of inodes. So what a process leaves is counted, inside a directory of this case's own. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fakeTracker, tempRoom } from "./fixtures.mjs";

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
  const files = execFileSync("git", ["-C", ROOT, "ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 8e6 })
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
  assert.ok(run.stderr.includes(`${room}/${left[0]}`),
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
  assert.ok(run.stderr.includes(run.stdout),
    `the kept root's path was never printed, so what a step left in it is unreadable: ${run.stderr || "(silent)"}`);
});

/* Pointing a run's configuration somewhere of its own leaves it on the developer's `~/.claude` and
   `~/.local/bin`, which is where the gateway profile, the install record and the links a session
   start writes all live. So the environment the fixture hands out names a home too (ISS-1425). */
const handsOut = (fixture) => `
  import { homeEnv } from "${pathToFileURL(fixture).href}";
  const env = homeEnv("borrowed");
  process.stdout.write(JSON.stringify([env.HOME, env.XDG_CONFIG_HOME]));
`;

test("the environment the fixture hands out names a home of the run's own", () => {
  const room = tempRoom("fixture-home-");
  const theirs = join(room, "somebody-elses-home");
  mkdirSync(theirs, { recursive: true });
  const argv = ["--input-type=module", "-e", handsOut(join(ROOT, FIXTURES[0]))];
  const run = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...WITHOUT, TMPDIR: room, HOME: theirs } });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const [home, config] = JSON.parse(run.stdout);
  assert.notEqual(home, theirs,
    "the fixture handed a child the home it was started under, so everything that child reads under `~` is the developer's");
  assert.match(home, /\/forge-plugin-test-\d+-[^/]+\//u, `the home it handed out is outside the root it removes: ${home}`);
  assert.equal(config, home, "the config home and the home are one room, so a leak is one directory to look in");
});

/* A home-rooted path built into a module constant is resolved at import, so no caller can move it
   afterwards and no test can vary it. These two hold the install record; `resolve/config.mjs` is the
   shape that was already right. Read at the call, a `HOME` set after the import reaches them. */
const READERS = ["plugin/src/tools/plugin-copy.mjs", "plugin/src/stats/versions.mjs"];

const afterImport = (home) => `
  const copy = await import("${pathToFileURL(join(ROOT, READERS[0])).href}");
  const versions = await import("${pathToFileURL(join(ROOT, READERS[1])).href}");
  process.env.HOME = ${JSON.stringify(home)};
  process.stdout.write(JSON.stringify([copy.installedPaths(), versions.cacheRoot()]));
`;

test("a home-rooted path is read from the home the process holds, not the one it was imported under", () => {
  const room = tempRoom("fixture-record-");
  const started = join(room, "home-at-import");
  const later = join(room, "home-at-the-call");
  const installed = join(later, "cache", "forge", "9.9.9");
  mkdirSync(started, { recursive: true });
  mkdirSync(join(later, ".claude", "plugins"), { recursive: true });
  writeFileSync(join(later, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({
    version: 2,
    plugins: { "forge@forge-local": [{ scope: "user", version: "9.9.9", installPath: installed, lastUpdated: "2026-01-01T00:00:00.000Z" }] },
  }));
  const argv = ["--input-type=module", "-e", afterImport(later)];
  const run = spawnSync(process.execPath, argv, { encoding: "utf8", env: { ...WITHOUT, TMPDIR: room, HOME: started } });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(JSON.parse(run.stdout), [[installed], join(later, "cache", "forge")],
    `${READERS.join(" and ")} answered about the home they were imported under, so nothing a caller sets afterwards can move them`);
});

/* A handler says the call failed by answering `refused`, `http` or `notARecord`, and the request
   handler branches on exactly those three. A route that pages, projects or defaults that answer
   served the wrapper instead, so a case saying the tracker refused was handed a 200 with no rows —
   an empty backlog, an empty attachment list, no blockers — and could not fail (ISS-618). One
   request per route row, with every tool failing, is what holds that seam in place. */
const TOOLS = [
  "forge_issues", "forge_uploads", "forge_comments", "forge_knowledge", "forge_memory.search",
  "forge_guide", "forge_project_pm", "forge_config", "forge_projects.list", "forge_projects.create",
  "forge_projects.update", "forge_projects.read", "forge_projects.get", "forge_projects.archive",
  "forge_projects.unarchive",
];

const failing = (answer) => Object.fromEntries(TOOLS.map((name) => [name, () => ({ ...answer })]));

/* One request per row of the fixture's own route table, in its order; the first case below refuses
   a row nothing here reaches. */
const PROBES = [
  ["GET", "/api/projects/p1/issues/search?q=x"],
  ["GET", "/api/projects/p1/issues"],
  ["POST", "/api/projects/p1/issues"],
  ["DELETE", "/api/issues/u1/dependencies/e1"],
  ["GET", "/api/issues/u1/dependencies"],
  ["POST", "/api/issues/u1/dependencies"],
  ["GET", "/api/issues/u1/attachments"],
  ["POST", "/api/comments/c1/attachments"],
  ["GET", "/api/issues/u1/comments"],
  ["POST", "/api/issues/u1/comments"],
  ["POST", "/api/issues/u1/transition"],
  ["POST", "/api/issues/u1/merge"],
  ["GET", "/api/issues/u1"],
  ["PATCH", "/api/issues/u1"],
  ["GET", "/api/projects/p1/knowledge/slug1"],
  ["GET", "/api/projects/p1/knowledge"],
  ["POST", "/api/memory/search"],
  ["GET", "/api/guides/g1"],
  ["GET", "/api/guides"],
  ["GET", "/api/projects/p1/pm/runner-load"],
  ["GET", "/api/projects/p1/pipeline-config"],
  ["GET", "/api/projects/p1/project-facts"],
  ["POST", "/api/projects/p1/archive"],
  ["GET", "/api/projects/p1"],
  ["PATCH", "/api/projects/p1"],
  ["GET", "/api/projects"],
];

const asked = async (server, [method, path]) => {
  const sent = method === "GET" || method === "DELETE"
    ? { method }
    : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ probe: true }) };
  const got = await fetch(server.url.replace(/\/mcp$/u, "") + path, sent);
  return { status: got.status, text: await got.text() };
};

/* Every probe against a tracker whose every handler failed, and what came back that `reads` will
   not take as that failure reaching the caller. */
const swallowedBy = async (answer, reads) => {
  const server = await fakeTracker({ answer: failing(answer) });
  const out = [];
  for (const probe of PROBES) {
    const got = await asked(server, probe);
    if (!reads(got)) out.push(`${probe[0]} ${probe[1]} -> ${got.status} ${got.text.slice(0, 70)}`);
  }
  server.close();
  return out;
};

test("every route of the fake tracker is asked what it does with a handler that failed", async () => {
  const server = await fakeTracker({});
  server.close();
  const reached = new Set(PROBES.map(([, path]) =>
    server.routes.findIndex((source) => new RegExp(source, "u").test(path.split("?")[0]))));
  const missed = server.routes.filter((source, at) => !reached.has(at));
  assert.deepEqual(missed, [], `${missed.length} route row(s) of ${FIXTURES[0]} that no probe in this file reaches: `
    + `${missed.join(", ")}. Add one request per row to PROBES, or a route ships never having answered a refusal.`);
});

test("a refusal reaches the caller whichever route the handler refused on", async () => {
  const swallowed = await swallowedBy({ refused: "the handler refused", code: "FORBIDDEN" },
    (got) => got.status === 400 && got.text.includes("the handler refused"));
  assert.deepEqual(swallowed, [], `${swallowed.length} route(s) served their own body over a handler's refusal, `
    + `which a caller reads as a tracker holding nothing: ${swallowed.join("; ")}`);
});

test("a transport failure reaches the caller whichever route the handler failed on", async () => {
  const swallowed = await swallowedBy({ http: 502 }, (got) => got.status === 502);
  assert.deepEqual(swallowed, [], `${swallowed.length} route(s) answered 200 over a handler's transport failure, `
    + `so no case on them can tell a read that failed from a read that found nothing: ${swallowed.join("; ")}`);
});

test("a 200 that is not a record reaches the caller whichever route answered it", async () => {
  const swallowed = await swallowedBy({ notARecord: "<html>502</html>" },
    (got) => got.status === 200 && got.text === "<html>502</html>");
  assert.deepEqual(swallowed, [], `${swallowed.length} route(s) built a JSON envelope out of a body that is not a `
    + `record, which reads as the tracker answering: ${swallowed.join("; ")}`);
});
