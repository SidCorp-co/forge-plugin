/* The run fixtures under a machine whose temporary room is spent. Their rooms lived as long as their
   process, and their git and their subject runs were read whatever they answered, so a per-user quota
   several gates shared came back as a worktree with no files and a release red for want of them
   (ISS-2785). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../../plugin/test/fixtures.mjs";
import { roomRefused, roomSpent } from "../../../plugin/test/fixtures/room.mjs";
import { SCRIPT, git, landIn, runIn, setUp } from "./run-fixtures.mjs";
import { gitFailing, noted } from "./room-refusals.mjs";

const QUOTA = "error: unable to write file .git/objects/ab/cdef: Disk quota exceeded";

const FIXTURES = new URL("./run-fixtures.mjs", import.meta.url).href;
const ISOLATED = new URL("../../../plugin/test/fixtures/process/isolated.mjs", import.meta.url).pathname;

/* Two cases in a file of their own, since a room's life is read across the end of the case that made
   it: the second reads what the first left, and the room made at load is the file's. `kept` is a run
   asked to keep its rooms, whose kept root sits inside this process's own and goes with it. */
const pair = (kept) => `import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { scratch } from ${JSON.stringify(FIXTURES)};
const early = scratch("rooms-at-load");
let made = null;
test("a room a case makes stands while that case runs", () => {
  made = scratch("rooms-in-a-case").at;
  assert.ok(existsSync(made), "the room was never made");
});
test("the room the case before made is gone, and the room made at load still stands", () => {
  assert.equal(existsSync(made), ${kept}, \`the room a case made, asked to be kept: ${kept}: \${made}\`);
  assert.ok(existsSync(early.at), \`the file's own room went with a case: \${early.at}\`);
});
`;

const repository = () => {
  const at = tempRoom("rooms-repo-");
  setUp(at, "init", "-q");
  return at;
};

/** A checkout whose run script prints `said` and exits `status`, standing in for a release. */
const scriptSaying = (said, status) => {
  const work = tempRoom("rooms-subject-");
  mkdirSync(join(work, "tools"));
  writeFileSync(join(work, SCRIPT), `process.stderr.write(${JSON.stringify(said)});\nprocess.exit(${status});\n`);
  return work;
};

const refusedWith = (name) => (error) => {
  assert.match(error.message, new RegExp(`Could not make the temporary room at .*: ${name}$`, "mu"), error.message);
  assert.match(error.message, /machine refusing the room, not the tree under test being wrong/u, error.message);
  return true;
};

// Without the context the runner hands its own children, which would report to it rather than print.
const across = (file, over = {}) => {
  const env = { ...process.env, ...over };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ["--test", "--test-reporter=tap", `--import=${ISOLATED}`, file],
    { encoding: "utf8", env });
};

