/* Which word runs its next quoted argument as shell code had two answers, the stats corpus's and the
   write gates', and each knew a runner the other did not (ISS-1836). One table, read by both: what
   each does with a body differs, whether the body runs does not. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { shellWrites, unwrapped, writtenPaths } from "../../../hooks/_hook.mjs";
import { classOf } from "../../../src/stats/corpus/classes.mjs";
import { shellOf } from "../../../src/stats/corpus/transcripts.mjs";
import { answered, callHook, homeEnv } from "../../fixtures.mjs";

const RUNNERS = [
  "sh -c", "/bin/sh -c", "/usr/bin/bash -lc", "ash -c", "busybox sh -c", "/bin/busybox ash -c",
  "eval", "bash -o pipefail -c", "bash -eo pipefail -c", "bash +O extglob -c", "bash --norc -c", "bash -ce",
  "zsh -c", "dash -c", "ksh -c",
  "env -S", "env -iS", "env -u X -S", "env -C /tmp -S", "env --split-string", "env --split", "env --s", "/usr/bin/env -S",
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

/* The corpus asks the whole runner pattern only where the word before a quote could end it (ISS-1843), so the word is read past its spaces and behind its operator, and a word that only ends like a runner is still none. */
test("the corpus finds a runner past the spaces before its quote, and a word only ending like one runs nothing", () => {
  for (const runner of ["bash -c  ", "bash -c\t", "true;eval", "true && sh -ec", "(eval"]) {
    assert.equal(classOf("Bash", shellOf(`${runner} '${BODY}'`)), "forge close", runner);
  }
  for (const word of ["medieval", "echo -c", "bash -x", "bash -c-"]) {
    assert.notEqual(classOf("Bash", shellOf(`${word} '${BODY}'`)), "forge close", word);
  }
});

/* Through the gate that refuses on it, so the case proves the whole chain: the runner the gate did
   not know, the body it left quoted, the write it let through. Each runs its body in the real shell,
   so a refusal here is of a write that happens. */
const GATE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks", "entries", "learning-gate.mjs");
const HOME = homeEnv("runners");
const MEMORY = "/home/dev/.claude/projects/-home-dev-app/memory";

/* A shell reads a heredoc on its stdin as its program, whatever word names it (ISS-2928). */
const fed = (shell, line) => `${shell} <<'EOF'\n${line}\nEOF`;

test("a write inside a body the gates did not open before is refused by learning-gate", () => {
  const write = `cp a ${MEMORY}/trap.md`;
  const inline = ["/bin/bash -c", "ash -c", "bash -o pipefail -c", "/bin/busybox ash -c", "bash --norc -c", "bash -ce"]
    .map((runner) => `${runner} '${write}'`);
  const stdin = ["bash", "/bin/bash", "dash", "ash", "bash -o pipefail", "bash +O extglob"].map((shell) => fed(shell, write));
  for (const command of [...inline, ...stdin]) {
    const said = answered(callHook(GATE, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, HOME));
    assert.equal(said?.hookSpecificOutput?.permissionDecision, "deny", command);
  }
});

test("a heredoc a shell reads on stdin is commands, whatever word names the shell", () => {
  for (const shell of ["bash", "/bin/bash", "dash", "ash", "ksh", "/usr/bin/zsh", "/bin/busybox ash", "sh -s"]) {
    const written = writtenPaths(shellWrites(fed(shell, "cp a /m/memory/x.md")), "/w").map((one) => one.token);
    assert.ok(written.includes("/m/memory/x.md"), `${shell}: ${JSON.stringify(written)}`);
  }
});

test("a heredoc whose reader is no shell the declaration names keeps its body as data", () => {
  for (const reader of ["cat > deploy.sh", "tee notes.md", "csh"]) {
    const written = writtenPaths(shellWrites(fed(reader, "cp a /m/memory/x.md")), "/w").map((one) => one.token);
    assert.ok(!written.includes("/m/memory/x.md"), `${reader}: ${JSON.stringify(written)}`);
  }
});

