/* A gate killed past its exit handler leaves its temp root under TMPDIR; the next gate sweeps it before it makes
   its own, by its owner's pid or by its age, and never a root a live run still holds (ISS-65). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { tempRoom } from "../../../plugin/test/fixtures.mjs";
import { ROOT, SHELL_ENV } from "./scratch.mjs";
import { ORPHANED_AFTER_MS, OWNER, ROOT_PREFIX, sweepOrphans } from "../../gates/stamp-room.mjs";

const SWEPT = pathToFileURL(join(ROOT, "tools", "gates", "stamp-room.mjs")).href;

const deadPid = () => {
  const gone = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  return Number(gone.stdout);
};

const rootIn = (tmp, name, pid) => {
  const dir = join(tmp, `${ROOT_PREFIX}${name}`);
  mkdirSync(join(dir, "step"), { recursive: true });
  writeFileSync(join(dir, "step", "big"), "x".repeat(1024));
  if (pid !== undefined) writeFileSync(join(dir, OWNER), String(pid));
  return dir;
};

test("a root whose owner is dead, or that is older than a day, is swept; a live owner's and a young one's are not", () => {
  const tmp = tempRoom("orphans-");
  try {
    const dead = rootIn(tmp, "dead", deadPid());
    const live = rootIn(tmp, "live", process.pid);
    const young = rootIn(tmp, "young");
    const old = rootIn(tmp, "old");
    const stale = (Date.now() - ORPHANED_AFTER_MS - 60_000) / 1000;
    utimesSync(old, stale, stale);
    const other = join(tmp, "not-a-gate-root");
    mkdirSync(other);
    utimesSync(other, stale, stale);
    assert.deepEqual(sweepOrphans(tmp).sort(), [dead, old].sort());
    assert.deepEqual(readdirSync(tmp).sort(), [`${ROOT_PREFIX}live`, `${ROOT_PREFIX}young`, "not-a-gate-root"].sort());
    assert.ok(existsSync(join(live, "step", "big")) && existsSync(join(young, "step", "big")), "a held root was emptied");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a killed gate's root is gone once the next gate makes its own, and that one names its owner", () => {
  const tmp = tempRoom("orphans-next-");
  try {
    const killed = spawnSync(process.execPath, ["--input-type=module", "-e",
      `const { gateTmp } = await import("${SWEPT}");
       process.stdout.write(gateTmp());
       process.kill(process.pid, "SIGKILL");`],
    { encoding: "utf8", env: { ...SHELL_ENV, TMPDIR: tmp, KEEP_TEST_ROOMS: "" } });
    assert.equal(killed.signal, "SIGKILL", killed.stderr);
    assert.ok(existsSync(killed.stdout), "the SIGKILL ran the exit handler, so this case proves nothing");
    const next = spawnSync(process.execPath, ["--input-type=module", "-e",
      `const { gateTmp } = await import("${SWEPT}");
       const { readFileSync } = await import("node:fs");
       const dir = gateTmp();
       process.stdout.write(dir + "\\n" + readFileSync(dir + "/${OWNER}", "utf8") + "\\n" + process.pid);`],
    { encoding: "utf8", env: { ...SHELL_ENV, TMPDIR: tmp, KEEP_TEST_ROOMS: "" } });
    assert.equal(next.status, 0, next.stderr);
    const [, owner, pid] = next.stdout.split("\n");
    assert.equal(existsSync(killed.stdout), false, `the killed gate's root outlived the next gate:\n${next.stderr}`);
    assert.match(next.stderr, /removed 1 temp root\(s\) a killed gate left under /u, next.stderr);
    assert.equal(owner, pid, "the root does not name the process that owns it");
    assert.deepEqual(readdirSync(tmp), [], "and the next gate removed its own on exit");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a root kept for reading names no owner, so only its age sweeps it", () => {
  const tmp = tempRoom("orphans-kept-");
  try {
    const kept = spawnSync(process.execPath, ["--input-type=module", "-e",
      `const { gateTmp } = await import("${SWEPT}");
       process.stdout.write(gateTmp());`],
    { encoding: "utf8", env: { ...SHELL_ENV, TMPDIR: tmp, KEEP_TEST_ROOMS: "1" } });
    assert.equal(kept.status, 0, kept.stderr);
    assert.equal(existsSync(join(kept.stdout, OWNER)), false, "a kept root names an owner whose exit sweeps it");
    assert.deepEqual(sweepOrphans(tmp), [], "a kept root was swept the moment its run ended");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
