/* A per-user quota on a `usrquota` tmpfs refused a fixture's write and reached the run as `UNKNOWN:
   unknown error, write` with no path, under a gate line that said no failing case could be named —
   so six sightings were read as flaky cases and one as the tree being broken (ISS-1611). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { escaped, tempRoom } from "../fixtures.mjs";
import { landed, run, scratch } from "./gates/scratch.mjs";
import { forgetRoomRefusal, madeIn, roomRefused, roomRefusal, ROOM_ENV } from "../../../tools/room.mjs";
import { roomPath, runKey } from "../../../tools/gates/timing.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FIXTURES = join(ROOT, "plugin", "test", "fixtures.mjs");

/* What node hands a run when libuv has no name for the answer: the code it could not resolve, the
   number it could, and a message with no path in it because the write failed on a descriptor. */
const QUOTA = Object.assign(new Error("UNKNOWN: unknown error, write"),
  { code: "UNKNOWN", errno: -122, syscall: "write" });

// Not this user's to write in, which is the one filesystem refusal a case can provoke on any box.
const shut = (name) => {
  const at = join(tempRoom(name), "shut");
  mkdirSync(at, { mode: 0o500 });
  return at;
};

const openAgain = (at) => {
  chmodSync(at, 0o700);
  rmSync(at, { recursive: true, force: true });
};

const imports = (body) => `import("${FIXTURES}").then(async (made) => { ${body} });`;

const withEnv = (over) => {
  const env = { ...process.env, ...over };
  for (const [key, value] of Object.entries(over)) if (value === null) delete env[key];
  return env;
};

const ranNode = (body, over) =>
  spawnSync(process.execPath, ["--input-type=module", "-e", imports(body)],
    { encoding: "utf8", env: withEnv(over), cwd: ROOT });

/* Every refusal below is provoked on purpose, and this suite runs under a gate whose own channel it
   would otherwise write to — one deliberate refusal would then read as the machine having refused
   the real step its room, and the gate would attribute somebody else's failure to this box. */
const apart = (name, use) => {
  const was = process.env[ROOM_ENV];
  const note = join(tempRoom(name), "room");
  process.env[ROOM_ENV] = note;
  try {
    return use(note);
  } finally {
    if (was === undefined) delete process.env[ROOM_ENV];
    else process.env[ROOM_ENV] = was;
  }
};

// `assert.throws` answers with nothing, and every case here is about what the refusal said.
const thrown = (build) => {
  try {
    build();
  } catch (error) {
    return error;
  }
  return assert.fail("nothing was thrown");
};

