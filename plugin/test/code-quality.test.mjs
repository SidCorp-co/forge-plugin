/* Once answered in the delegate's own protocol — stderr and exit 2 — and so the one refusal that
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
    assert.equal(run.status, 0, `exit ${run.status}: ${run.stderr}`);
    const out = JSON.parse(run.stdout);
    assert.equal(out.decision, "block");
    assert.match(out.reason, /code-quality\//u, "the delegate's finding, verbatim");
    assert.ok(existsSync(LOG), "a refusal writes the log");
    const entry = JSON.parse(readFileSync(LOG, "utf8").trim().split("\n").pop());
    assert.equal(entry.hook, "code-quality");
    assert.equal(entry.decision, "block");
    assert.match(entry.reason, /code-quality: .*cq-probe.* — code-quality\/comment-density/u, "the log names the rule, not only the file");
    /* The same content named again — a grep, say — is not a second block. */
    const again = callHook(HOOK, { session_id: entry.session, tool_name: "Bash", tool_input: { command: `grep -n one ${file}` }, cwd: REPO }, HOME);
    assert.equal(again.stdout.trim(), "", "reported once per content");
    writeFileSync(file, `${readFileSync(file, "utf8")}// five\n`);
    const changed = callHook(HOOK, { session_id: entry.session, tool_name: "Write", tool_input: { file_path: file }, cwd: REPO }, HOME);
    assert.equal(JSON.parse(changed.stdout).decision, "block", "changed content is reported again");
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
