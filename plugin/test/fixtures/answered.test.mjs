/* The reader every case in this suite reads a hook through, and until ISS-1940 nothing held it: replaced with the identity, gate.test.mjs, fixtures.test.mjs and codex-owed.test.mjs stayed at 46 pass and 0 fail.
   A hook of one line is the whole fixture, since what is under test is the reading of what a child wrote and not which gate wrote it. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { answered, callHook, tempRoom } from "../fixtures.mjs";

const skipper = () => {
  const hook = join(tempRoom("skipper-"), "hook.mjs");
  writeFileSync(hook, 'process.stderr.write("forge hooks: switched-off was skipped: the switch is off\\n");\n');
  return hook;
};

test("a gate that says it was skipped is not read as a gate allowing", () => {
  assert.throws(() => answered(callHook(skipper(), {})), /a gate did not run/u,
    "a child that wrote nothing because a gate never ran is refused rather than taken for an allowance");
});

test("a skip declared where the child was spawned is honoured where its answer is read", () => {
  const run = callHook(skipper(), {}, process.env, process.cwd(), { skipped: ["switched-off"] });
  assert.equal(answered(run), null,
    "the refusal offers the declaration on either call, so the one it names first holds on the second reading");
});

test("a declared skip naming a gate that did not skip is refused rather than dropped", () => {
  assert.throws(() => answered({ status: 0, stdout: "", stderr: "" }, { skipped: ["switched-off"] }),
    /declares a gate skipped that nothing the child wrote says was skipped/u,
    "an input is used or refused, never ignored");
});
