import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so nothing here can touch the caller's own state file. */
process.env.XDG_CONFIG_HOME = tempRoom("forge-codex-prompt-");
delete process.env.FORGE_CODEX_DISABLE;

const { consultArgs } = await import("../../src/codex/codex.mjs");
const { promptFor, roleFor } = await import("../../src/codex/codex-api.mjs");
const { digestOf, numbered, recheckRisks } = await import("../../src/codex/codex-log.mjs");

/* 149 of 1,014 ruled findings were dropped, and the two largest classes — real but outside the
   issue, and something a checker already holds — are things the prompt never told the reviewer. */
test("prompt v3 asks a finding for what fails, the fix, its proof and whether it was read", () => {
  const said = roleFor(["tech"]);
  for (const clause of ["**Fails when**", "**Fix**", "**Proven by**", "**Read**", "**Inferred**"]) {
    assert.ok(said.includes(clause), `${clause} is not in the prompt: ${said.slice(0, 200)}`);
  }
  assert.match(said, /One missing any of them is not made/u);
  assert.match(said, /OUT OF SCOPE/u);
  assert.match(said, /those lines are not counted in the findings line/u, "or the heading puts back the number it exists to take out");
  assert.match(said, /may follow `CODEX: 0 findings`/u, "the case where everything real was out of scope");
  assert.match(said, /PRE-EXISTING whatever the scope text says/u, "two closing headings cannot both claim one finding");
  assert.match(said, /CHECKS THIS PROJECT RUNS/u);
});

/* A recheck answers a list it already wrote; asking it for five clauses on those findings is the
   round the RECHECK block exists to stop. Only the clause an earlier round could not supply stays. */
test("a recheck keeps its own form, and gains only the Read or Inferred clause", () => {
  const said = roleFor(["tech"], { recheck: true });
  assert.ok(!said.includes("Every finding carries five clauses"), "the five-clause mandate is a first review's");
  assert.ok(!said.includes("**Fails when**") && !said.includes("**Proven by**"), said.slice(-400));
  assert.match(said, /A New finding carries one clause and only one: \*\*Read\*\*/u);
});

/* The scope is the issue's own sentence and the check is the project's own command: this end
   composing either would move the boundary the reviewer is judged against. */
test("the out-of-scope text and the checks are the caller's, and absent they are not asked about", () => {
  const parts = [{ rel: "a.mjs", text: "code", chars: 4, sha: "x" }];
  const filled = promptFor("now", parts, [], { scope: "The tool-result hints (ISS-326).", checks: "npm run check" });
  assert.match(filled, /OUT OF SCOPE for the issue I am working[\s\S]*The tool-result hints \(ISS-326\)\./u);
  assert.match(filled, /CHECKS THIS PROJECT RUNS[\s\S]*npm run check/u);
  const bare = promptFor("now", parts, []);
  assert.ok(!bare.includes("OUT OF SCOPE for the issue I am working"), "no scope given, none claimed");
  assert.ok(!bare.includes("CHECKS THIS PROJECT RUNS"), "no checks given, none claimed");
  assert.equal(consultArgs(["a.mjs", "--out-of-scope", "per-angle subagents"]).scope, "per-angle subagents");
  assert.equal(consultArgs(["a.mjs", "--checks", "npm test"]).checks, "npm test");
  assert.equal(consultArgs(["a.mjs"]).scope, "", "a scope this end invented is a boundary the issue never drew");
  assert.equal(consultArgs(["a.mjs"]).checks, "npm test", "and this checkout's own codex.check stands where no flag came");
});

/* `.forge.json` is read once per process, so the checkout naming no check has to be another one. */
test("a checkout naming no codex.check sends no checks section", () => {
  const room = tempRoom("forge-codex-nocheck-");
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "nothing" }));
  const source = new URL("../../src/codex/codex.mjs", import.meta.url).pathname;
  const run = spawnSync(
    process.execPath,
    ["-e", `import(${JSON.stringify(source)}).then((m) => process.stdout.write(JSON.stringify(m.consultArgs(["a.mjs"]).checks)))`],
    { cwd: room, encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: tempRoom("forge-codex-nocheck-home-") } },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, '""', "nothing to name is nothing sent, not a guess at the gate");
});

