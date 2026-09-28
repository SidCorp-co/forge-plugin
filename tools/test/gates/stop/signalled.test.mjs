/* A gate stopped by its pid, the way a run has to stop one: it takes the step it is running with it, and
   nothing else, and it says it was stopped. Before, the signal ended the gate alone and the step ran on
   with every worker it had, reparented, writing into a temp root the dying gate was sweeping (ISS-1785). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { escaped, tempRoom } from "../../../../plugin/test/fixtures.mjs";
import { configHome, HANGS_IN, HOLDING, landed, ROOT, RUNNER, run, scratch, SHELL_ENV } from "../scratch.mjs";
import { STEPS } from "../../../gates/steps.mjs";
import { verdictRuns } from "../../../gates/verdict.mjs";

const HELD = "HELD_AT";
const holdAs = (name, before = "") => `node -e "${before}require('fs').writeFileSync(process.env.${HELD}+'/${name}',`
  + `String(process.pid));setInterval(()=>{},1000)"`;

// A grandchild whose parent exits at once, so it is init's before the stop, and then the step's own holder.
const ORPHANING = `(${holdAs("orphan")} &) ; ${holdAs("step")}`;
const DEAF = holdAs("step", "for(const one of ['SIGINT','SIGTERM'])process.on(one,()=>{});");

// A step that exits at once and leaves a process of its own running, carrying that step's marker and nobody's child.
const LEAVES = `(sh -c 'echo $$ > "$${HELD}/leftover"; exec sleep 600' &)`;
const LATER = STEPS.filter((step) => !step.tests).at(-2).label;

const CASE = "plugin/test/tools/two.test.mjs";
// Red in the step, which names its failing-case record, and hanging in the re-run alone, which empties it.
const HANGS_ALONE = `import test from "node:test";
import { writeFileSync } from "node:fs";
test("a case of this scratch's own", async () => {
  if (process.env.GATE_FAILED_CASES) throw new Error("only when the step ran it");
  writeFileSync(process.env.${HELD} + "/rerun", String(process.pid));
  await new Promise(() => setInterval(() => {}, 1000));
});
`;

const stateOf = (pid) => {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    return stat.slice(stat.lastIndexOf(")") + 2)[0];
  } catch {
    return null;
  }
};

const running = (pid) => ![null, "Z"].includes(stateOf(pid));

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

const pidsIn = async (held, names, gate) => {
  for (const until = Date.now() + 240_000; Date.now() < until;) {
    if (names.every((one) => existsSync(join(held, one)))) {
      return Object.fromEntries(names.map((one) => [one, Number(readFileSync(join(held, one), "utf8"))]));
    }
    if (gate.exitCode !== null) throw new Error(`the gate exited ${gate.exitCode} before its step held:\n${gate.said}`);
    await pause(100);
  }
  throw new Error(`the step never held:\n${gate.said}`);
};

/* Under `sh`, which leaves a sibling behind as the gate's own child before it becomes the gate: a process
   the gate started that is not under any step. Its own group, so the cleanup can take everything at once. */
const gateUnder = (work, env) => {
  const sibling = holdAs("sibling");
  const gate = spawn("sh", ["-c", `${sibling} & exec "${process.execPath}" "${join(work, RUNNER)}"`],
    { cwd: work, detached: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...SHELL_ENV, XDG_CONFIG_HOME: configHome(work), ...env } });
  gate.said = "";
  for (const stream of [gate.stdout, gate.stderr]) stream.on("data", (chunk) => { gate.said += chunk; });
  gate.ended = new Promise((done) => gate.once("exit", (code, signal) => done({ code, signal, at: Date.now() })));
  return gate;
};

const cleared = async (gate, at, pids) => {
  try {
    process.kill(-gate.pid, "SIGKILL");
  } catch {
    /* The group is already gone. */
  }
  for (const pid of pids) if (running(pid)) process.kill(pid, "SIGKILL");
  rmSync(at, { recursive: true, force: true });
};

const rooms = (tmp) => readdirSync(tmp).filter((one) => one.startsWith("forge-gate-tmp-"));

const held = (name, marks) => {
  const made = scratch(name, null, null, marks);
  const dirs = { held: join(made.at, "held"), tmp: join(made.at, "tmp") };
  for (const dir of Object.values(dirs)) mkdirSync(dir);
  return { ...made, ...dirs, env: { [HELD]: dirs.held, TMPDIR: dirs.tmp, KEEP_TEST_ROOMS: "" } };
};

