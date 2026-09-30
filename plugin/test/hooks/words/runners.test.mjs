/* Which word runs its next quoted argument as shell code had two answers, the stats corpus's and the
   write gates', and each knew a runner the other did not (ISS-1836). One table, read by both: what
   each does with a body differs, whether the body runs does not. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { unwrapped } from "../../../hooks/_hook.mjs";
import { classOf } from "../../../src/stats/corpus/classes.mjs";
import { shellOf } from "../../../src/stats/corpus/transcripts.mjs";
import { answered, callHook, homeEnv } from "../../fixtures.mjs";

const RUNNERS = [
  "sh -c", "/bin/sh -c", "/usr/bin/bash -lc", "ash -c", "busybox sh -c", "/bin/busybox ash -c",
  "eval", "bash -o pipefail -c", "bash -eo pipefail -c", "bash +O extglob -c", "bash --norc -c", "bash -ce",
  "zsh -c", "dash -c", "ksh -c",
];
const BODY = "true; forge close ISS-1";

test("every runner in the table is one both readings open", () => {
  for (const runner of RUNNERS) {
    const command = `${runner} '${BODY}'`;
    assert.equal(classOf("Bash", shellOf(command)), "forge close", `the corpus reads ${runner}'s body as run`);
    assert.match(unwrapped(command), /; true; forge close ISS-1 ;$/u, `the gates put ${runner}'s body in command position`);
  }
});

/* A bare word before `-c` that no option took is the script, and the script is what runs: the rest are its arguments. */
test("a quoted argument to a word that runs nothing is data to both readings", () => {
  for (const command of ["printf '%s\\n' '; forge close ISS-45'", "git commit -m \"ran sh -c 'cp a b'\"", "shell -c '; forge close ISS-45'",
    "bash -x script -c '; forge close ISS-45'"]) {
    assert.notEqual(classOf("Bash", shellOf(command)), "forge close", command);
    assert.equal(unwrapped(command), command, command);
  }
});

/* Through the gate that refuses on it, so the case proves the whole chain: the runner the gate did
   not know, the body it left quoted, the write it let through. Each runs its body in the real shell,
   so a refusal here is of a write that happens. */
const GATE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "learning-gate.mjs");
const HOME = homeEnv("runners");
const MEMORY = "/home/dev/.claude/projects/-home-dev-app/memory";

test("a write inside a body the gates did not open before is refused by learning-gate", () => {
  for (const runner of ["/bin/bash -c", "ash -c", "bash -o pipefail -c", "/bin/busybox ash -c", "bash --norc -c", "bash -ce"]) {
    const command = `${runner} 'cp a ${MEMORY}/trap.md'`;
    const said = answered(callHook(GATE, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, HOME));
    assert.equal(said?.hookSpecificOutput?.permissionDecision, "deny", runner);
  }
});
