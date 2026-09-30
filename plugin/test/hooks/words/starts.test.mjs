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

/* A span cut behind a list operator opens with the blank the operator left, and the command is the same
   one it would be at the head of the text: `WRITES` read every command of a list but the first as no
   write, and a commit an indented call made was no commit (ISS-2933). */
test("a command opening with a blank starts where the same command without it does", () => {
  for (const lead of [" ", "\t", "  "]) {
    assert.equal(WRITES.test(`${lead}cp a.md b.md`), true, `${JSON.stringify(lead)} then a copy`);
    assert.equal(COMMITS.test(`${lead}git commit -m x`), true, `${JSON.stringify(lead)} then a commit`);
  }
  for (const one of [" echo x", " git status", " printf cp"]) assert.equal(WRITES.test(one), false, one);
});