test("a gate stopped by its pid takes every process of its step, the orphaned one too, and no other", async () => {
  const { at, work, held: dir, tmp, env } = held("stop-step-", { needing: { step: HANGS_IN, command: ORPHANING } });
  const gate = gateUnder(work, env);
  let pids = {};
  try {
    pids = await pidsIn(dir, ["sibling", "orphan", "step"], gate);
    assert.ok(running(pids.orphan) && running(pids.step), "the step's processes were not running before the stop");
    process.kill(gate.pid, "SIGTERM");
    const { code } = await gate.ended;
    assert.equal(code, 143, gate.said);
    assert.equal(running(pids.step), false, `the step's own process ${pids.step} outlived the gate`);
    assert.equal(running(pids.orphan), false, `the orphaned grandchild ${pids.orphan} outlived the gate`);
    assert.equal(running(pids.sibling), true, `the gate's own child ${pids.sibling}, under no step, was signalled`);
    assert.match(gate.said, new RegExp(`gate verdict: stopped — at the step ${escaped(HANGS_IN)}, `, "u"), gate.said);
    const written = verdictRuns(work).at(-1);
    assert.deepEqual([written.verdict, written.signal, written.step, written.code], ["stopped", "SIGTERM", HANGS_IN, 143]);
    assert.deepEqual(rooms(tmp), [], `the stopped gate left its temp root:\n${gate.said}`);
    const waited = run(work, ["--wait", "1"]);
    assert.equal(waited.status, 143, waited.stdout + waited.stderr);
    assert.match(waited.stdout, new RegExp(`gate verdict: stopped — at the step ${escaped(HANGS_IN)}, `, "u"), waited.stdout);
  } finally {
    await cleared(gate, at, Object.values(pids));
  }
});

test("a gate stopped while it re-runs a failing case alone takes the re-run with it", async () => {
  const { at, work, held: dir, env } = held("stop-rerun-", {});
  landed(work, CASE, HANGS_ALONE);
  landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
  const gate = gateUnder(work, env);
  let pids = {};
  try {
    pids = await pidsIn(dir, ["sibling", "rerun"], gate);
    process.kill(gate.pid, "SIGHUP");
    const { code } = await gate.ended;
    assert.equal(code, 129, gate.said);
    assert.equal(running(pids.rerun), false, `the case re-run alone, ${pids.rerun}, outlived the gate`);
    assert.match(gate.said, /gate verdict: stopped — at the step test, /u, gate.said);
  } finally {
    await cleared(gate, at, Object.values(pids));
  }
});

test("a second stop kills what is left of the step at once rather than waiting it out", async () => {
  const { at, work, held: dir, env } = held("stop-twice-", { needing: { step: HANGS_IN, command: DEAF } });
  const gate = gateUnder(work, env);
  let pids = {};
  try {
    pids = await pidsIn(dir, ["sibling", "step"], gate);
    process.kill(gate.pid, "SIGINT");
    await pause(300);
    assert.equal(running(pids.step), true, "a step deaf to the first signal is already gone, so this proves nothing");
    const second = Date.now();
    process.kill(gate.pid, "SIGINT");
    const { code, at: exited } = await gate.ended;
    assert.equal(code, 130, gate.said);
    assert.ok(exited - second < 4000, `the gate took ${exited - second}ms after the second signal, which is the grace run out`);
    assert.equal(running(pids.step), false, `the deaf step ${pids.step} outlived the gate`);
  } finally {
    await cleared(gate, at, Object.values(pids));
  }
});

test("a stop reaches the step it is running and not what an earlier step left behind", async () => {
  const { at, work, held: dir, env } = held("stop-earlier-",
    { needing: { step: HANGS_IN, command: LEAVES }, hanging: LATER });
  const gate = gateUnder(work, env);
  let pids = {};
  try {
    pids = await pidsIn(dir, ["sibling", "leftover"], gate);
    for (const until = Date.now() + 240_000; !gate.said.includes(HOLDING) && Date.now() < until;) await pause(100);
    assert.ok(gate.said.includes(HOLDING), `the gate never reached ${LATER}:\n${gate.said}`);
    process.kill(gate.pid, "SIGTERM");
    const { code } = await gate.ended;
    assert.equal(code, 143, gate.said);
    assert.match(gate.said, new RegExp(`gate verdict: stopped — at the step ${escaped(LATER)}, `, "u"), gate.said);
    assert.equal(running(pids.leftover), true, `what ${HANGS_IN} left, ${pids.leftover}, was stopped as part of ${LATER}`);
  } finally {
    await cleared(gate, at, Object.values(pids));
  }
});

const SWEPT = join(ROOT, "tools", "gates", "stamp-room.mjs");

test("a temp root the exit cannot remove is named with its route, and the exit code is the process's own", {
  skip: process.getuid?.() === 0 ? "root removes a directory it may not write" : false,
}, () => {
  const tmp = tempRoom("stop-unremovable-");
  const body = `const { gateTmp } = await import("${pathToFileURL(SWEPT).href}");
    const { chmodSync, mkdirSync } = await import("node:fs");
    const dir = gateTmp();
    mkdirSync(dir + "/shut/in", { recursive: true });
    chmodSync(dir + "/shut", 0o500);
    process.stdout.write(dir);
    process.exit(3);`;
  const said = spawnSync(process.execPath, ["--input-type=module", "-e", body],
    { encoding: "utf8", env: { ...SHELL_ENV, TMPDIR: tmp, KEEP_TEST_ROOMS: "" } });
  const dir = said.stdout;
  try {
    assert.equal(said.status, 3, said.stderr);
    assert.ok(said.stderr.includes(`could not remove its temporary root ${dir}: EACCES`), said.stderr);
    assert.ok(said.stderr.includes(`rm -rf ${dir}`), said.stderr);
    assert.doesNotMatch(said.stderr, /node:fs|at process\./u, said.stderr);
  } finally {
    if (dir) chmodSync(join(dir, "shut"), 0o700);
    rmSync(tmp, { recursive: true, force: true });
  }
});
