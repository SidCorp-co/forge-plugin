/* The event on stdin and the decision on stdout, as Claude Code calls it. The fixture is a
   repository that was inherited already wrong, because that is the case a gate has to survive. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { callHook, homeEnv } from "./fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "entries", "claude-md.mjs");
const HOME = homeEnv("claude-md");

const room = mkdtempSync(join(tmpdir(), "claude-md-hook-"));
const git = (...args) => execFileSync("git", args, { cwd: room, encoding: "utf8" });
git("init", "-q");
git("config", "user.email", "t@local");
git("config", "user.name", "t");
writeFileSync(join(room, "package.json"), JSON.stringify({ name: "t", scripts: { test: "node --test" } }));
const guide = (text) => writeFileSync(join(room, "CLAUDE.md"), text);
guide("# CLAUDE.md\n\nThe plan is [here](docs/OLD-PLAN.md).\n");
git("add", "CLAUDE.md", "package.json");
git("commit", "-qm", "inherited, and already wrong");

const decide = (file = join(room, "CLAUDE.md")) => {
  const run = callHook(
    HOOK,
    { session_id: randomUUID(), cwd: room, tool_name: "Write", tool_input: { file_path: file } },
    HOME,
  );
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true };
  const held = JSON.parse(run.stdout);
  return { allowed: held.decision !== "block", reason: held.reason ?? "" };
};

/* A gate that fires over what someone inherited is switched off in its first hour, and it would
   refuse the edit that fixes the claim. */
test("a claim already broken in the committed file is not this write's doing", () => {
  assert.equal(decide().allowed, true);
});

test("a claim the write introduces is refused, named, with one move and where the argument is", () => {
  guide("# CLAUDE.md\n\nThe plan is [here](docs/OLD-PLAN.md).\nRun `npm run verify`, and read `scripts/gate.mjs`.\n");
  const { allowed, reason } = decide();
  assert.equal(allowed, false);
  assert.match(reason, /`scripts\/gate\.mjs` names no such path/u);
  assert.match(reason, /`verify` is in no package\.json here/u);
  assert.match(reason, /correct each claim, or delete it/u);
  assert.match(reason, /forge hooks --how claude-md/u);
  assert.ok(reason.length < 500, `${reason.length} characters printed on a refused write`);
});

test("correcting the claim clears it, and deleting the inherited one is an answer too", () => {
  guide("# CLAUDE.md\n\nRun `npm test` before every commit.\n");
  assert.equal(decide().allowed, true);
});

test("a project's own guides and every other file are its business", () => {
  guide("# CLAUDE.md\n\nRead `scripts/nothing-here.mjs`.\n");
  assert.equal(decide(join(room, "package.json")).allowed, true);
  assert.equal(decide().allowed, false, "and CLAUDE.md itself still answers");
});
