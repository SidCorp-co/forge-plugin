/* What `finish` does with the consults a run logged in its scratch before the scratch goes (ISS-2659):
   the machine's log is the corpus every eval reads, and the scratch is the only other copy. The rest
   of what `finish` refuses and removes is `finish.test.mjs`'s. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { BARE, OWN_SLUG, declaredIn, git, pushed, runIn } from "../run-fixtures.mjs";
import { escaped, tempRoom } from "../../../../plugin/test/fixtures.mjs";
import { carried } from "../../../run/workspace/corpus-carried.mjs";

const KEY = "ISS-88";

const started = (name) => {
  const { work } = pushed(name);
  writeFileSync(join(work, ".gitignore"), "node_modules\n");
  git(work, "add", ".gitignore");
  git(work, "commit", "-m", "what a linked worktree borrows");
  git(work, "push", "origin", "HEAD:master");
  const run = runIn(work, ["start", KEY, "corpus"], BARE);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  const tree = join(dirname(work), `wt-${OWN_SLUG}-${KEY}`);
  const scratch = readFileSync(join(work, ".git", "worktrees", `wt-${OWN_SLUG}-${KEY}`, "forge-run-scratch"), "utf8").trim();
  const home = tempRoom(`${name}-home-`);
  declaredIn(work, home);
  return { work, tree, scratch, home, env: { ...BARE, XDG_CONFIG_HOME: home }, machine: join(home, "forge", "codex-log.jsonl") };
};

/* As `forge codex` writes them: a start, its consult, the verdict on it, and a second consult whose
   reply is not ASCII, so a copy that re-encoded anything would not be byte for byte. */
const ROWS = [
  { kind: "started", id: "a1b2c3", at: "2026-09-27T01:00:00.000Z", root: "/r", run: "iss-88-x" },
  { kind: "consult", id: "a1b2c3", at: "2026-09-27T01:00:05.000Z", ok: true, reply: "F1 — minor", run: "iss-88-x" },
  { kind: "verdict", of: "a1b2c3", at: "2026-09-27T01:01:00.000Z", accepted: ["F1"] },
  { kind: "consult", id: "d4e5f6", at: "2026-09-27T01:02:00.000Z", ok: true, reply: "không có gì", run: "iss-88-x" },
].map((one) => JSON.stringify(one));

const logAt = (dir, rows, tail = "") => {
  mkdirSync(join(dir, "forge"), { recursive: true });
  const at = join(dir, "forge", "codex-log.jsonl");
  writeFileSync(at, `${rows.join("\n")}\n${tail}`);
  return at;
};

const machineLog = (machine, text) => {
  mkdirSync(dirname(machine), { recursive: true });
  writeFileSync(machine, text);
};

test("finish appends every row its run home's log holds that the machine log lacks, byte for byte, and says so before the scratch goes", () => {
  const { work, tree, scratch, env, machine } = started("corpus-carried");
  const from = logAt(join(scratch, "home"), ROWS, "{\"kind\":\"consult\",\"id\":\"torn");
  const before = `${JSON.stringify({ kind: "consult", id: "000000", ok: true, reply: "the machine's own" })}\n`;
  machineLog(machine, before);

  const run = runIn(work, ["finish", KEY], env);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.equal(readFileSync(machine, "utf8"), `${before}${ROWS.join("\n")}\n`, "the rows are not the run home's lines, in order, once");
  const said = `  carried  4 row(s), 2 of them consult(s), from ${from} into ${machine}`;
  assert.ok(run.stdout.includes(said), run.stdout);
  assert.ok(run.stdout.indexOf(said) < run.stdout.indexOf(`  removed  ${scratch}`), `the count is printed after the removal:\n${run.stdout}`);
  assert.ok(!existsSync(scratch) && !existsSync(tree), run.stdout);
});

test("finish whose run-home rows are all in the machine log already leaves it byte-identical and says it added none", () => {
  const { work, scratch, env, machine } = started("corpus-present");
  const from = logAt(join(scratch, "home"), ROWS);
  const before = `${ROWS.join("\n")}\n`;
  machineLog(machine, before);

  const run = runIn(work, ["finish", KEY], env);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.equal(readFileSync(machine, "utf8"), before);
  assert.ok(run.stdout.includes(`  carried  no row: ${from} holds none that ${machine} lacks`), run.stdout);
});

