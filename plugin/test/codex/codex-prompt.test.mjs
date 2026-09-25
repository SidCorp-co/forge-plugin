import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { projectRecord, projectRoom, tempRoom } from "../fixtures.mjs";
import { OWN } from "../fixtures/own-project.mjs";

/* Imported after XDG_CONFIG_HOME moves, so nothing here can touch the caller's own state file. The
   record's keys are what the no-flag case reads, so this home carries that record too. */
process.env.XDG_CONFIG_HOME = tempRoom("forge-codex-prompt-");
projectRecord(process.cwd(), process.env.XDG_CONFIG_HOME, OWN);
delete process.env.FORGE_CODEX_DISABLE;

const { consultArgs } = await import("../../src/codex/codex.mjs");
const { goalsFor, promptFor, roleFor } = await import("../../src/codex/codex-api.mjs");
const { digestOf, numbered, recheckRisks } = await import("../../src/codex/log/replies.mjs");

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

/* A project is resolved once per process, so the checkout naming no check has to be another one. */
test("a checkout naming no codex.check sends no checks section", () => {
  const home = tempRoom("forge-codex-nocheck-home-");
  const room = projectRoom(tempRoom("forge-codex-nocheck-"), home, { slug: "nothing" });
  const source = new URL("../../src/codex/codex.mjs", import.meta.url).pathname;
  const run = spawnSync(
    process.execPath,
    ["-e", `import(${JSON.stringify(source)}).then((m) => process.stdout.write(JSON.stringify(m.consultArgs(["a.mjs"]).checks)))`],
    { cwd: room, encoding: "utf8", env: { ...process.env, HOME: home, XDG_CONFIG_HOME: home } },
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

/* The block and the reader are one decision, and only the block is shown to the model: a wrapper asked
   for nowhere was what seven replies were held to and failed, each recording no verdict. */
test("the verification block asks for the ruling in the shape the reader takes", () => {
  const said = promptFor("i", [], [], { risks: ["the lock is still the gateway's", "the cap moved"] })
    .replace(/\s+/gu, " ");
  assert.match(said, /answer CONFIRMED, REFUTED or CANNOT TELL in a block that opens your reply before any explanation, one unindented line per risk opening with that risk's own number/u,
    "the numbering the reader maps a ruling to a finding by");
  assert.match(said, /the ruling word first after the number or behind nothing but the finding's id/u,
    "and the head the reader stops reading at, so prose past it is never a ruling");
  assert.match(said, /1\. the lock is still the gateway's 2\. the cap moved/u, "against a list the block numbered");
});

/* The debt angle's rules are its own block, sent only where the angle is: a checkout leaving it off
   sends the prompt it sent before, clause for clause. */
test("the debt angle carries its rules, and a consult without it carries none of them", () => {
  const said = roleFor(["tech", "debt"]);
  assert.match(said, /- Debt Reviewer — what the change leaves behind, and whether it moves the code toward the project's live goals\./u);
  assert.match(said, /Rule on the change against each goal in the GOALS section that it reaches, quoting that goal's own words/u);
  for (const kind of ["a workaround where the cause should have been fixed", "a special case where configuration belongs",
    "a step that leaves a person in the loop", "a mechanism copied rather than shared", "dead code or a branch left behind",
    "a comment or doc the change makes stale", "a module grown past what it should hold, or a boundary crossed"]) {
    assert.ok(said.includes(kind), `${kind} is not among the debt the rules name`);
  }
  assert.match(said, /Debt the change removes is a gain, not a finding: write it as an unnumbered line under the angle, `Removes: <path:line> — <what>`/u);
  assert.match(said, /Only the diff is under review\. Debt you see outside it is one unnumbered line, `outside this change: <path>`, and never a refactor asked for/u);
  assert.match(said, /never supply a goal of your own/u);
  assert.ok(!roleFor(["tech"]).includes("Debt Reviewer"), "the tech angle alone sends no debt rules");
});

test("a board asks each angle to open with its own heading, and one angle is asked for none", () => {
  assert.match(roleFor(["tech", "debt"]), /Open each angle's part with a heading line carrying its name, `### <the angle's name>`/u);
  assert.ok(!roleFor(["tech"]).includes("Open each angle's part"), "one angle has no parts to head");
});

test("the goals travel in the opening with their own words, or the reason there are none", () => {
  const held = promptFor("intent", [], [], { goals: { goals: [{ id: "G-12", text: "Read from the project's configuration." }], why: null } });
  assert.match(held, /GOALS — this project's live goals, from its brief, for the Debt Reviewer to rule the change against:\n\nG-12 — Read from the project's configuration\./u);
  const none = promptFor("intent", [], [], { goals: { goals: [], why: "this project has no brief stored" } });
  assert.match(none, /GOALS — this project states none: this project has no brief stored\. The Debt Reviewer judges debt alone, says it found no goals to rule against, and supplies none of its own\./u);
  assert.ok(!promptFor("intent", [], []).includes("GOALS —"), "no goals handed, no block");
});

test("a consult without the debt angle is handed no goals, so no block and no brief read", async () => {
  assert.equal(await goalsFor(["tech", "ba"]), null);
});
