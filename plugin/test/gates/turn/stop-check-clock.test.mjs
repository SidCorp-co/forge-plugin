/* The stop clock is the event's, and the checks share it: these cases plant what spends it — a
   linter as slow as the whole event, a git slower than what is left — and read which checks still
   answered and what the gate said about the ones that could not. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { cleanRepo, tempRoom } from "../../fixtures.mjs";
import { DEADLINES } from "../../../src/hooks/hook-switch.mjs";
import { decided, freshWorktree, git, settled, spawnIn, stopStanding, transcript, used } from "./fixture.mjs";

/* A linter the clock is spent on: a delegate planted where `linting` finds a project's own, which
   answers clean and marks the clock spent. The clock the case hands reads the mark, so the lint is
   as slow as the whole event wherever it runs, and whatever ran before it had the clock whole. */
const slowLint = () => {
  const room = tempRoom("stop-check-slow-");
  const scripts = join(room, "node_modules", "eslint-plugin-code-quality", "claude-plugin", "scripts");
  mkdirSync(scripts, { recursive: true });
  const spent = join(room, "spent");
  writeFileSync(join(scripts, "lint-edited-file.mjs"),
    `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(spent)}, "");\n`);
  const file = join(room, "slow.mjs");
  writeFileSync(file, "export const x = 1;\n");
  const clock = () => performance.timeOrigin + (existsSync(spent) ? 60 * DEADLINES.post : 0);
  return { file, clock, spent };
};

test("a linter that spends the stop clock leaves the process check its answer", async () => {
  const { wt } = freshWorktree();
  const pid = spawnIn(wt);
  const { file, clock, spent } = slowLint();
  try {
    await settled();
    const ev = { session_id: `s-${randomUUID()}`, transcript_path: transcript(used("Write", { file_path: file })), cwd: wt };
    const refused = decided(ev, () => [], clock);
    assert.equal(existsSync(spent), true, "the planted linter never ran");
    assert.equal(refused.kind, "block", refused.said);
    assert.match(refused.said, new RegExp(`pid ${pid}`, "u"), "the process standing there is not named");
  } finally {
    stopStanding(pid);
  }
});

test("a linter that spends the stop clock leaves the lease check its answer", () => {
  const { file, clock, spent } = slowLint();
  const ev = { session_id: `s-${randomUUID()}`, transcript_path: transcript(used("Write", { file_path: file })), cwd: cleanRepo() };
  const refused = decided(ev, () => ["ISS-999"], clock);
  assert.equal(existsSync(spent), true, "the planted linter never ran");
  assert.equal(refused.kind, "block", refused.said);
  assert.match(refused.said, /forge record park ISS-999/u);
});

test("a linter that spends the stop clock leaves the worktree check its answer", () => {
  const { wt } = freshWorktree();
  writeFileSync(join(wt, "one.txt"), "tracked\n");
  git(wt, "add", "one.txt");
  git(wt, "commit", "-qm", "base");
  writeFileSync(join(wt, "one.txt"), "changed, and never committed\n");
  const { file, clock, spent } = slowLint();
  const ev = { session_id: `s-${randomUUID()}`, transcript_path: transcript(used("Write", { file_path: file })), cwd: wt };
  const refused = decided(ev, () => [], clock);
  assert.equal(existsSync(spent), true, "the planted linter never ran");
  assert.equal(refused.kind, "block", refused.said);
  assert.match(refused.said, /is a worktree this turn left with tracked changes/u);
  assert.match(refused.said, /git -C .*add -u && git commit/u);
});

/* A git that answers slower than the least a probe is given. The window is the whole of what
   changed: near the end of the clock the probe is clamped under it and killed, which costs the
   dirty-tree refusal and not the hook; with the clock whole the same git answers. */
const slowGit = () => {
  const bin = tempRoom("stop-check-git-");
  const real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  writeFileSync(join(bin, "git"), `#!/bin/sh\nsleep 0.8\nexec ${real} "$@"\n`);
  chmodSync(join(bin, "git"), 0o755);
  return bin;
};

const dirtyWorktree = () => {
  const { wt } = freshWorktree();
  writeFileSync(join(wt, "one.txt"), "tracked\n");
  git(wt, "add", "one.txt");
  git(wt, "commit", "-qm", "base");
  writeFileSync(join(wt, "one.txt"), "changed, and never committed\n");
  return wt;
};

const withPath = (bin, fn) => {
  const was = process.env.PATH;
  process.env.PATH = `${bin}:${was}`;
  try {
    return fn();
  } finally {
    process.env.PATH = was;
  }
};

/* What the gate writes on stderr while `fn` runs, and what `fn` returned. */
const told = (fn) => {
  const said = [];
  const write = process.stderr.write;
  process.stderr.write = (chunk) => {
    said.push(String(chunk));
    return true;
  };
  try {
    return { answer: fn(), stderr: said.join("") };
  } finally {
    process.stderr.write = write;
  }
};

test("a git probe slower than what the nearly spent clock gives it gets no answer and raises no refusal", () => {
  const wt = dirtyWorktree();
  const bin = slowGit();
  /* 4.2 s left on the event is 1.2 s past the gate's spare: the checks still run, and a probe is given half a second. */
  const near = () => performance.timeOrigin + DEADLINES.post - 4_200;
  const { answer, stderr } = told(() => withPath(bin,
    () => decided({ session_id: `s-${randomUUID()}`, transcript_path: transcript(), cwd: wt }, () => [], near)));
  assert.equal(answer.kind, "none", `a probe the clock could not cover answered anyway: ${answer.said}`);
  assert.match(stderr, /the worktree check \(git did not answer/u, `the probe that went unanswered is not named: ${stderr}`);
  assert.match(stderr, /the live-process check inside the worktree \(git did not answer/u,
    `the live check's half that turns on the worktree is not named: ${stderr}`);
});

test("the same slow git probe answers with the clock whole and the dirty worktree refuses the stop", () => {
  const wt = dirtyWorktree();
  const bin = slowGit();
  const said = withPath(bin, () => decided({ session_id: `s-${randomUUID()}`, transcript_path: transcript(), cwd: wt }, () => []));
  assert.equal(said.kind, "block", said.said);
  assert.match(said.said, /is a worktree this turn left with tracked changes/u);
});

/* Not read is not clean: every check the clock skipped, and every file the linter did not reach in a
   tree that configures one, is named where the harness names a gate that did not run, and none of
   them holds the stop. */
test("what the spent clock left unread is named on stderr and does not refuse the stop", () => {
  const repo = cleanRepo();
  writeFileSync(join(repo, "eslint.config.mjs"), "export default [];\n");
  const file = join(repo, "unread.mjs");
  writeFileSync(file, "export const x = 1;\n");
  const ev = { session_id: `s-${randomUUID()}`, transcript_path: transcript(used("Write", { file_path: file })), cwd: repo };
  const { answer: said, stderr: line } = told(() => decided(ev, () => ["ISS-999"], () => performance.timeOrigin + DEADLINES.post - 1_000));
  assert.equal(said.kind, "none", `what could not be read refused the stop: ${said.said}`);
  assert.match(line, /stop-check did not read/u, `nothing said what went unread: ${line}`);
  for (const check of ["the worktree check", "the live-process check", "the lease check"]) {
    assert.match(line, new RegExp(`${check} \\(the stop clock ran out\\)`, "u"), `${check} is not named`);
  }
  assert.match(line, /unread\.mjs \(the stop clock ran out\)/u, "the file the linter never reached is not named");
});
