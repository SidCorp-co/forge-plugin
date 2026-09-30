/* `exec` runs the command after it only where the shell runs `exec` itself; as another program's
   argument it names a subcommand, and `docker exec` runs its command inside a container (ISS-2877). */
import assert from "node:assert/strict";
import test from "node:test";

import { COMMITS, WRITES } from "../../../hooks/_hook.mjs";

test("an exec starts a command at the head of one and behind any other start", () => {
  for (const lead of ["", "true; ", "(", "A=1 ", "sudo ", "then "]) {
    assert.equal(WRITES.test(`${lead}exec touch f`), true, `${JSON.stringify(lead)} then exec`);
    assert.equal(COMMITS.test(`${lead}exec git commit -m x`), true, `${JSON.stringify(lead)} then exec, a commit`);
  }
});

test("an exec another program takes as its argument starts nothing", () => {
  for (const one of ["docker exec ctr", "podman exec ctr", "kubectl exec pod --", "echo exec"]) {
    assert.equal(WRITES.test(`${one} touch f`), false, one);
    assert.equal(COMMITS.test(`${one} git commit -m x`), false, `${one}, a commit`);
  }
});
