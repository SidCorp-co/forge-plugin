/* A wrapper's own options stand between it and the verb it runs: which of them take a value is one
   table, and every reader of what stands before a verb reads it (ISS-2870). */
import assert from "node:assert/strict";
import test from "node:test";

import { WRITES, startsAt, writtenPaths } from "../../../hooks/_hook.mjs";

const strict = (text) => writtenPaths(text, "/w", "md", { unplaceable: "strike" }).map((one) => one.token);

test("a wrapper's option leaves the verb behind it a write, however the option is spelled", () => {
  for (const lead of ["sudo -uroot", "sudo --user root", "sudo --user=root", "sudo -Eu root", "sudo -u root --",
    "sudo -E", "env -C /tmp -i", "exec -a alias -c", "time -o t.log", "nohup", "command -p"]) {
    assert.equal(WRITES.test(`${lead} touch notes.md`), true, lead);
  }
});

test("a verb spelled as the value a wrapper's option takes is that value and not the verb", () => {
  assert.equal(WRITES.test("sudo -u touch notes.md"), false);
  assert.deepEqual(strict("sudo -u touch notes.md"), []);
  assert.equal(WRITES.test("exec -a cp notes.md"), false, "exec's own");
  assert.deepEqual(strict("sudo -u touch cp a.md notes.md"), ["notes.md"], "the verb after that value is the copy, which writes its last operand");
});

test("the reading of where a command starts opens at the verb and never at an option's value", () => {
  assert.deepEqual(startsAt("sudo -u root rm -rf /"), [{ said: "rm -rf /", at: 13 }]);
  assert.deepEqual(startsAt("env -u HOME rm -rf /").map((one) => one.said), ["rm -rf /"]);
});

test("the strict reading keeps the target of the verb behind a wrapper's options", () => {
  assert.deepEqual(strict("sudo -u root touch plugin/x.md"), ["plugin/x.md"]);
  assert.deepEqual(strict("sudo -u root cp a.md plugin/x.md"), ["plugin/x.md"], "and strikes the file a copy reads");
});

/* A wrapper spelled in a quoted argument starts nothing for the raw readers either, so the command it
   stands in is the redirect it makes rather than one no reading can place. */
test("a quoted mention of a wrapped write leaves the redirect beside it read", () => {
  for (const lead of ["sudo", "sudo -u me"]) {
    assert.deepEqual(strict(`echo "${lead} touch plugin/skills/x/SKILL.md" > plugin/x.md`), ["plugin/x.md"], lead);
  }
});