test("a room goes when the case that made it ends, and a room made at load stays for the file", () => {
  const file = join(tempRoom("rooms-across-"), "across.test.mjs");
  writeFileSync(file, pair(false));
  const ran = across(file);
  assert.equal(ran.status, 0, `${ran.stdout}${ran.stderr}`);
  assert.match(ran.stdout, /^# pass 2$/mu, ran.stdout);
});

test("a run asked to keep its rooms keeps the room each case made", () => {
  const file = join(tempRoom("rooms-kept-"), "across.test.mjs");
  writeFileSync(file, pair(true));
  const ran = across(file, { KEEP_TEST_ROOMS: "1" });
  assert.equal(ran.status, 0, `${ran.stdout}${ran.stderr}`);
  assert.match(ran.stdout, /^# pass 2$/mu, ran.stdout);
});

test("a setup git step that fails stops the case, naming the command and quoting git", () => {
  const at = repository();
  assert.throws(() => setUp(at, "rev-parse", "--verify", "no-such-ref"), (error) => {
    assert.match(error.message, /the room this case stands on was not built: git rev-parse --verify no-such-ref in /u);
    assert.match(error.message, /fatal: Needed a single revision/u, error.message);
    return true;
  });
});

test("a fixture builder whose git fails does not go on over the room it left", () => {
  const at = tempRoom("rooms-no-checkout-");
  assert.throws(() => landIn(at, "one.mjs", 1, "a change"), (error) => {
    assert.match(error.message, /not built: git add one\.mjs in /u, error.message);
    assert.match(error.message, /not a git repository/u, error.message);
    return true;
  });
});

test("a git call that fails on a spent room throws the room refusal and leaves the gate its note", () => {
  const at = repository();
  noted((note) => {
    assert.throws(() => gitFailing("commit", QUOTA, () => git(at, "commit", "-m", "x")), refusedWith("EDQUOT"));
    assert.match(roomRefused(note)?.said ?? "", /: EDQUOT$/mu, "the gate was left no note");
    assert.match(roomRefused(note).said, /git commit reported it as: .*Disk quota exceeded/u, roomRefused(note).said);
  });
});

test("a release that fails on a spent room throws the room refusal and leaves the gate its note", () => {
  const work = scriptSaying("npm error code UNKNOWN\nnpm error syscall write\nnpm error errno -122\n", 1);
  noted((note) => {
    assert.throws(() => runIn(work, ["ship"]), refusedWith("EDQUOT"));
    assert.equal(roomRefused(note)?.times, 1, "the gate was left no note");
  });
});

test("a release that exits zero, or fails on no spent room, comes back as it was", () => {
  noted((note) => {
    const green = runIn(scriptSaying("ENOSPC and Disk quota exceeded, said by a release that finished\n", 0), ["ship"]);
    assert.equal(green.status, 0);
    assert.match(green.stderr, /said by a release that finished/u);
    const red = runIn(scriptSaying("expected -28, received -122\n", 1), ["ship"]);
    assert.equal(red.status, 1, "a failing release was not handed back");
    assert.match(red.stderr, /expected -28/u);
    assert.equal(roomRefused(note), null, "a release that judged something was noted as a refusal");
  });
});

test("a spent room is read off a failed child in every form it is reported in, and off no other child", () => {
  const failed = (said) => ({ status: 1, stdout: "", stderr: said });
  assert.equal(roomSpent(failed("fatal: write error: No space left on device")), "ENOSPC");
  assert.equal(roomSpent(failed("Error: EDQUOT: quota, write")), "EDQUOT");
  assert.equal(roomSpent(failed("npm error errno -28")), "ENOSPC");
  assert.equal(roomSpent(failed("errno: -122")), "EDQUOT");
  assert.equal(roomSpent(failed("Unknown system error -122: Unknown system error -122, write")), "EDQUOT");
  assert.equal(roomSpent({ status: null, stdout: "", stderr: "", error: Object.assign(new Error("spawnSync git"), { code: "ENOSPC" }) }), "ENOSPC");
  assert.equal(roomSpent({ status: null, stdout: "", stderr: "", error: Object.assign(new Error("spawnSync git"), { errno: -122 }) }), "EDQUOT");
  assert.equal(roomSpent(failed("expected -28, received -122")), null, "a bare number was read as an errno");
  assert.equal(roomSpent(failed("fatal: Permission denied")), null, "a permission refusal was read as a spent room");
  assert.equal(roomSpent({ status: 0, stdout: "EDQUOT", stderr: "No space left on device" }), null,
    "a child that exited zero was read as refused");
});

test("a write the filesystem refuses inside landIn is the room refusal, not node's bare error", () => {
  const at = repository();
  const shut = join(at, "shut");
  mkdirSync(shut, { mode: 0o500 });
  try {
    noted(() => assert.throws(() => landIn(at, join("shut", "one.mjs"), 1, "a change"), refusedWith("EACCES")));
  } finally {
    chmodSync(shut, 0o700);
  }
});