test("an errno the runtime cannot name is decoded to the platform's own name for it", () => {
  const said = roomRefusal(QUOTA, "/tmp/room");
  assert.match(said, /: EDQUOT$/mu, said);
  assert.match(said, /EDQUOT means this user's quota on that filesystem is spent/u, said);
  assert.match(said, /df and df -i\s+both read healthy while it is/u, said);
  assert.match(said, /node reported it as: UNKNOWN: unknown error, write/u, said);
});

test("a room that cannot be made names the path it tried, the TMPDIR in force and the way out", () => {
  const at = shut("refused-room-");
  try {
    const refused = apart("refused-room-note-",
      () => thrown(() => madeIn(join(at, "room-"), () => mkdirSync(join(at, "room-")))));
    assert.match(refused.message, new RegExp(`Could not make the temporary room at ${escaped(at)}/room-: EACCES`, "u"),
      refused.message);
    assert.match(refused.message, new RegExp(`TMPDIR in force: ${escaped(process.env.TMPDIR)}$`, "mu"), refused.message);
    assert.match(refused.message, /machine refusing the room, not the tree under test being wrong/u, refused.message);
    assert.match(refused.message, /Point TMPDIR at a filesystem with room to spare/u, refused.message);
    assert.equal(refused.cause.code, "EACCES", "the refusal node threw is kept under the one this reads");
  } finally {
    openAgain(at);
  }
});

test("a throw that is not the filesystem's reaches the run exactly as it was thrown", () => {
  const own = new Error("this fixture's own assertion");
  const back = thrown(() => madeIn("/tmp/room", () => {
    throw own;
  }));
  assert.equal(back, own, "a fixture's own failure was rewritten as a machine refusal");
});

test("the refusal is left where the gate reads it, and is forgotten on demand", () => {
  const at = shut("refused-noted-");
  try {
    apart("refused-note-", (note) => {
      for (const each of [1, 2]) {
        thrown(() => madeIn(join(at, `room-${each}`), () => mkdirSync(join(at, `room-${each}`))));
      }
      const read = roomRefused(note);
      assert.equal(read.times, 2, "each refusal is one entry");
      assert.match(read.said, /Could not make the temporary room at .*room-1: EACCES/u, read.said);
      forgetRoomRefusal(note);
      assert.equal(roomRefused(note), null, "a forgotten note still read");
    });
  } finally {
    openAgain(at);
  }
});

test("a fixture handed a TMPDIR it cannot write in says so instead of an unknown error", () => {
  const at = shut("refused-fixture-");
  try {
    const said = ranNode("made;", { TMPDIR: at, [ROOM_ENV]: join(tempRoom("refused-fixture-note-"), "room") });
    assert.equal(said.status, 1, said.stdout + said.stderr);
    assert.match(said.stderr, new RegExp(`Could not make the temporary room at ${escaped(at)}/forge-plugin-test-`, "u"),
      said.stderr);
    assert.match(said.stderr, new RegExp(`TMPDIR in force: ${escaped(at)}$`, "mu"), said.stderr);
    assert.match(said.stderr, /Point TMPDIR at a filesystem with room to spare/u, said.stderr);
    assert.ok(!said.stderr.includes("UNKNOWN: unknown error"), said.stderr);
  } finally {
    openAgain(at);
  }
});

test("a fixture given no TMPDIR still makes its rooms under the platform's temporary directory", () => {
  const none = { TMPDIR: null, TMP: null, TEMP: null };
  /* Asked of a process with the same environment, because this suite's own TMPDIR is the root
     `fixtures.mjs` pointed it at, and `tmpdir()` here would answer with that. */
  const machine = spawnSync(process.execPath, ["-p", "require('node:os').tmpdir()"],
    { encoding: "utf8", env: withEnv(none) }).stdout.trim();
  const said = ranNode("process.stdout.write(made.tempRoom('where-'));", none);
  assert.equal(said.status, 0, said.stdout + said.stderr);
  assert.ok(said.stdout.startsWith(`${machine}/forge-plugin-test-`), `${said.stdout} is not under ${machine}`);
});

test("two gates sharing one record directory get a note each, not one between them", () => {
  const dir = tempRoom("refused-two-runs-");
  const mine = roomPath(dir, "test", runKey("/checkouts/wt-ISS-1611", 11));
  const other = roomPath(dir, "test", runKey("/checkouts/wt-ISS-1593", 11));
  const again = roomPath(dir, "test", runKey("/checkouts/wt-ISS-1611", 22));
  for (const [what, theirs] of [["worktree", other], ["gate of one worktree", again]]) {
    assert.notEqual(mine, theirs, `a second ${what} would erase this run's refusal, or be read as it`);
  }
  assert.equal(dirname(mine), dir, "a note outside the record directory is one a full disk loses");
});

/* The case body a scratch checkout runs: the real wrapper, refused by a directory of its own, which
   is the whole chain from a fixture's room to what the gate prints. */
const REFUSES_A_ROOM = `import test from "node:test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { madeIn } from "../../../tools/room.mjs";
test("a case of this scratch's own", () => {
  const under = join(tmpdir(), \`scratch-refused-\${process.pid}\`);
  mkdirSync(under, { recursive: true });
  const shut = join(under, "shut");
  mkdirSync(shut, { mode: 0o500 });
  madeIn(join(shut, "room-"), () => mkdirSync(join(shut, "room-")));
});
`;

test("a test step whose fixture was refused a room says the machine did it, not the tree", () => {
  const { at, work } = scratch("refused-gate-");
  try {
    landed(work, "plugin/test/tools/two.test.mjs", REFUSES_A_ROOM);
    const said = run(work, [], work, { [ROOM_ENV]: join(tempRoom("refused-gate-note-"), "room") });
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, new RegExp(`Gate failed: test — the machine refused a fixture its temporary `
      + `room \\d+ time\\(s\\), so this step judged nothing about the tree: ${escaped(work)}`, "u"), said.stderr);
    assert.match(said.stderr, /Could not make the temporary room at .*: EACCES/u, said.stderr);
    assert.ok(!said.stderr.includes("no failing case was named"), said.stderr);
    assert.ok(!said.stdout.includes("=== isolation:"), `a case was re-run on a machine with no room:\n${said.stdout}`);
    assert.match(readdirSync(join(work, ".git", "gate-ledger")).join(" "), /(?<= |^)test-room\./u,
      "the note went somewhere other than the record directory, so a full filesystem would lose it");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a gate that cannot make its own temporary root refuses before any step runs", () => {
  const { at, work } = scratch("refused-root-");
  const blocked = join(at, "blocked");
  try {
    mkdirSync(blocked, { mode: 0o500 });
    const said = run(work, [], work,
      { TMPDIR: blocked, [ROOM_ENV]: join(tempRoom("refused-root-note-"), "room") });
    assert.equal(said.status, 1, said.stdout + said.stderr);
    assert.match(said.stderr,
      new RegExp(`Could not make the temporary room at ${escaped(blocked)}/forge-gate-tmp-: EACCES`, "u"), said.stderr);
    assert.match(said.stderr,
      new RegExp(`No step ran and nothing was recorded, so nothing here judges ${escaped(work)}`, "u"), said.stderr);
    assert.ok(!said.stdout.includes("=== lint ==="), `a step ran with no room to run it in:\n${said.stdout}`);
  } finally {
    chmodSync(blocked, 0o700);
    rmSync(at, { recursive: true, force: true });
  }
});
