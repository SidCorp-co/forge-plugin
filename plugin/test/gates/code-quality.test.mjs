/* Once answered in the delegate's own protocol — stderr and exit 2 — and so the one refusal that
   for months left no line, while docs/HOOKS.md promised every one was written down. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { linting } from "../../src/hooks/lint-delegate.mjs";
import { answered, callHook, homeEnv, pathed, tempRoom } from "../fixtures.mjs";
import { assertRouteFirst } from "../fixtures/route-first.mjs";

const HOOK = new URL("../../hooks/entries/code-quality.mjs", import.meta.url).pathname;
const REPO = new URL("../../..", import.meta.url).pathname.replace(/\/$/u, "");
const HOME = homeEnv("code-quality");
const LOG = join(HOME.XDG_CONFIG_HOME, "forge", "hook-log.jsonl");
/* Seven, two past the cap. */
const NAMES = ["a", "b", "c", "d", "e", "f", "g"].map((one) => `${one}.mjs`);

/* A probe that means to be refused says 1300 characters of comment, because that is what a
   comment costs now. On one line, which is how the same file passed the ceiling before it. */
const DENSE = `// ${"the unit is what the comment says and never the column its author wrapped it at. ".repeat(20)}\nexport const x = 1;\n`;


/* Inside this repository, so the delegate finds this project's ESLint and its density limit. */
test("a finding is refused in the delegate's protocol and written to the log like every other", () => {
  const file = join(REPO, "plugin", "test", `cq-probe-${randomUUID().slice(0, 8)}.mjs`);
  writeFileSync(file, DENSE);
  try {
    const run = callHook(
      HOOK,
      { session_id: randomUUID(), tool_name: "Write", tool_input: { file_path: file }, cwd: REPO },
      HOME,
    );
    assert.equal(run.status, 0, `exit ${run.status}: ${run.stderr}`);
    const out = JSON.parse(run.stdout);
    assert.equal(out.decision, "block");
    assert.match(out.reason, /code-quality\//u, "the delegate's finding, verbatim");
    assert.ok(existsSync(LOG), "a refusal writes the log");
    const entry = JSON.parse(readFileSync(LOG, "utf8").trim().split("\n").pop());
    assert.equal(entry.hook, "code-quality");
    assert.equal(entry.decision, "block");
    assert.match(entry.refused, /code-quality: .*cq-probe.* — code-quality\/comment-density/u, "the log names the rule, not only the file");
    /* The same content named again — a grep, say — is not a second block. */
    const again = callHook(HOOK, { session_id: entry.session, tool_name: "Bash", tool_input: { command: `grep -n one ${pathed(file)}` }, cwd: REPO }, HOME);
    assert.equal(again.stdout.trim(), "", "reported once per content");
    writeFileSync(file, `${readFileSync(file, "utf8")}// five\n`);
    const changed = callHook(HOOK, { session_id: entry.session, tool_name: "Write", tool_input: { file_path: file }, cwd: REPO }, HOME);
    assert.equal(JSON.parse(changed.stdout).decision, "block", "changed content is reported again");
  } finally {
    rmSync(file, { force: true });
  }
});

test("a clean file says nothing", () => {
  const clean = join(REPO, "plugin", "src", "tools", "vi.mjs");
  const run = callHook(
    HOOK,
    { session_id: randomUUID(), tool_name: "Write", tool_input: { file_path: clean }, cwd: REPO },
    HOME,
  );
  assert.equal(run.status, 0, run.stderr);
});

/* AC-11-1-2 and AC-17-9-1 both oblige silence where a project decided nothing, and silence is what
   a gate that never reached the file also produces — so the tree is built outside this repository,
   where nothing upward resolves, and the same file is made to speak one configuration file later. */
test("a project that configured no linter hears nothing, and the same file speaks once it configures one", () => {
  const quiet = homeEnv("code-quality-undecided");
  const log = join(quiet.XDG_CONFIG_HOME, "forge", "hook-log.jsonl");
  const room = realpathSync(tempRoom("undecided-"));
  writeFileSync(join(room, "package.json"), JSON.stringify({ name: "undecided", private: true }));
  const file = join(room, "thing.mjs");
  writeFileSync(file, DENSE);
  /* A fresh session each call: the delegate says the missing-install line once per session. */
  const call = () =>
    callHook(HOOK, { session_id: randomUUID(), tool_name: "Write", tool_input: { file_path: file }, cwd: room }, quiet);

  const said = call();
  assert.equal(said.status, 0, said.stderr);
  assert.equal(said.stdout.trim(), "", "a project that decided nothing hears nothing about its code");
  assert.equal(said.stderr, "", "and nothing on the channel the delegate refuses through either");
  assert.equal(existsSync(log), false, "and nothing is written down about it either");

  writeFileSync(join(room, "eslint.config.mjs"), "export default [];\n");
  assert.match(JSON.parse(call().stdout).reason, /configures ESLint, but ESLint is not installed/u,
    "the config alone turns the silence into speech, so the file was always reachable");

  symlinkSync(join(REPO, "node_modules"), join(room, "node_modules"));
  writeFileSync(join(room, "eslint.config.mjs"),
    'import { configure } from "eslint-plugin-code-quality";\nexport default configure({ "comment-density": "error" });\n');
  assert.match(JSON.parse(call().stdout).reason, /code-quality\/comment-density/u,
    "and with a linter behind it the same file is refused, so the silence was the decision");
});

/* Every session started in a checkout carries that checkout as CLAUDE_PROJECT_DIR, and every run a
   wave dispatches writes in a worktree beside it: the one case the gate met all day, and never
   answered (ISS-530). */
test("a file in a worktree beside the session's directory is linted by the tree that holds it", () => {
  const home = homeEnv("code-quality-worktree");
  const session = realpathSync(tempRoom("session-"));
  const worktree = realpathSync(tempRoom("worktree-"));
  writeFileSync(join(worktree, ".git"), "gitdir: /elsewhere/.git/worktrees/one\n");
  writeFileSync(join(worktree, "package.json"), JSON.stringify({ name: "worktree", private: true }));
  /* This tree's own package, not whatever the checkout's node_modules points at. */
  mkdirSync(join(worktree, "node_modules"));
  symlinkSync(join(REPO, "node_modules", "eslint"), join(worktree, "node_modules", "eslint"), "dir");
  symlinkSync(join(REPO, "packages", "code-quality"), join(worktree, "node_modules", "eslint-plugin-code-quality"), "dir");
  writeFileSync(join(worktree, "eslint.config.mjs"),
    'import { configure } from "eslint-plugin-code-quality";\nexport default configure({ "comment-density": "error" });\n');
  const file = join(worktree, "thing.mjs");
  writeFileSync(file, DENSE);
  const run = callHook(
    HOOK,
    { session_id: randomUUID(), tool_name: "Write", tool_input: { file_path: file }, cwd: session },
    { ...home, CLAUDE_PROJECT_DIR: session },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(JSON.parse(run.stdout).reason, /code-quality\/comment-density/u,
    "the worktree's own configuration answers for a file the session's directory does not hold");
});

/* The cap stays; what goes is the silence past it. Seven clean files, named in reverse, so the five
   linted are chosen by path and not by the order the call spelled them in (ISS-38). */
test("a call writing more code files than the cap is told which went unlinted, and a call inside it hears nothing", () => {
  const configured = (room) => {
    symlinkSync(join(REPO, "node_modules"), join(room, "node_modules"));
    writeFileSync(join(room, "eslint.config.mjs"),
      'import { configure } from "eslint-plugin-code-quality";\nexport default configure({ "comment-density": "error" });\n');
  };
  const wrote = (room, count) => {
    const names = NAMES.slice(0, count);
    for (const name of names) writeFileSync(join(room, name), "export const x = 1;\n");
    const command = names.reverse().map((name) => `echo 'export const x = 1;' > ${pathed(join(room, name))}`).join(" && ");
    return callHook(HOOK, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command }, cwd: room }, homeEnv("code-quality-cap"));
  };
  const room = () => {
    const at = realpathSync(tempRoom("cap-"));
    writeFileSync(join(at, "package.json"), JSON.stringify({ name: "cap", private: true }));
    return at;
  };

  const linted = room();
  configured(linted);
  const past = wrote(linted, 7);
  assert.equal(past.status, 0, past.stderr);
  const out = answered(past) ?? {};
  const said = out.hookSpecificOutput?.additionalContext ?? "";
  assert.match(said, /f\.mjs, g\.mjs/u, "the two past the cap are named");
  assert.doesNotMatch(said, /[a-e]\.mjs/u, "and none of the five that were linted");
  assert.match(said, /first 5 .*path order/u, "with the rule that chose the five");
  assert.equal(out.decision, undefined, "an unlinted file refuses nothing");

  const within = room();
  configured(within);
  assert.equal(wrote(within, 5).stdout.trim(), "", "five clean files, all linted, say nothing");

  assert.equal(wrote(room(), 7).stdout.trim(), "", "a project that configured no linter hears nothing past the cap either");
});