/* Which words are a shell's options was spelled once for a `-c` body and again for a heredoc on stdin, and the second stopped at a `+` option and at the value `-o` takes (ISS-3023). */
test("a shell's options are read alike before a -c body and before a heredoc on its stdin", () => {
  for (const options of ["-e", "--norc", "-o pipefail", "+o posix", "-O extglob", "+O extglob", "-eo pipefail", "-x"]) {
    assert.match(unwrapped(`bash ${options} -c '${BODY}'`), /; true; forge close ISS-1 ;$/u, `-c after ${options}`);
    const written = writtenPaths(shellWrites(fed(`bash ${options}`, "cp a /m/memory/x.md")), "/w").map((one) => one.token);
    assert.ok(written.includes("/m/memory/x.md"), `stdin after ${options}: ${JSON.stringify(written)}`);
  }
});

test("an interpreter's options before a heredoc are read as they were", () => {
  const write = "open('/m/memory/x.md', 'w')";
  for (const reader of ["python3 -", "python3 -u -", "node -"]) {
    const written = writtenPaths(shellWrites(fed(reader, write)), "/w").map((one) => one.token);
    assert.ok(written.includes("/m/memory/x.md"), `${reader}: ${JSON.stringify(written)}`);
  }
  const data = writtenPaths(shellWrites(fed("python3 -X dev -", write)), "/w").map((one) => one.token);
  assert.ok(!data.includes("/m/memory/x.md"), `python3 -X dev -: ${JSON.stringify(data)}`);
});

/* env hands its `-S` string to the command it splits, and attached to the option there is no blank
   before it, so the separator is the runner's own and `env -S'…'` is a runner too (ISS-3035). */
const ATTACHED = [`env -S'${BODY}'`, `env -S"${BODY}"`, `env -iS'${BODY}'`, `env --split-string='${BODY}'`, `env --split="${BODY}"`];

test("env's split string attached to its option is opened by both readings", () => {
  for (const command of ATTACHED) {
    assert.equal(classOf("Bash", shellOf(command)), "forge close", `the corpus reads ${command}'s string as run`);
    assert.match(unwrapped(command), /; true; forge close ISS-1 ;$/u, `the gates put ${command}'s string in command position`);
  }
});

/* A `-S` some other option took as its value, one past the `--` that ends env's options, and one whose
   string is the next word are no split string of the quote behind them, which is an argument. */
test("a -S that env does not read as the quote's split string opens neither reading", () => {
  for (const command of [`env -u -S '${BODY}'`, `env -- -S '${BODY}'`, `env -S -i '${BODY}'`, `env -Su '${BODY}'`, `env --unset '${BODY}'`]) {
    assert.notEqual(classOf("Bash", shellOf(command)), "forge close", command);
    assert.equal(unwrapped(command), command, command);
  }
});

test("env's \\_ is the blank between two arguments of its split string, and a doubled backslash is not one", () => {
  assert.match(unwrapped(String.raw`env -S 'touch\_notes.md'`), /; touch notes\.md ;$/u);
  assert.match(unwrapped(String.raw`env -S 'touch\\_notes.md'`), /; touch\\\\_notes\.md ;$/u);
  assert.match(unwrapped(String.raw`sh -c 'touch\_notes.md'`), /; touch\\_notes\.md ;$/u, "a shell's -c body has no such escape");
});

const refused = (command) => answered(callHook(GATE, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command } }, HOME))
  ?.hookSpecificOutput?.permissionDecision === "deny";

test("a write env runs from its split string is refused by learning-gate, and one only quoted is not", () => {
  const write = `touch ${MEMORY}/trap.md`;
  for (const runner of ["env -S ", "env -S", "env -iS ", "env -u X -S ", "env --split-string=", "env --split-string ", "env --split=", "/usr/bin/env -S "]) {
    for (const quote of ["'", '"']) assert.equal(refused(`${runner}${quote}${write}${quote}`), true, `${runner}${quote}`);
  }
  assert.equal(refused(`env -S ${write}`), true, "unquoted, the -S string is the verb itself");
  assert.equal(refused(String.raw`env -S 'touch\_` + `${MEMORY}/trap.md'`), true, "split at env's own blank");
  assert.equal(refused(`echo "env -S '${write}'"`), false, "a mention in an argument");
  assert.equal(refused(`git commit -m "ran env -S '${write}'" -- ${MEMORY}/a.md`), false, "a mention in a commit message");
});
