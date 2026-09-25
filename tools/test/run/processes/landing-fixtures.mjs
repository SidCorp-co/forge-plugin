/* The scratch landings the detached-landing cases and the landing-wait cases both stand on: a
   checkout with a remote, a gate that holds its step, a caller with pipes of its own. Not a
   `.test.mjs`, so the suite collects no test of its own here. */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { BARE, committed, git, SCRIPT, scratch } from "../run-fixtures.mjs";

export const LOCK = "forge-ship-lock";
export const RECORD = "forge-landing.json";
export const MARK = "FORGE_LANDING_DETACHED";

/* The project's gate as a scratch checkout's `check`: it says it started, writes what it inherited of
   the mark, and holds the step for as long as a case needs a landing standing in its gate. */
export const sleepingGate = (ms) => `node -e "const f=require('fs');f.writeFileSync('../gate-env',String(process.env.${MARK}));`
  + `f.writeFileSync('../gate-started','');setTimeout(()=>f.writeFileSync('../gate-done',''),${ms})"`;

export const remoted = (name, gate) => {
  const room = scratch(name, gate);
  git(room.at, "init", "--bare", "origin.git");
  git(room.work, "init", "-b", "master");
  committed(room.work, "one");
  git(room.work, "remote", "add", "origin", join(room.at, "origin.git"));
  git(room.work, "push", "origin", "HEAD:master");
  return room;
};

export const inGit = (work, name) => join(work, ".git", name);

export const running = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};

export const until = async (what, done, ms = 60_000) => {
  const by = Date.now() + ms;
  while (!done()) {
    if (Date.now() > by) throw new Error(`${what} did not happen within ${ms}ms`);
    await sleep(50);
  }
};

/* A caller with pipes of its own, as a harness's shell is; `group` gives it a process group to be
   killed by, which is the whole of what a harness stopping a background shell reaches. */
export const caller = (work, argv, { group = false } = {}) => {
  const one = spawn(process.execPath, [join(work, SCRIPT), ...argv],
    { cwd: work, env: BARE, detached: group, stdio: ["ignore", "pipe", "pipe"] });
  const said = { out: "", err: "" };
  one.stdout.on("data", (chunk) => { said.out += chunk; });
  one.stderr.on("data", (chunk) => { said.err += chunk; });
  const exited = new Promise((done) => one.once("exit", (code, signal) => done({ code, signal })));
  return { one, said, exited };
};

export const landingPid = async (said) => {
  await until("the caller naming the landing's pid", () => /runs as pid \d+/u.test(said.out), 20_000);
  return Number(/runs as pid (\d+)/u.exec(said.out)[1]);
};

/* Whatever a case started is ended by the case, so a failed assertion leaves no scratch landing
   standing in a room nobody reads again. */
export const ended = (pid) => {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    /* already gone */
  }
};

export const recordOf = (work) => JSON.parse(readFileSync(inGit(work, RECORD), "utf8"));
