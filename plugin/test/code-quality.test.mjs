/* The one hook answering in a delegate's protocol — stderr and exit 2 — and so the one refusal that
   for months left no line, while docs/HOOKS.md promised every one was written down. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { callHook, homeEnv } from "./fixtures.mjs";

const HOOK = new URL("../hooks/code-quality.mjs", import.meta.url).pathname;
const REPO = new URL("../..", import.meta.url).pathname.replace(/\/$/u, "");
const HOME = homeEnv("code-quality");
const LOG = join(HOME.XDG_CONFIG_HOME, "forge", "hook-log.jsonl");

/* Inside this repository, so the delegate finds this project's ESLint and its density limit. */
test("a finding is refused in the delegate's protocol and written to the log like every other", () => {
  const file = join(REPO, "plugin", "test", `cq-probe-${randomUUID().slice(0, 8)}.mjs`);
  writeFileSync(file, "// one\n// two\n// three\n// four\nexport const x = 1;\n");
  try {
    const run = callHook(
      HOOK,
      { session_id: randomUUID(), tool_name: "Write", tool_input: { file_path: file }, cwd: REPO },
      HOME,
    );
    assert.equal(run.status, 2, `exit ${run.status}: ${run.stderr}`);
    assert.match(run.stderr, /code-quality\//u, "the delegate's finding, verbatim");
    assert.ok(existsSync(LOG), "a refusal writes the log");
    const entry = JSON.parse(readFileSync(LOG, "utf8").trim().split("\n").pop());
    assert.equal(entry.hook, "code-quality");
    assert.equal(entry.decision, "block");
  } finally {
    rmSync(file, { force: true });
  }
});

test("a clean file says nothing", () => {
  const clean = join(REPO, "plugin", "src", "vi.mjs");
  const run = callHook(
    HOOK,
    { session_id: randomUUID(), tool_name: "Write", tool_input: { file_path: clean }, cwd: REPO },
    HOME,
  );
  assert.equal(run.status, 0, run.stderr);
});
