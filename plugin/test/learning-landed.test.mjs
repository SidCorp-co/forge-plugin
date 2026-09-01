/* The backstop, called the way Claude Code calls it: after the write, with the command that landed
   the file. Every route the shapes miss ends here, so what it says is the last thing an agent reads
   about a file that should not have been written. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { callHook, homeEnv } from "./fixtures.mjs";

const HOOK = new URL("../hooks/learning-landed.mjs", import.meta.url).pathname;
const HOME = homeEnv("learning-landed");
const room = join(mkdtempSync(join(tmpdir(), "landed-")), "memory");
mkdirSync(room);

const landed = (session, name, { dir = room, old } = {}) => {
  const file = join(dir, name);
  writeFileSync(file, "a line\n");
  if (old) utimesSync(file, new Date(Date.now() - old), new Date(Date.now() - old));
  const run = callHook(
    HOOK,
    { session_id: session, tool_name: "Bash", tool_input: { command: `printf x > ${file}` }, cwd: dir },
    HOME,
  );
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim() ? JSON.parse(run.stdout).reason : null;
};

test("a memory file that arrived by no route a check reads is caught after the fact", () => {
  const first = landed(randomUUID(), "arrived-somehow.md");
  assert.match(first, /arrived-somehow\.md/u);
  assert.match(first, /Record only what cost a cycle/u);
  assert.match(first, /which of the four conditions/u);
  assert.match(first, /forge hooks --how learning-landed/u);
});

test("it is asked once, and never for the index", () => {
  const session = randomUUID();
  assert.ok(landed(session, "asked-once.md"));
  assert.equal(landed(session, "asked-once.md"), null, "a second call in the session is silent");
  assert.equal(landed(randomUUID(), "MEMORY.md"), null, "the index is not a memory");
});

test("a file nobody just wrote is somebody else's business", () => {
  assert.equal(landed(randomUUID(), "written-yesterday.md", { old: 86_400_000 }), null);
});

test("a document outside the two guarded kinds is not this gate's", () => {
  const docs = mkdtempSync(join(tmpdir(), "landed-docs-"));
  assert.equal(landed(randomUUID(), "HOOKS.md", { dir: docs }), null);
});

/* The gate stamps the file it asked about, and the two halves are handed two spellings of it: one
   from a tool's `file_path`, one realpathed off the disk. Keyed apart, every write is stopped twice. */
test("a write the gate asked about before it landed is not asked about after", () => {
  const session = randomUUID();
  const gate = new URL("../hooks/learning-gate.mjs", import.meta.url).pathname;
  const via = join(mkdtempSync(join(tmpdir(), "landed-link-")), "memory");
  symlinkSync(room, via);
  const asking = callHook(
    gate,
    { session_id: session, tool_name: "Write", tool_input: { file_path: join(via, "asked-first.md"), content: "a fact" } },
    HOME,
  );
  assert.equal(JSON.parse(asking.stdout).hookSpecificOutput.permissionDecision, "deny", "asked first");
  assert.equal(landed(session, "asked-first.md"), null);
});
