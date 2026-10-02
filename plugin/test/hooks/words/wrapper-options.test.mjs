/* A wrapper's own options stand between it and the verb it runs: which of them take a value is one
   table, and every reader of what stands before a verb reads it (ISS-2870). */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { WRITES, startsAt, writtenPaths } from "../../../hooks/_hook.mjs";
import { patience } from "../../patience.mjs";

const strict = (text) => writtenPaths(text, "/w", "md", { unplaceable: "strike" }).map((one) => one.token);

test("a wrapper's option leaves the verb behind it a write, however the option is spelled", () => {
  for (const lead of ["sudo -uroot", "sudo --user root", "sudo --user=root", "sudo -Eu root", "sudo -u root --",
    "sudo -E", "env -C /tmp -i", "exec -a alias -c", "time -o t.log", "nohup", "command -p",
    `sudo --user="domain user"`, `sudo -u"domain user"`, `time --format="elapsed %E"`, "sudo --preserve-env=PATH"]) {
    assert.equal(WRITES.test(`${lead} touch notes.md`), true, lead);
    assert.deepEqual(strict(`${lead} touch plugin/x.md`), ["plugin/x.md"], `${lead}, the strict reading`);
    assert.deepEqual(startsAt(`${lead} rm -rf /`).map((one) => one.said), ["rm -rf /"], `${lead}, where it starts`);
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

/* An option's value is spliced in front of a verb that may be no write, so each way of cutting it is
   tried before the answer is no: a value of quoted parts read as runs or as characters doubled that
   with each part, and forty of them would hold a hook past any deadline. Read in a process of its own,
   which a hang guard can stop. */
test("a wrapper's value of many quoted parts is read in one way, so the answer comes back", () => {
  const reader = new URL("../../../src/hooks/shell-spans.mjs", import.meta.url).href;
  for (const part of ["'a'", '"a"', "'a'\\ "]) {
    const asked = `import(${JSON.stringify(reader)}).then(({ WRITES }) => process.stdout.write(String(WRITES.test(process.argv[1]))))`;
    const run = spawnSync(process.execPath, ["-e", asked, `sudo -p ${part.repeat(40)} true`], { encoding: "utf8", timeout: patience(5000) });
    assert.equal(run.stdout, "false", `${part}: ${run.signal ?? run.stderr}`);
  }
});

/* A word holds a carriage return and a no-break space, which `\s` also matches, so a separator spelt
   `\s` between words read a run of them as either and the ways multiplied with each option: a wrapper's
   and git's globals are each separated by the shell's blanks alone (ISS-2959). */
test("an option run whose words hold a carriage return or a no-break space is read in one way", () => {
  const spans = new URL("../../../src/hooks/shell-spans.mjs", import.meta.url).href;
  const hook = new URL("../../../hooks/_hook.mjs", import.meta.url).href;
  for (const [reader, name, text] of [
    [spans, "WRITES", `sudo ${"-ux\r".repeat(40)}echo`],
    [spans, "WRITES", `env ${"--unset=x ".repeat(40)}echo`],
    [hook, "COMMITS", `git ${"--git-dir=x\r".repeat(40)}status`],
  ]) {
    const asked = `import(${JSON.stringify(reader)}).then((m) => process.stdout.write(String(m[${JSON.stringify(name)}].test(process.argv[1]))))`;
    const run = spawnSync(process.execPath, ["-e", asked, text], { encoding: "utf8", timeout: patience(5000) });
    assert.equal(run.stdout, "false", `${JSON.stringify(text.slice(0, 20))}: ${run.signal ?? run.stderr}`);
  }
});