/* What one call's files come back as from the walk the gate spends: linted, or named with the one
   reason they were not. */
/* A tree whose delegate answers at once, clean, so the only thing a case measures is the walk. */
const walkRoom = (delegate = "process.exit(0);\n") => {
  const at = realpathSync(tempRoom("lint-walk-"));
  const scripts = join(at, "node_modules", "eslint-plugin-code-quality", "claude-plugin", "scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(join(scripts, "lint-edited-file.mjs"), delegate);
  for (const name of NAMES) writeFileSync(join(at, name), "export const x = 1;\n");
  return { at, files: NAMES.map((name) => join(at, name)) };
};

const walked = (files, left = () => 60_000, options = {}) =>
  [...linting({ session_id: "walk", cwd: "/" }, files, left, options)];

test("the files past the cap come back named, with the cap as their reason, in path order", () => {
  const { files } = walkRoom();
  const out = walked([...files].reverse());
  assert.deepEqual(out.map((one) => one.file), files, "every file comes back, in path order");
  assert.deepEqual(out.filter((one) => !one.unread).map((one) => one.file), files.slice(0, 5),
    "the five linted are the first five by path, not the first five the call named");
  assert.deepEqual(out.filter((one) => one.unread).map((one) => [one.file, one.unread]),
    files.slice(5).map((one) => [one, "cap"]));
});

test("a file the clock ran out before comes back named, with the clock as its reason", () => {
  const { files } = walkRoom();
  const out = walked(files.slice(0, 2), () => 500);
  assert.deepEqual(out.map((one) => [one.file, one.unread]), files.slice(0, 2).map((one) => [one, "clock"]));
});

test("a file the linter did not answer for in time comes back named, with the time limit as its reason", () => {
  const { files } = walkRoom("setTimeout(() => {}, 20_000);\n");
  const out = walked(files.slice(0, 1), () => 1_500);
  assert.deepEqual(out.map((one) => [one.file, one.unread, one.said]), [[files[0], "timeout", ""]]);
});

test("a file already reported at its content takes no place under the cap", () => {
  const { files } = walkRoom();
  const out = walked(files.slice(0, 6), undefined, { skip: (file) => file === files[0] });
  assert.deepEqual(out.map((one) => [one.file, one.unread ?? null]), files.slice(1, 6).map((one) => [one, null]),
    "the sixth file reaches the linter because the first was answered already");
});

/* AC-07-3-4. The findings are the linter's words, so the route ahead of them is the gate's own. */
test("every refusal this gate writes leads with its route", () => {
  const file = join(REPO, "plugin", "test", `cq-order-${randomUUID().slice(0, 8)}.mjs`);
  writeFileSync(file, DENSE);
  try {
    const run = callHook(
      HOOK,
      { session_id: randomUUID(), tool_name: "Write", tool_input: { file_path: file }, cwd: REPO },
      HOME,
    );
    const out = JSON.parse(run.stdout);
    assert.equal(out.decision, "block");
    assertRouteFirst(out.reason, "a finding");
    assert.match(out.reason, /\n\ncode-quality: /u, "the finding follows the route");
  } finally {
    rmSync(file, { force: true });
  }
});
