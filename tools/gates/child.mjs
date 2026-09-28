/* A step spawned and awaited, and a stop that takes it along. A gate blocked in `spawnSync` hears no
   signal: the default action ends the gate alone, and the step is reparented and runs on with every
   test worker it has (ISS-1785). The step keeps the gate's process group, so a caller that kills that
   group with SIGKILL, which nothing can catch, still takes it; a stop therefore cannot signal a group
   and reaches the step's processes one by one — found by parent, and by a marker in the environment
   every one of them inherits, which is what still finds a descendant whose parent exited first. */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { constants } from "node:os";
import { join } from "node:path";

import { PROC, startedAt } from "./machine.mjs";

const STOPS = ["SIGINT", "SIGTERM", "SIGHUP"];

// Named in each step's environment, with a value no other step holds, of this gate run or any other.
const MARK_ENV = "FORGE_GATE_STEP";

const GRACE_MS = 5000;
const KILLED_MS = 2000;
const TICK_MS = 50;


const read = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

// Past the command name, which may hold `)` and spaces: the state is the first field, the parent the second.
const fieldsOf = (stat) => stat.slice(stat.lastIndexOf(")") + 2).split(" ");

/** Every process of this step in the table as it stands, pid to start tick: the roots, what descends from any
 *  process already known by parent, and whatever carries the step's marker. Empty where there is no table. */
const stepProcesses = (roots, known, mark, proc = PROC) => {
  let names;
  try {
    names = readdirSync(proc).filter((one) => /^\d+$/u.test(one));
  } catch {
    return new Map();
  }
  const rows = [];
  for (const name of names) {
    const stat = read(join(proc, name, "stat"));
    if (stat) rows.push({ pid: Number(name), stat, parent: Number(fieldsOf(stat)[1]) });
  }
  const found = new Map(known);
  for (const row of rows) {
    if (roots.includes(row.pid) && !found.has(row.pid)) found.set(row.pid, startedAt(row.stat));
    else if (!found.has(row.pid) && read(join(proc, String(row.pid), "environ"))?.split("\0").includes(mark)) {
      found.set(row.pid, startedAt(row.stat));
    }
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const row of rows) {
      if (!found.has(row.pid) && found.has(row.parent)) {
        found.set(row.pid, startedAt(row.stat));
        grew = true;
      }
    }
  }
  return found;
};

// The same process and still running: a pid the kernel handed to somebody else since is not this step's, and a zombie is done.
const alive = (pid, start, proc = PROC) => {
  const stat = read(join(proc, String(pid), "stat"));
  return stat !== null && fieldsOf(stat)[0] !== "Z" && startedAt(stat) === start;
};

const send = (pid, signal) => {
  try {
    process.kill(pid, signal);
  } catch {
    /* Gone between the read and the signal, which is what the signal was for. */
  }
};

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

let running = null;
let heard = null;
let known = new Map();
let mark = null;

const living = () => [...known].filter(([pid, start]) => alive(pid, start));

const signalAll = (signal) => {
  known = stepProcesses([running.pid], known, mark);
  if (known.size === 0) running.kill(signal);
  for (const [pid, start] of known) if (alive(pid, start)) send(pid, signal);
};

// Until the step has exited and nothing of it is left, rescanning for what the ones still running started meanwhile.
const drained = async (signal, ms) => {
  const until = Date.now() + ms;
  for (;;) {
    const exited = running.exitCode !== null || running.signalCode !== null;
    if (exited && living().length === 0) return true;
    if (Date.now() >= until) return false;
    await pause(TICK_MS);
    const before = new Set(known.keys());
    known = stepProcesses([running.pid, ...living().map(([pid]) => pid)], known, mark);
    for (const [pid, start] of known) if (!before.has(pid) && alive(pid, start)) send(pid, signal);
  }
};

const ended = async (signal) => {
  signalAll(signal);
  if (!await drained(signal, GRACE_MS)) {
    signalAll("SIGKILL");
    await drained("SIGKILL", KILLED_MS);
  }
};

/** Spawns one step and settles with how it exited. Once a stop has been heard it never settles: the stop is what ends the gate. */
export const stepRun = (argv, options) => new Promise((settle) => {
  const value = `${process.pid}-${randomUUID()}`;
  mark = `${MARK_ENV}=${value}`;
  known = new Map();
  const child = spawn(argv[0], argv.slice(1), { ...options, env: { ...options.env ?? process.env, [MARK_ENV]: value }, stdio: "inherit" });
  running = child;
  let done = false;
  const end = (result) => {
    if (done || heard) return;
    done = true;
    running = null;
    settle(result);
  };
  child.once("error", (error) => end({ status: null, signal: null, error }));
  child.once("exit", (status, signal) => end({ status, signal, error: null }));
});

/** The number a shell reports for a process a signal ended, which is what a stopped gate exits with. */
export const stoppedCode = (signal) => 128 + constants.signals[signal];

/** Installs the handlers once: the first signal stops the running step, if any, and then `stop(signal)` ends the
 *  gate; a second while the first waits kills what is left of the step at once. */
export const onStop = (stop) => {
  for (const name of STOPS) {
    process.on(name, () => {
      if (heard) {
        if (running) signalAll("SIGKILL");
        return;
      }
      heard = name;
      if (!running) {
        stop(name);
        return;
      }
      ended(name).then(() => stop(name));
    });
  }
};
