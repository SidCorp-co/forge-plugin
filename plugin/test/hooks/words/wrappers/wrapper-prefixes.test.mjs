/* getopt takes any prefix of a long option that no other long option of the program begins with, and
   clap's inferred long options keep the same rule, so a value-taking option cut short still takes the
   word after it, and the verb after that is still the command (ISS-3132). */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { WRITES } from "../../../../hooks/_hook.mjs";
import { answered, callHook, homeEnv } from "../../../fixtures.mjs";
import { patience } from "../../../patience.mjs";

const GATE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "hooks", "entries", "learning-gate.mjs");
const HOME = homeEnv("wrapper-prefixes");
const MEMORY = "/home/dev/.claude/projects/-home-dev-app/memory";
const refused = (command) => answered(callHook(GATE, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, HOME))
  ?.hookSpecificOutput?.permissionDecision === "deny";

/* Each value-taking long option and the shortest prefix of it its program accepts, read off sudo.ws
   1.9.17's, uutils env 0.8's and GNU time 1.9's own tables rather than off the reader under test. */
const SHORTEST = {
  sudo: { chdir: "chd", chroot: "chr", "close-from": "cl", "command-timeout": "co", group: "g", "other-user": "o", prompt: "pro",
    role: "ro", type: "t", user: "u" },
  env: { argv0: "a", chdir: "c", file: "f", unset: "u" },
  time: { format: "f", "output-file": "o" },
};

test("learning-gate refuses a memory write behind a wrapper's value-taking option cut to a prefix", () => {
  const write = `touch ${MEMORY}/trap.md`;
  for (const lead of ["env --ch /tmp", "sudo --us root", "env --chdir /tmp", "sudo --user root"]) {
    assert.equal(refused(`${lead} ${write}`), true, lead);
  }
});

test("every prefix of a value-taking long option its program accepts takes the word after it", () => {
  for (const [wrapper, options] of Object.entries(SHORTEST)) {
    for (const [name, shortest] of Object.entries(options)) {
      for (let length = shortest.length; length <= name.length; length += 1) {
        const option = `--${name.slice(0, length)}`;
        assert.equal(WRITES.test(`${wrapper} ${option} v touch notes.md`), true, `${wrapper} ${option} v`);
        assert.equal(WRITES.test(`${wrapper} ${option}=v touch notes.md`), true, `${wrapper} ${option}=v`);
      }
    }
  }
});

test("a prefix two long options of one program begin with takes no value", () => {
  for (const [wrapper, options] of Object.entries(SHORTEST)) {
    for (const [name, shortest] of Object.entries(options)) {
      for (let length = 1; length < shortest.length; length += 1) {
        assert.equal(WRITES.test(`${wrapper} --${name.slice(0, length)} touch notes.md`), true, `${wrapper} --${name.slice(0, length)}`);
      }
    }
  }
  for (const lead of ["env --de", "sudo --c", "sudo --ch", "sudo --pr", "sudo --re", "sudo --p"]) {
    assert.equal(WRITES.test(`${lead} x touch notes.md`), false, `${lead}: x is the command`);
  }
});

test("GNU time's output file is taken by the name its table holds", () => {
  assert.equal(WRITES.test("time --output-file t.log touch notes.md"), true);
  assert.equal(WRITES.test("time --output-file touch notes.md"), false, "the verb spelled as the file is the file");
});

test("a run of prefixed value-taking options before a word that is no write is read in one way", () => {
  const spans = new URL("../../../../src/hooks/shell-spans.mjs", import.meta.url).href;
  for (const text of [`env ${"--ch x ".repeat(40)}echo`, `sudo ${"--us x ".repeat(40)}echo`, `sudo ${"--ch x ".repeat(40)}echo`]) {
    const asked = `import(${JSON.stringify(spans)}).then((m) => process.stdout.write(String(m.WRITES.test(process.argv[1]))))`;
    const run = spawnSync(process.execPath, ["-e", asked, text], { encoding: "utf8", timeout: patience(5000) });
    assert.equal(run.stdout, "false", `${text.slice(0, 20)}: ${run.signal ?? run.stderr}`);
  }
});