test("a second carry of the same log adds nothing, and a machine log torn at its end keeps the torn line apart", () => {
  const scratch = tempRoom("corpus-twice-");
  const home = tempRoom("corpus-twice-home-");
  logAt(join(scratch, "home"), ROWS);
  const machine = join(home, "forge", "codex-log.jsonl");
  machineLog(machine, "{\"kind\":\"consult\",\"id\":\"torn");
  const was = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = home;
  try {
    assert.equal(carried(scratch).rows, 4);
    const first = readFileSync(machine, "utf8");
    assert.equal(first, `{"kind":"consult","id":"torn\n${ROWS.join("\n")}\n`);
    const again = carried(scratch);
    assert.deepEqual([again.rows, again.consults], [0, 0]);
    assert.equal(readFileSync(machine, "utf8"), first);
  } finally {
    if (was === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = was;
  }
});

/* The way a run finishes its own tree: standing in its run home, borrowing the machine's config. */
test("finish under a borrowing run home appends to the log beside the borrowed config and not to the run home's own", () => {
  const { work, scratch, home, machine } = started("corpus-borrow");
  const runHome = join(scratch, "home");
  const own = logAt(runHome, ROWS);
  writeFileSync(join(home, "forge", "config.json"), "{}\n");
  const env = { ...BARE, XDG_CONFIG_HOME: runHome, FORGE_BORROW_FROM: join(home, "forge", "config.json") };

  const run = runIn(work, ["finish", KEY], env);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.equal(readFileSync(machine, "utf8"), `${ROWS.join("\n")}\n`);
  assert.ok(run.stdout.includes(`from ${own} into ${machine}`), run.stdout);
});

test("finish whose machine log cannot be written leaves the whole workspace, ends on the retry, and the retry carries the rows", {
  skip: process.getuid?.() === 0 && "root writes a read-only file",
}, () => {
  const { work, tree, scratch, env, machine } = started("corpus-refused");
  logAt(join(scratch, "home"), ROWS);
  machineLog(machine, "");
  chmodSync(machine, 0o444);

  const run = runIn(work, ["finish", KEY], env);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(scratch) && existsSync(tree), `the workspace did not stay:\n${run.stdout}${run.stderr}`);
  const last = run.stderr.trim().split("\n").at(-1);
  const retry = new RegExp(`^  failed   the scratch directory ${escaped(scratch)} was not removed \\(its consult rows were not carried `
    + `into the machine's log: .*\\); retry it with: (.*)$`, "u").exec(last)?.[1];
  assert.ok(retry, last);

  chmodSync(machine, 0o644);
  const again = spawnSync("sh", ["-c", retry], { cwd: work, encoding: "utf8", env });
  assert.equal(again.status, 0, again.stderr + again.stdout);
  assert.equal(readFileSync(machine, "utf8"), `${ROWS.join("\n")}\n`, again.stdout);
  assert.ok(!existsSync(scratch) && !existsSync(tree), again.stdout);
});

/* A borrow that reaches the scratch through a link names a log outside it and writes the one inside
   it: what it would carry into is the copy being removed, so nothing may go. */
test("finish whose machine log is the run home's own through a link leaves the whole workspace and says why", () => {
  const { work, tree, scratch, home, env } = started("corpus-linked");
  const own = logAt(join(scratch, "home"), ROWS);
  writeFileSync(join(scratch, "home", "forge", "config.json"), "{}\n");
  const link = join(home, "linked");
  symlinkSync(join(scratch, "home", "forge"), link);

  const run = runIn(work, ["finish", KEY], { ...env, FORGE_BORROW_FROM: join(link, "config.json") });
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(scratch) && existsSync(tree), `the workspace did not stay:\n${run.stdout}${run.stderr}`);
  assert.equal(readFileSync(own, "utf8"), `${ROWS.join("\n")}\n`);
  assert.match(run.stderr, /inside the scratch itself, so no copy outlives it/u, run.stderr);
});

/* The same log reached two more ways: a link left dangling into the scratch, whose target only the
   append makes, and a directory of the scratch whose name opens with two dots. */
test("finish refuses a machine log that lands in the scratch through a dangling link or a dot-dot name", () => {
  const { work, tree, scratch, home, env } = started("corpus-spelled");
  const own = logAt(join(scratch, "home"), ROWS);
  mkdirSync(join(scratch, "sink"));
  const beside = join(home, "dangling");
  mkdirSync(beside);
  writeFileSync(join(beside, "config.json"), "{}\n");
  symlinkSync(join(scratch, "sink", "codex-log.jsonl"), join(beside, "codex-log.jsonl"));
  const dotted = join(scratch, "..machine");
  mkdirSync(dotted);
  writeFileSync(join(dotted, "config.json"), "{}\n");
  declaredIn(work, scratch);

  for (const borrowed of [join(beside, "config.json"), join(dotted, "config.json")]) {
    const run = runIn(work, ["finish", KEY], { ...env, FORGE_BORROW_FROM: borrowed });
    assert.equal(run.status, 1, `${borrowed}:\n${run.stdout}`);
    assert.match(run.stderr, /inside the scratch itself, so no copy outlives it/u, run.stderr);
  }
  assert.ok(existsSync(scratch) && existsSync(tree), "the workspace did not stay");
  assert.equal(readFileSync(own, "utf8"), `${ROWS.join("\n")}\n`);
});

/* The layout a run whose home was the scratch itself left (ISS-189), which a scratch may still hold. */
test("finish carries a consult log kept directly under the scratch as it does one under its home", () => {
  const { work, scratch, env, machine } = started("corpus-legacy");
  const from = logAt(scratch, ROWS);

  const run = runIn(work, ["finish", KEY], env);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.equal(readFileSync(machine, "utf8"), `${ROWS.join("\n")}\n`);
  assert.ok(run.stdout.includes(`  carried  4 row(s), 2 of them consult(s), from ${from} into ${machine}`), run.stdout);
});
