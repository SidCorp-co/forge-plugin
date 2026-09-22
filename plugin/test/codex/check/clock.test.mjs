/* The clock a declared check runs under, from the key a project writes to the number the spawn is
   handed: the reader, the report, the scope the consult builds and the room left at the call are
   four places one figure has to agree in, and this file is where they are held against each other.
   Split out of codex.test.mjs when that file crossed its line count, the seam being the subject.
   docs/cli/codex-the-check.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { escaped, projectEntry, projectRoom, tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so nothing here can touch the caller's own state file. */
const sandbox = tempRoom("forge-check-clock-");
process.env.XDG_CONFIG_HOME = sandbox;

const { runTool, scopeFor } = await import("../../../src/codex/codex-tools.mjs");
const { AROUND_CHECK_MS, codexCheckOf } = await import("../../../src/resolve/settings.mjs");

/* Resolved once and read by both the spawn that enforces it and the reports that print it, so no caller supplies a default of its own: the one this repository had sat beside its spawn, where the surfaces naming the key could not reach it and nothing could say what the pair resolved to. Derived from the clock a whole consult has rather than set beside it, because a check free to take the whole of what a caller waits in one call took it, and 26 of the 78 consults here that ran or cut one came back after the caller's call had ended (ISS-2108). */
test("the check's clock is what the consult's budget spares it, and a smaller declaration stands", async () => {
  const forge = new URL("../../../bin/forge", import.meta.url).pathname;
  /* One room, its record rewritten per reading: the path the line names where the project set the
     key is that record's, so it is composed here rather than spelt. */
  const home = tempRoom("codex-clock-home-");
  const room = projectRoom(tempRoom("codex-clock-"), home, {});
  const entry = projectEntry(room, home);
  const account = join(home, "forge", "config.json");
  const shown = (codex, own = {}) => {
    writeFileSync(entry, JSON.stringify({ codex }));
    writeFileSync(account, JSON.stringify(own));
    const run = spawnSync(forge, ["codex", "show"],
      { cwd: room, encoding: "utf8", env: { ...process.env, HOME: home, XDG_CONFIG_HOME: home } });
    return (run.stdout.split("\n").find((one) => one.startsWith("check")) ?? "").replace(/\s+/gu, " ");
  };
  const SPARED = "what a consult can spare a check: its 600s budget less the 120s after one";
  assert.equal(shown({ check: "npm test" }), `check : npm test, at most 480s \u2190 ${SPARED}`);
  assert.equal(shown({ check: "npm test", checkMs: 200000 }),
    `check : npm test, at most 200s \u2190 ${entry}`);
  /* At the ceiling exactly the declaration is still the project's own: the row says where a reader
     goes to change it, and a project that declared the whole room declared something real. */
  assert.equal(shown({ check: "npm test", checkMs: 480000 }),
    `check : npm test, at most 480s \u2190 ${entry}`);
  /* Past it, the number the project typed is not the number anything runs, so the row cannot name
     the project as its source — which is the whole of what made 600000 here readable as in force. */
  assert.equal(shown({ check: "npm test", checkMs: 600000 }),
    `check : npm test, at most 480s \u2190 ${SPARED}`);
  /* And the one key that does move the ceiling is the budget the whole consult runs under. */
  assert.equal(shown({ check: "npm test" }, { codex: { budgetMs: 900000 } }),
    "check : npm test, at most 780s \u2190 what a consult can spare a check: its 900s budget "
    + "less the 120s after one");
  /* `true` reads as 1ms and `[600000]` as 600000 under a bare coercion, and both are a clock nobody typed being reported as one the project chose. */
  for (const given of ["soon", 0, -1, 1.5, true, [600000], "600000"]) {
    assert.equal(shown({ check: "npm test", checkMs: given }),
      `check : npm test, at most 480s \u2190 ${SPARED}`,
      `${given} is no clock, so the room stands and forge doctor is where the value is named`);
  }
  assert.match(shown({ pathRe: "^src/" }), /^check : none — a codex\.check in the project's own settings names one$/u);
  /* And the resolved clock through the scope the consult builds, not the line the report prints: `codex show` staying right while the spawn takes some other number is the wiring this pair is for, and the scope is where the two meet. */
  const scoped = tempRoom("codex-clock-scope-");
  const stopped = await runTool(
    scopeFor(scoped, [], codexCheckOf({ check: "sleep 30", checkMs: 200 })), "run_check", {});
  assert.equal(stopped.error, true);
  assert.match(stopped.text, new RegExp(
    "ran past 0\\.2s and was stopped\\. That clock is `codex\\.checkMs` in "
    + escaped(projectEntry(process.cwd(), sandbox)), "u"), stopped.text);
  assert.equal(scopeFor(scoped, [], codexCheckOf({ check: "true" })).check.ms, 480_000,
    "and a project naming no clock reaches that scope with the room its budget spares one");
  /* The third figure, which no reading taken before a consult can answer for: what the spawn is
     handed is the room left at the call it was made on, so a declaration of 480s here runs for two
     seconds because two seconds is what this consult had. */
  const late = scopeFor(scoped, [], codexCheckOf({ check: "sleep 30" }),
    { by: Date.now() + AROUND_CHECK_MS + 2_000 });
  const cut = await runTool(late, "run_check", {});
  const hit = /ran past ([\d.]+)s and was stopped\. That clock is the ([\d.]+)s this consult had left of its 600s budget/u
    .exec(cut.text);
  assert.ok(hit, cut.text);
  assert.equal(hit[1], hit[2], "the clock it was stopped at is the room it was given, said once");
  assert.ok(Number(hit[1]) > 1 && Number(hit[1]) < 2.1, `the room and not the 480s resolved: ${cut.text}`);
  assert.match(cut.text, /raise `codex\.budgetMs`/u,
    "and the key that could have moved it, which is never the project's own clock here");
});
