/* A root manifest is in every step's digest, so it reaches every step: one the scope skipped over it
   would stand in the record at no content, and the whole table could never read green (ISS-2564). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { STEPS } from "../../gates/steps.mjs";
import { landed, run, scratch } from "./scratch.mjs";

const everyStepRan = (said) => new RegExp(`All ${STEPS.length} gate step\\(s\\) passed`, "u").test(said.stdout);

// Written the way the scratch writes it, so what a case moves is the fields it names and never the serialiser's whitespace.
const manifestWith = (work, fields) => {
  const was = JSON.parse(readFileSync(join(work, "package.json"), "utf8"));
  return JSON.stringify({ ...was, ...fields(was) }, null, 2);
};

test("a root manifest edit reaches every step, the lock file's as well", () => {
  const { at, work } = scratch("manifest");
  try {
    assert.equal(run(work).status, 0);
    for (const [path, text] of [
      ["package.json", manifestWith(work, (was) => ({ scripts: { ...was.scripts, "generate:spec": "node -e \"\"" } }))],
      ["package-lock.json", "a dependency moved\n"]]) {
      landed(work, path, text);
      const said = run(work);
      assert.equal(said.status, 0, said.stdout + said.stderr);
      assert.match(said.stdout, /=== scope: /u, said.stdout);
      assert.doesNotMatch(said.stdout, /nothing it reads changed/u, `${path} left a step unreached:\n${said.stdout}`);
      assert.ok(everyStepRan(said), `${path} moved every digest and not every step was spent:\n${said.stdout}`);
    }
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a move of the root manifest's version alone reaches every step and skips each by its digest", () => {
  const { at, work } = scratch("manifest-version");
  try {
    assert.equal(run(work).status, 0);
    landed(work, "package.json", manifestWith(work, () => ({ version: "1.0.1" })));
    const said = run(work);
    assert.equal(said.status, 0, said.stdout + said.stderr);
    assert.doesNotMatch(said.stdout, /nothing it reads changed/u, said.stdout);
    assert.match(said.stdout, new RegExp(`=== ledger: ${STEPS.length} of ${STEPS.length} step\\(s\\) green already ===`, "u"), said.stdout);
    assert.match(said.stdout, /All 0 gate step\(s\) passed/u, said.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
