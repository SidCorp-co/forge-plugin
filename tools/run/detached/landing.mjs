/* The landing verbs run in a session of their own. Twice a ship started from an agent's background
   shell was stopped a minute into its gate, and each left the landing lock naming a dead pid; the
   same ship launched under `setsid nohup` survived every time, so the route lived in dispatch prompts
   rather than here (ISS-742). The caller now re-executes the verb detached and follows it, so
   stopping the caller stops nothing of the landing, and what the landing did is kept where a later
   call finds it. */
import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { constants } from "node:os";
import { join } from "node:path";
import { clearInterval, setInterval } from "node:timers";

import { read, stop } from "../../checkout.mjs";
import { gitDir, recordIn, reservationIn, startOf, stillLanding, waitCommand } from "./record.mjs";

/** The verbs that hold the landing lock, and so the ones whose death strands it. */
export const DETACHES = new Set(["ship", "land", "land-ready"]);

/* The caller's pid, which names the landing's output files; removed from the landing's own
   environment as it starts, since the gate it runs spawns scratch landings of its own and one that
   inherited the mark would run attached and prove nothing about this. */
const MARK = "FORGE_LANDING_DETACHED";

/* A relay tick: what the caller prints lags the landing by this much and no more, and the exit
   drains whatever is left, so nothing is lost to it. */
const TICK_MS = 100;

/* The output files are one per caller, named for its pid, so two callers that pass the record's
   check in the same instant each keep their own and meet at the landing lock, as two landings
   always have. */
const outputsIn = (dir, pid) => ({ out: join(dir, `forge-landing-${pid}.out`), err: join(dir, `forge-landing-${pid}.err`) });

const where = (files) => `its output is kept in ${files.out} and ${files.err}, and how it ended in ${files.record}`;

const busySaid = (was, wait) => `a ${was.verb ?? "landing"} of this tree is still running as pid ${was.pid}, `
  + `since ${was.since}, and one landing per tree is what keeps its files its own: ${where(was)}. Wait on it `
  + `in one call, which answers how it ended: ${wait}`;

/* Renamed into place, so a wait woken by the write never reads the record half-written and takes an
   empty file for a tree that holds none. */
const recorded = (path, body) => {
  const next = `${path}.${process.pid}`;
  writeFileSync(next, `${JSON.stringify(body, null, 2)}\n`);
  renameSync(next, path);
};

/* How long the landing waits for its caller's record naming it before writing its own: the caller
   writes it the moment the spawn returns, so this only runs out where the caller died in between. */
const CALLER_RECORD_MS = 5000;

const pause = new Int32Array(new SharedArrayBuffer(4));

/* The caller's record before the landing's first step, so the landing's end is always written after
   it: a landing that ended first would otherwise have its end written over by a start. */
const callersRecord = (path) => {
  const by = Date.now() + CALLER_RECORD_MS;
  for (let held = read(path); Date.now() < by; held = read(path)) {
    if (held?.pid === process.pid) return held;
    Atomics.wait(pause, 0, 0, 10);
  }
  return null;
};

/** In the landing itself: take the mark off, keep every ordinary end beside the start its caller
 *  recorded, and ignore the hangup a closed terminal sends — nohup's half of the old route. A signal
 *  ends it as it always did, since a gate step is a `spawnSync` no handler here could interrupt. */
export const asDetached = (verb, argv) => {
  const caller = process.env[MARK];
  if (!caller) return false;
  delete process.env[MARK];
  const dir = gitDir(process.cwd());
  if (!dir) return true;
  const record = recordIn(dir);
  const started = callersRecord(record) ?? { verb, argv, tree: process.cwd(), pid: process.pid,
    start: startOf(process.pid), since: new Date().toISOString(), ...outputsIn(dir, caller), record };
  recorded(record, started);
  process.on("SIGHUP", () => {});
  /* The step it stopped at beside the code, so a wait says where a failed landing failed without
     reading its output. */
  process.on("exit", (code) => recorded(record,
    { ...started, ended: { code, step: lastStep(started.out), at: new Date().toISOString() } }));
  return true;
};

/* Each file read from where the last read stopped; a copy per chunk, since a stream may still hold
   the buffer when the next read fills it. */
const following = (path, to) => {
  const fd = openSync(path, "r");
  const chunk = Buffer.alloc(64 * 1024);
  let at = 0;
  return {
    pump: () => {
      for (let got = readSync(fd, chunk, 0, chunk.length, at); got > 0; got = readSync(fd, chunk, 0, chunk.length, at)) {
        at += got;
        to.write(Buffer.from(chunk.subarray(0, got)));
      }
    },
    close: () => closeSync(fd),
  };
};

const STEP = /^step (\d+)\/(\d+) {2}(.+)$/u;

/** The last step the landing announced, off its own output, or null where it reached none. */
const lastStep = (out) => {
  const text = existsSync(out) ? readFileSync(out, "utf8") : "";
  const found = text.split("\n").map((line) => STEP.exec(line)).filter(Boolean).at(-1);
  return found ? `step ${found[1]}/${found[2]} (${found[3]})` : null;
};

const endedBySignal = (pid, signal, files) => {
  const step = lastStep(files.out);
  const was = read(files.record) ?? { pid };
  recorded(files.record, { ...was, ended: { signal, step, at: new Date().toISOString() } });
  return `\nthe landing, pid ${pid}, was ended by ${signal} ${step ? `during ${step}` : "before its first step"}. `
    + `A landing lock it held stays, naming that pid, and the next landing names the one command that clears it; `
    + `${where(files)}.`;
};