/* Reading the bullet alone had a recheck ask for a ruling on a finding stripped of the fix and the
   proof that were the point of asking for it. */
test("a v3 finding's clauses are part of the finding, and the bullet is still what places it", () => {
  const reply = [
    "CODEX: 2 findings (0 blocker, 2 major, 0 minor)",
    "",
    "- **F1 — New — major:** `a.mjs:12` — \"const held = readFileSync(path)\"",
    "  **Fails when** the path is a fifo: the read never returns.",
    "  **Fix** stat before reading, in `readOrRefuse`, a.mjs.",
    "  **Proven by** a case feeding it a fifo; none exists yet.",
    "  **Read** read_file a.mjs.",
    "- **F2 — Still open — minor:** `b.mjs:4` — \"x\"",
    "  **Inferred**",
    "",
    "OUT OF SCOPE",
    "- the retry ladder belongs to another issue.",
  ].join("\n");
  const found = numbered(reply);
  assert.deepEqual(found.map((one) => one.id), ["F1", "F2"], "the clauses do not become findings of their own");
  for (const clause of ["**Fails when**", "**Fix**", "**Proven by**", "**Read**"]) {
    assert.ok(found[0].text.includes(clause), `${clause} left the finding: ${found[0].text}`);
  }
  assert.ok(!found[0].text.includes("Still open"), "and it stops at the next bullet");
  const nested = "- **F1 — New — major:** `a.mjs:1` — one.\n  **Fix** rename it.\n  - **F2 — New — minor:** `a.mjs:2` — two.";
  assert.deepEqual(numbered(nested).map((one) => one.id), ["F1", "F2"], "an indented finding is still its own");
  assert.ok(!numbered(nested)[0].text.includes("two."), "and is not swallowed as the one above it's clause");
  assert.ok(!found[1].text.includes("retry ladder"), "an unindented closing heading is not a clause");
  assert.deepEqual(numbered(reply, ["a.mjs"]).map((one) => one.id), ["F1"], "the bullet's own anchor places it, not the Fix clause's path");
  assert.equal(found[0].head, "New — major: `a.mjs:12` — \"const held = readFileSync(path)\"");
  assert.match(digestOf(reply, null), /\*\*Proven by\*\*/u, "so a replayed finding keeps its clauses");
});

/* A blank line before or between the clauses is a layout the prompt does not forbid, and stopping
   at it left a recheck asking whether a defect still stands without carrying what the defect was. */
test("a blank line inside a finding's clauses is not the end of them", () => {
  const reply = [
    "- **F1 — New — major:** `a.mjs:1` — \"held = read(path)\"",
    "",
    "  **Fails when** the path is a fifo.",
    "",
    "  **Fix** stat first, in `readOrRefuse`.",
    "  **Proven by** a case feeding it a fifo.",
    "  **Read** read_file a.mjs.",
    "",
    "",
    "OUT OF SCOPE",
    "  the retry ladder belongs to another issue.",
  ].join("\n");
  const found = numbered(reply);
  assert.equal(found.length, 1);
  for (const clause of ["**Fails when**", "**Fix**", "**Proven by**", "**Read**"]) {
    assert.ok(found[0].text.includes(clause), `${clause} was dropped at a blank line: ${found[0].text}`);
  }
  assert.ok(!found[0].text.includes("retry ladder"), "two blanks is the break before a closing section");
  assert.match(digestOf(reply, null), /\*\*Fix\*\*/u, "and the replayed history carries them too");
  const risks = recheckRisks(
    [{ kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs"], reply }],
    "/a",
    ["a.mjs"],
  );
  assert.match(risks[0], /\*\*Proven by\*\*/u, "so the round that follows the finding is asked about the whole of it");
});