const leftSaid = (pid, signal, files, wait) => `\nthis call was stopped by ${signal} and the landing was not: it runs `
  + `on as pid ${pid}, and ${where(files)}. Wait on it in one call, which answers how it ended: ${wait}`;

const CALLER_STOPS = ["SIGTERM", "SIGINT", "SIGHUP"];

/* Created exclusively and held only from the check to the record naming the new landing, so two
   callers of one tree in the same instant cannot both pass the check: one launches and the other is
   refused. */
const reserved = (path) => {
  try {
    writeFileSync(path, `${process.pid}\n`, { flag: "wx" });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
};

const startingSaid = (path) => {
  const pid = Number.parseInt(existsSync(path) ? readFileSync(path, "utf8") : "", 10);
  if (Number.isInteger(pid) && pid > 1 && startOf(pid) !== null) {
    return `another landing of this tree is being started this moment, by pid ${pid}. Run this one `
      + `again once it has: that call's first line names the landing, which this one then waits on.`;
  }
  return `a call that is no longer running left this tree's landing reservation behind, so no landing `
    + `can start here until it is cleared:\n  ${path}\nNothing removes it for you — a reservation `
    + `taken over silently is one that was never held. Clear it, then run this landing again:\n  rm ${path}`;
};

/* Past the check, under the reservation: the previous landing's output goes, and only the two files
   its record names, the record being what a later call reads and about to name this one. The
   record is written here before the reservation is dropped, and the landing waits for it. */
const launched = ({ verb, argv, script, tree, dir, record }) => {
  const was = read(record);
  if (stillLanding(was)) stop(busySaid(was, waitCommand(script, tree)));
  for (const one of [was?.out, was?.err]) if (typeof one === "string" && one.startsWith(dir)) rmSync(one, { force: true });
  const files = { ...outputsIn(dir, process.pid), record };
  const [out, err] = [openSync(files.out, "w"), openSync(files.err, "w")];
  let child;
  try {
    child = spawn(process.execPath, [...process.execArgv, script, verb, ...argv], {
      cwd: tree, detached: true, stdio: ["ignore", out, err], env: { ...process.env, [MARK]: String(process.pid) },
    });
  } finally {
    closeSync(out);
    closeSync(err);
  }
  if (child.pid) {
    recorded(record, { verb, argv, tree, pid: child.pid, start: startOf(child.pid), since: new Date().toISOString(), ...files });
  }
  return { child, files };
};

/** In the caller: start the verb in a session of its own and follow it to its end. Null where the
 *  tree has no git directory to keep its files in, and the verb then runs here, whose own first step
 *  says why no landing can happen. */
export const detach = async (verb, argv, script) => {
  const tree = process.cwd();
  const dir = gitDir(tree);
  if (!dir) return null;
  const hold = reservationIn(dir);
  if (!reserved(hold)) stop(startingSaid(hold));
  let launch;
  try {
    launch = launched({ verb, argv, script, tree, dir, record: recordIn(dir) });
  } finally {
    rmSync(hold, { force: true });
  }
  const { child, files } = launch;
  const wait = waitCommand(script, tree);
  const ended = new Promise((done) => {
    child.once("error", (error) => done({ error }));
    child.once("exit", (code, signal) => done({ code, signal }));
  });
  if (!child.pid) {
    const { error } = await ended;
    stop(`${process.execPath} could not be started to run the ${verb}: ${error?.message ?? "no pid was given"}.`);
  }
  console.log(`  this ${verb} runs as pid ${child.pid} in a session of its own, so stopping this call stops `
    + `nothing of it; \`kill -- -${child.pid}\` stops it, gate and all. What it prints is relayed here, and ${where(files)}. `
    + `A later call waits on it, from any directory, and is answered how it ended: ${wait}`);
  const relays = [following(files.out, process.stdout), following(files.err, process.stderr)];
  const pump = () => relays.forEach((one) => one.pump());
  const tick = setInterval(pump, TICK_MS);
  const stopped = (signal) => {
    pump();
    console.error(leftSaid(child.pid, signal, files, wait));
    process.exit(128 + constants.signals[signal]);
  };
  for (const signal of CALLER_STOPS) process.on(signal, stopped);
  const { code, signal } = await ended;
  clearInterval(tick);
  pump();
  relays.forEach((one) => one.close());
  for (const one of CALLER_STOPS) process.off(one, stopped);
  if (signal) {
    console.error(endedBySignal(child.pid, signal, files));
    process.exitCode = 1;
    return true;
  }
  process.exitCode = code;
  return true;
};

/** What `-h` says about it. */
export const DETACH_HELP = [
  "The landing verbs — ship, land, land-ready — run in a session of their own. The call you type",
  "starts the verb again detached, prints the pid it runs as, and relays what it prints until it",
  "ends, exiting with its code; stopping that call, as a harness stopping a background shell does,",
  "stops nothing of the landing, and `kill -- -<pid>` is what stops the landing, gate and all. Its",
  "output is kept in the tree's git directory as forge-landing-<caller pid>.out and .err, and",
  "forge-landing.json names them and records how the landing ended, so a later call reads what a",
  "stopped caller no longer can: `wait` is that call. A landing ended by a signal leaves the lock",
  "naming its pid, refused with the command that clears it, and a second landing of a tree whose",
  "landing is still running — the pid that record names, begun at the moment it records — is",
  "refused with the wait that answers how that one ended.",
  "Two calls of one tree in the same instant launch one landing: forge-landing.starting is held from",
  "that check to the record, and one a dead call left is refused with the command that clears it.",
];
