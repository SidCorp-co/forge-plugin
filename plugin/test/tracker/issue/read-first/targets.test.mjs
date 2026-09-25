/* Which issues a call writes to, and the gate over them. The target is the verb's own argument, so
   a reference in a heredoc or a path is no target (ISS-36's shape), and a uuid is one — the form
   that steps around a gate reading keys out of the text (ISS-33). */
import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { joined, targetsOfTool, writeTargets } from "../../../../src/tracker/issue-read.mjs";
import { isReference } from "../../../../src/tracker/issues.mjs";
import { shellText, starts } from "../../../../hooks/_hook.mjs";
import { OWN } from "../../../fixtures/own-project.mjs";
import { pathed, projectRoom, tempRoom } from "../../../fixtures.mjs";
import { assertRouteFirst } from "../../../fixtures/route-first.mjs";
import { HOME, OTHER, UUID, because, comment, edgeWrite, gate, live, owed, raw, state, whole }
  from "./gate.mjs";

const bash = (command) => ({ name: "Bash", input: { command } });
/* The hook's own wiring: the target is read where a command starts, so it is given the starts. */
const targets = (command) => writeTargets(bash(command), starts(shellText(joined(command))));

test("every verb that writes the record names its issue, and the read verbs name none", () => {
  const owed = {
    "forge comment ISS-29 @n.md": ["ISS-29"],
    "forge comment ISS-29": [],
    "forge comment ISS-29 --title T": [],
    "forge comment ISS-29 --title T @n.md": ["ISS-29"],
    "forge comment ISS-29 --title T -": ["ISS-29"],
    "forge comment --title T ISS-29 @n.md": ["ISS-29"],
    "forge record plan ISS-29 -": ["ISS-29"],
    "forge claim ISS-29 --next 'go on'": ["ISS-29"],
    "forge attach issue ISS-29 shot.png": ["ISS-29"],
    "forge record verdict ISS-29 --criterion 1 --verdict pass": ["ISS-29"],
    "forge record criteria ISS-29 /tmp/c.md": ["ISS-29"],
    "forge advance ISS-29": ["ISS-29"],
    "forge advance ISS-29 --park unshippable --why 'no'": ["ISS-29"],
    "forge issue ISS-30 --blocks ISS-29": ["ISS-29"],
    "forge issue --blocks ISS-29 ISS-30": ["ISS-29"],
    "forge issue ISS-30 --relates ISS-29": ["ISS-30"],
    "forge issue ISS-30 --unlink ISS-29": ["ISS-30"],
    "forge issue ISS-29 --full": [],
    "forge issue --status open": [],
    "forge resume ISS-29": [],
    "forge resume ISS-29 --report": [],
    "forge advance ISS-29 --owed": [],
    "forge attach comment 8f14e45f-ceea-467a-9bfe-2b0b1c0a1d2f x.png": [],
    "forge new /tmp/body.md --title x": [],
  };
  for (const [command, want] of Object.entries(owed)) {
    assert.deepEqual(targets(command), want, command);
  }
});

/* The three defects of the old reader, each its own case: a key was scraped from the whole command,
   so a citation or a filename was owed a read; and no key meant no gate, so the uuid form passed. */
test("only the argument the verb writes to is a target", () => {
  assert.deepEqual(targets("forge record plan ISS-29 @plan.md # supersedes ISS-30"), ["ISS-29"]);
  assert.deepEqual(targets("forge record criteria ISS-29 /tmp/ISS-30-criteria.md"), ["ISS-29"]);
  const heredoc = "cat > /tmp/c.md <<'EOF'\n1. FR-05 and UC-05 say so, as ISS-30 does\nEOF\nforge record plan ISS-29 -";
  assert.deepEqual(targets(heredoc), ["ISS-29"], "a body is data, and a clause is not a tracker key");
  assert.deepEqual(targets("echo 'run forge comment ISS-29 @n.md' > note.md"), [],
    "a quoted string holds no command position");
  assert.deepEqual(targets("grep -rn 'forge advance ISS-29' docs/"), [], "and prose naming a verb is not it");
});

/* The shell takes the quotes off before the verb is called, so a gate that reads the text has to
   take them off too — measured on the double-quoted form, which reached the parser with them on. */
test("a reference in quotes is a reference, however the quotes fall in it", () => {
  assert.deepEqual(targets(`forge comment "ISS-29" @n.md`), ["ISS-29"]);
  assert.deepEqual(targets("forge comment 'ISS-29' @n.md"), ["ISS-29"]);
  assert.deepEqual(targets(`forge comment ISS"-"29 @n.md`), ["ISS-29"], "a quote inside a word joins it");
  assert.deepEqual(targets(`forge comment I"S"S'-2'9 @n.md`), ["ISS-29"], "on either form, any number of times");
  assert.deepEqual(targets(String.raw`forge comment ISS\-29 @n.md`), ["ISS-29"], "a backslash escapes what follows");
  assert.deepEqual(targets(String.raw`forge comment "ISS\-29" @n.md`), [],
    "except inside double quotes, where it stays a character unless what follows is a special");
  assert.deepEqual(targets(`forge comment "ISS'-29" @n.md`), [],
    "while inside one quote the other is a character, so this names no issue and neither does the verb");
  assert.deepEqual(targets("forge comment ISS-2\\\n9 @n.md"), ["ISS-29"],
    "and the physical lines a shell joins are joined here first, or a continuation inside a "
    + "reference would leave the write unseen");
  assert.deepEqual(targets(String.raw`echo x\\` + "\nforge comment ISS-29 @n.md"), ["ISS-29"],
    "while a backslash that escapes a backslash leaves the newline a separator, so the write on the "
    + "next line is still a write and is not swallowed into the line before it");
  assert.deepEqual(targets("forge comment 'ISS-2\\\n9' @n.md"), [],
    "inside single quotes a shell joins nothing, so neither does this and the verb sees the literal");
  assert.deepEqual(targets(`echo "it's" && \\` + "\nforge comment ISS-29 @n.md"), ["ISS-29"],
    "and an apostrophe inside double quotes opens no quote, so the continuation after it joins and "
    + "the verb past the separator is still the verb");
  assert.deepEqual(targets(`echo "it's" \\` + "\nforge comment ISS-29 @n.md"), [],
    "while a join with no separator makes the write an argument of echo, which is what a shell does");
  assert.deepEqual(targets(`forge attach "issue" ISS-29 a.png`), ["ISS-29"], "and so is the target word");
  assert.deepEqual(targets(`forge advance "ISS-29" --owed`), [], "while a read stays a read");
});

/* A value is one word: the read this verb has is `--owed`, and a park whose reason held those six
   characters read as one until the words were counted the way a shell counts them. */
test("a flag inside a quoted value is not that flag", () => {
  assert.deepEqual(targets(`forge advance ISS-29 --park "reason --owed"`), ["ISS-29"]);
  assert.deepEqual(targets(`forge record park ISS-29 --why "it says --owed in it"`), ["ISS-29"]);
  assert.deepEqual(targets(String.raw`forge advance ISS-29 --park reason\ --owed`), ["ISS-29"],
    "and a space escaped by a backslash joins its word as surely as a quote does");
  assert.deepEqual(targets("forge advance ISS-29 --owed"), [], "while the flag itself is still the flag");
});

test("the uuid form is a target, so the form is no way around this", () => {
  assert.deepEqual(targets(`forge comment ${UUID} @n.md`), [UUID]);
  assert.deepEqual(targetsOfTool("forge_issues", { action: "update", documentId: UUID, data: { plan: "x" } }), [UUID],
    "on the raw surface too, where a uuid is all a payload ever carries");
});

test("a prefix before the verb is still the verb", () => {
  for (const command of [
    "sudo forge comment ISS-29 @n.md",
    "(forge comment ISS-29 @n.md)",
    "NOTE=x forge comment ISS-29 @n.md",
    "/usr/local/bin/forge record plan ISS-29 -",
    `sh -c "forge comment ISS-29 @n.md"`,
    "cd /tmp && forge advance ISS-29",
  ]) {
    assert.deepEqual(targets(command), ["ISS-29"], command);
  }
});

/* The one raw surface left is a connected MCP client, so a payload is judged where it still arrives
   from: no verb of this CLI types a tool name, and the arguments come already parsed. */
test("a raw call is judged by its action, and the mark carries its issue inside data", () => {
  const call = (input) => targetsOfTool("forge_issues", input);
  assert.deepEqual(call({ action: "transition", documentId: "ISS-29", data: { status: "closed" } }), ["ISS-29"]);
  assert.deepEqual(call({ action: "mark_merged", data: { issueId: "ISS-29", note: "merged" } }), ["ISS-29"]);
  assert.deepEqual(call({ action: "get", documentId: "ISS-29" }), [], "a get reads");
  assert.deepEqual(call({ action: "list" }), []);
  const said = (input) => targetsOfTool("forge_comments", input);
  assert.deepEqual(said({ action: "create", data: { issue: "ISS-29", body: "x" } }), ["ISS-29"]);
  assert.deepEqual(said({ action: "list", filters: { issue: "ISS-29" } }), []);
  assert.deepEqual(said({ action: "delete", documentId: UUID }), [],
    "and a comment's own id names no issue to read the comments of");
});

test("the tracker's own tool is judged by its action, with its arguments already parsed", () => {
  const mcp = (action, input) => writeTargets({ name: "mcp__forge__forge_issues", input: { action, ...input } }, []);
  assert.deepEqual(mcp("update", { documentId: "ISS-29" }), ["ISS-29"]);
  assert.deepEqual(mcp("get", { documentId: "ISS-29" }), []);
  assert.deepEqual(targetsOfTool("forge_memory", { action: "write" }), [], "and a tool with no issue has no target");
});

test("one command writing to two issues names both, so one refusal answers both", () => {
  assert.deepEqual(targets("forge advance ISS-29 && forge advance ISS-30"), ["ISS-29", "ISS-30"]);
  assert.deepEqual(targets("forge advance ISS-29 && forge claim ISS-29"), ["ISS-29"], "and one issue once");
});

/* End to end: the pure functions above decide what is owed, but the deny, its text and the two
   stand-downs are the hook's, and only running it against a tracker measures those — the harness
   for that is `./gate.mjs`, which the suite beside this one runs the gate through too. */

test("a write to an issue with comments nobody was shown is denied, and they are in the deny", async () => {
  owed({ [UUID]: [comment("c1", "read this before you write")] });
  const run = await gate(edgeWrite());
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny");
  assert.ok(because(run).includes("read this before you write"), "the comment itself, not a pointer to it");
  assert.ok(!because(run).includes("UNTRUSTED_DATA"), "and the tracker's marker is off it: the transport took it");
  assert.match(because(run), /forge hooks --how issue-read-first/u);
});

test("the re-send passes, and no read of the transcript decided either answer", async () => {
  assert.equal((await gate(edgeWrite(), { fresh: false })).out, null);
  const source = readFileSync(new URL("../../../../hooks/gates/issue-read-first.mjs", import.meta.url), "utf8");
  assert.ok(!/transcript/u.test(source), "the gate that read one credited another turn's read and missed its own");
});

/* The run's own record was quoted back at it on every write after it, once per half of the gate,
   because the CLI credited the id the command exported and this hook asked under the one its harness
   was handed. Two harness ids and one run is the shape that tells those two readings apart. */
test("the id the command grants is whose reading counts, and a second harness id is not a second run", async () => {
  owed({ [UUID]: [comment("c1", "the record this run wrote thirty seconds ago")] });
  const command = `export FORGE_SESSION_ID=the-run && ${edgeWrite()}`;
  const first = await gate(command, { harness: "harness-one" });
  assert.equal(first.out.hookSpecificOutput.permissionDecision, "deny", "nobody has been shown it yet");
  assert.equal((await gate(command, { harness: "harness-two" })).out, null,
    "and the credit is the run the command names, which outlives the session that spawned it");
});

/* The other half of the same reading: crediting the harness would satisfy every run under it, and a
   run of its own has been shown nothing by its dispatcher having looked. */
test("a command granting an id nobody credited is denied, whatever the harness was shown", async () => {
  owed({ [UUID]: [comment("c2", "shown to the harness and to no run of its own")] });
  const shown = await gate(edgeWrite(), { harness: "harness-three" });
  assert.equal(shown.out.hookSpecificOutput.permissionDecision, "deny", "the harness has not looked either");
  assert.equal((await gate(edgeWrite(), { harness: "harness-three" })).out, null, "and now it has");
  const own = await gate(`export FORGE_SESSION_ID=another-run && ${edgeWrite()}`, { harness: "harness-three" });
  assert.equal(own.out.hookSpecificOutput.permissionDecision, "deny",
    "which satisfies nothing for a run that has not");
});

/* The shape a run in a worktree writes all day: the assignment stands behind the `cd` that reaches
   the tree, and it was read only where it led the whole text — so the CLI credited the exported name,
   this hook asked under the harness's uuid, and every write was held on the one before it (ISS-672).
   The tree it moves to carries a project file, because the gate now resolves a key in the project
   the command runs in and says nothing where a directory names none (ISS-1190). */
test("a run whose assignment stands behind a cd is one run across its writes", async () => {
  owed({ [UUID]: [comment("c3", "the record this run wrote a minute ago")] });
  const exported = `cd ${pathed(SAME_PROJECT)} && export FORGE_SESSION_ID=behind-a-cd && ${edgeWrite()}`;
  const held = await gate(exported, { harness: "harness-four" });
  assert.equal(held.out.hookSpecificOutput.permissionDecision, "deny", "nobody has been shown it yet");
  assert.equal((await gate(exported, { harness: "harness-five" })).out, null,
    "and the second write is the same run, whatever session the harness names");
  const prefixed = `cd ${pathed(SAME_PROJECT)} && FORGE_SESSION_ID=on-the-writer /usr/bin/${edgeWrite()}`;
  const alone = await gate(prefixed, { harness: "harness-six" });
  assert.equal(alone.out.hookSpecificOutput.permissionDecision, "deny", "the prefix names a run of its own");
  assert.equal((await gate(prefixed, { harness: "harness-seven" })).out, null, "and its own second write passes");
  const other = `cd ${pathed(SAME_PROJECT)} && export FORGE_SESSION_ID=another-worktree-run && ${edgeWrite()}`;
  const stranger = await gate(other, { harness: "harness-four" });
  assert.equal(stranger.out.hookSpecificOutput.permissionDecision, "deny",
    "while a third run is shown nothing by either of them having looked");
});

/* The shape a delegated run writes all day, and the one ISS-497's fix did not survive: the prefix
   names the run and the `2>&1` captures the refusal this CLI writes to stderr, so a class over the
   words after the verb refused the whole prefix and credited the wave. The write after each record
   was then held on that record, and this repository's prose puts the second half of it — a
   metacharacter inside a quoted value — in nearly every `--why` it types (ISS-858). */
test("a granted call keeps its name through a redirection and through a quoted metacharacter", async () => {
  owed({ [UUID]: [comment("c4", "the record this run wrote a moment ago")] });
  const redirected = `FORGE_SESSION_ID=through-a-redirect ${edgeWrite()} 2>&1`;
  const held = await gate(redirected, { harness: "harness-eight" });
  assert.equal(held.out.hookSpecificOutput.permissionDecision, "deny", "nobody has been shown it yet");
  assert.equal((await gate(redirected, { harness: "harness-nine" })).out, null,
    "and the re-send is the same run, whatever session the harness names");
  const other = `FORGE_SESSION_ID=another-redirected-run ${edgeWrite()} 2>&1`;
  const stranger = await gate(other, { harness: "harness-eight" });
  assert.equal(stranger.out.hookSpecificOutput.permissionDecision, "deny",
    "while a second name is shown nothing by the first having looked");
  const quoted = `FORGE_SESSION_ID=through-a-quote ${edgeWrite()} --why "flags & payload (both)"`;
  const first = await gate(quoted, { harness: "harness-ten" });
  assert.equal(first.out.hookSpecificOutput.permissionDecision, "deny", "the value names a run of its own");
  assert.equal((await gate(quoted, { harness: "harness-eleven" })).out, null, "whose own second write passes");
});

/* The shape a worktree run writes once it has already stood there a while: no `cd` and no grant in
   the text, so the hook's own guess falls to the harness id while the CLI, standing in the tree,
   would resolve the worktree's own. The issue's own live lease already names that run, and that is
   who a write here has to be for the tracker to accept it, so trusting it costs nothing the write
   does not already trust (ISS-1558). */
const leased = (holder, renewedAt = new Date().toISOString(), minutes = 60) => ({
  lease: { holder, agent: "a", pid: "1", renewedAt, minutes, next: null, history: [] },
});

const noTree = projectRoom(tempRoom("read-first-alias-no-tree-"), HOME.path, OWN);

test("a live lease's own minted holder is trusted as an alias where the hook's own guess falls to the wave", async () => {
  const holder = "iss-950-aaaaaaaa";
  owed({ [UUID]: [comment("c10", "the record this run wrote from its own worktree")] });
  state.issues[0].sessionContext = leased(holder);
  const granted = `export FORGE_SESSION_ID=${holder} && ${edgeWrite()}`;
  const first = await gate(granted, { harness: "harness-worktree-a", cwd: noTree });
  assert.equal(first.out.hookSpecificOutput.permissionDecision, "deny", "nobody has been shown it yet");
  const bare = await gate(edgeWrite(), { harness: "harness-worktree-b", cwd: noTree });
  assert.equal(bare.out, null,
    "the hook's own guess falls to the wave id, but the issue's own live lease holder already read this");
  delete state.issues[0].sessionContext;
});

test("a live lease alias never covers a comment its holder has not actually read", async () => {
  const holder = "iss-951-bbbbbbbb";
  owed({ [UUID]: [comment("c11", "a correction nobody under this holder has read yet")] });
  state.issues[0].sessionContext = leased(holder);
  const run = await gate(edgeWrite(), { harness: "harness-worktree-c", cwd: noTree });
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny",
    "neither the hook's own guess nor the live holder's own record has seen this comment");
  assert.ok(because(run).includes("a correction nobody under this holder has read yet"));
  delete state.issues[0].sessionContext;
});

test("an expired lease's holder is not trusted as an alias, even where that holder's own record shows it read this", async () => {
  const holder = "iss-952-cccccccc";
  owed({ [UUID]: [comment("c12", "credited to a holder whose lease has since lapsed")] });
  state.issues[0].sessionContext = leased(holder, "2020-01-01T00:00:00.000Z", 1);
  const granted = `export FORGE_SESSION_ID=${holder} && ${edgeWrite()}`;
  const first = await gate(granted, { harness: "harness-worktree-d", cwd: noTree });
  assert.equal(first.out.hookSpecificOutput.permissionDecision, "deny", "nobody has been shown it yet");
  const bare = await gate(edgeWrite(), { harness: "harness-worktree-e", cwd: noTree });
  assert.equal(bare.out.hookSpecificOutput.permissionDecision, "deny",
    "a lapsed lease's holder is nobody's proof of who stands here now");
  delete state.issues[0].sessionContext;
});

test("a lease held by an id shaped like a shared one, not a minted run, is not trusted as an alias", async () => {
  const holder = "9d42c759-0b53-4fb1-83e8-1f08a98d58a7";
  owed({ [UUID]: [comment("c13", "credited to an id shaped like a wave's own, not a minted run's")] });
  state.issues[0].sessionContext = leased(holder);
  const granted = `export FORGE_SESSION_ID=${holder} && ${edgeWrite()}`;
  const first = await gate(granted, { harness: "harness-worktree-f", cwd: noTree });
  assert.equal(first.out.hookSpecificOutput.permissionDecision, "deny", "nobody has been shown it yet");
  const bare = await gate(edgeWrite(), { harness: "harness-worktree-g", cwd: noTree });
  assert.equal(bare.out.hookSpecificOutput.permissionDecision, "deny",
    "only a minted, run-specific holder is trusted as an alias, and a shared-shaped one is not, "
    + "even if credited");
  delete state.issues[0].sessionContext;
});

/* Codex's own finding on this change: a delivery this call causes belongs to this call, and never
   to a lease's holder the caller has not been shown to be. A stranger shown a comment for the first
   time credits nobody but itself, so the holder the lease actually names still holds on it once. */
test("a delivery this call causes credits only this call, never the lease holder a stranger's write happened to name", async () => {
  const holder = "iss-953-dddddddd";
  owed({ [UUID]: [comment("c14", "shown to a stranger, and owed to the holder still")] });
  state.issues[0].sessionContext = leased(holder);
  /* Out of any worktree, as the cases above are: a tree naming a run of its own would make every
     stranger here one run, and the hold a thread cannot be accounted for is once per run. */
  const stranger = await gate(edgeWrite(), { harness: "harness-worktree-h", cwd: noTree });
  assert.equal(stranger.out.hookSpecificOutput.permissionDecision, "deny", "a genuine miss, for anyone");
  const asHolder = await gate(`export FORGE_SESSION_ID=${holder} && ${edgeWrite()}`,
    { harness: "harness-worktree-i", cwd: noTree });
  assert.equal(asHolder.out.hookSpecificOutput.permissionDecision, "deny",
    "the stranger's own write was refused, so it credited nobody's alias but its own guess");
  delete state.issues[0].sessionContext;
});

test("the uuid form is denied where the reference form is", async () => {
  const run = await gate(edgeWrite(UUID));
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(because(run), new RegExp(UUID, "u"));
});

test("two issues in one command are one deny naming both", async () => {
  owed({ [UUID]: [comment("c1", "one issue owes this")], [OTHER]: [comment("c2", "the other owes this")] });
  const run = await gate(`${edgeWrite()} && ${edgeWrite("ISS-30")}`);
  assert.match(because(run), /This writes to ISS-29, ISS-30/u);
});

test("an issue with no comments is not denied, and no round is spent on a read", async () => {
  whole({});
  assert.equal((await gate(edgeWrite())).out, null);
});

/* The case that fails without ISS-1715 and ISS-1724, and the credit is half of it: a credit written
   here would silence the half that is going to print the thread, and it would reach nobody. */
test("a shell write is not held for a delivery the verb itself will make", async () => {
  whole({ [UUID]: [comment("c20", "a person answered while this run was building")] });
  assert.equal((await gate("forge advance ISS-29")).out, null, "the verb's own half is what delivers this");
  assert.equal((await gate(edgeWrite(), { fresh: false })).out, null, "and an edge write's own half delivers it too");
  owed({ [UUID]: [comment("c20", "a person answered while this run was building")] });
  const held = await gate(edgeWrite(), { fresh: false });
  assert.equal(held.out.hookSpecificOutput.permissionDecision, "deny", "the thread now cannot be accounted for");
  assert.ok(because(held).includes("a person answered while this run was building"),
    "and neither pass credited the comment, so it is still owed to whichever half does deliver it");
});

/* Nothing stands between the model and the tracker's own tool, so the refusal is still the only
   delivery. The action is one no verb claims, every claimed one being refused for its route first. */
test("a write through the tracker's own tool is held, no verb standing between it and the write", async () => {
  whole({ [UUID]: [comment("c21", "nothing here will deliver this but the refusal")] });
  const run = await raw({ action: "archive", documentId: UUID }, { session: "probe-tool-delivery" });
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny");
  assert.ok(because(run).includes("nothing here will deliver this but the refusal"),
    "the comment itself, quoted whole, as the only delivery this route has");
  assert.doesNotMatch(because(run), /wraps/u, "and it is the comments that answered, not the route");
});

/* Refused on every route, because no half may deliver it: the credit would evict what it was for. */
test("a thread past the credits one issue keeps still holds a shell write", async () => {
  whole({
    [UUID]: Array.from({ length: 401 }, (_, at) => comment(`over${at}`, "one of four hundred and one")),
  });
  const run = await gate("forge advance ISS-29");
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny",
    "the verb cannot deliver what nothing can credit, so this is not stood down for");
  assert.match(because(run), /past the 400 one issue's credits keep/u, "and the refusal names the reason");
});

test("with no endpoint saved the gate stands down", async () => {
  whole({ [UUID]: [comment("c9", "unread")] });
  const run = await gate(edgeWrite(), { url: "" });
  assert.equal(run.out, null);
  assert.equal(run.status, 0, "silently: a project that never configured this CLI is not owed a refusal");
});

/* The stand-down is said where the session reads it, never on stderr alone (ISS-215). */
const stoodDown = (run) => run.out?.hookSpecificOutput?.additionalContext ?? "";

test("a tracker that will not answer leaves the write alone and says why", async () => {
  const run = await gate(edgeWrite(), { url: "http://127.0.0.1:1/mcp", skipped: ["issue-read-first"] });
  assert.equal(run.out.hookSpecificOutput.permissionDecision, undefined, "nothing is denied on no evidence");
  assert.match(stoodDown(run), /issue-read-first could not judge this call and did not hold it: Forge did not answer/u,
    "and the session is told which gate stood down, and why");
  assert.match(stoodDown(run), /`forge doctor` checks/u, "and the command that checks what it read");
});

test("a token the tracker turns down stands the gate down in the answer, not in an exit", async () => {
  state.status = 401;
  try {
    const run = await gate(edgeWrite(), { skipped: ["issue-read-first"] });
    assert.equal(run.status, 0, "the process answered rather than exiting 1 with nothing on stdout");
    assert.match(stoodDown(run), /Forge answered 401/u);
    assert.match(stoodDown(run), /`forge doctor --token <pat>` replaces a token the tracker refused/u);
  } finally {
    delete state.status;
  }
});

/* The other half of this gate: a filing carries no issue to read the comments of, and what it owes
   is the shape the flow needs. The refusal is the lint's, and the pointer is its own topic page. */
const WHOLE = "## Outcome\n\nThe filing is read where it is made, on every route.\n\n## Rules\n\n"
  + "- A body that meets the shape files with nothing said.\n\n## Out of scope\n\nJudging whether it is true.";
const TITLED = "the filing is read where it is made on every route";

const filing = async (data, options = {}) => raw({ action: "create", data }, options);

test("a create whose body cannot carry the flow is denied, and the pointer is the shape's own page", async () => {
  const run = await filing({ title: "fix", description: "It is broken." });
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(because(run), /naming the outcome/u,
    "the section the shape refusal found missing, which says the body and not the route was judged");
  assert.match(because(run), /forge hooks --how issue-shape/u,
    "one gate refuses two things, and each argument has its own page");
});

/* ISS-335. The shape is read first and the route second, so a body that cannot carry the flow still
   hears about the body: fixing it is owed on either route, and hearing the verb first would cost the
   caller the same two rounds in the other order. */
test("a create that meets the shape is refused for its route, and named the verb that reads it", async () => {
  const run = await filing({ title: TITLED, description: WHOLE });
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(because(run), /forge_issues create is what `forge new` wraps/u);
  assert.doesNotMatch(because(run), /forge hooks --how issue-shape/u, "the shape is not what refused it");
});

test("a comment made through the tool is named its own verb, not the filing's", async () => {
  const run = await filing({ issue: "ISS-29", body: "x" }, { name: "mcp__forge__forge_comments" });
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(because(run), /forge_comments create is what `forge comment/u);
});

test("an update is claimed by the verb that writes a field no check earned, and named as its", async () => {
  const run = await raw({ action: "update", documentId: UUID, data: { description: "b" } });
  assert.match(because(run), /is what `forge issue --set` wraps/u,
    "one verb writes a field the record does not earn, so a raw update has a route to be sent to");
});

/* ISS-1414. The two checks above ask the tracker something and stand down where it cannot be asked;
   which verb wraps a route is this CLI's own table, and silence there was the way round a withholding. */
test("with no endpoint saved a filing is judged for its route and not for its shape", async () => {
  const run = await filing({ title: "fix", description: "It is broken." }, { url: "" });
  assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(because(run), /forge_issues create is what `forge new` wraps/u);
  assert.doesNotMatch(because(run), /a heading naming the outcome/u,
    "the shape is a question for the tracker and stands down; the route is not and does not");
});

test("the refusal a raw create earns with no endpoint saved is the one it earns with one", async () => {
  /* One session each: the line saying where to file a wrong refusal is shown once per session. */
  const saved = await filing({ title: TITLED, description: WHOLE }, { session: "probe-with-endpoint" });
  const none = await filing({ title: TITLED, description: WHOLE }, { url: "", session: "probe-no-endpoint" });
  assert.equal(because(none), because(saved), "the same call, so the same words: the credential is not part of the question");
  assert.match(because(none), /forge_issues create is what `forge new` wraps/u);
});

/* A verb held back is paid for by the route it wraps, and a box with no endpoint never paid it. */
test("with no endpoint saved a verb held back still answers for the route it wraps", async () => {
  for (const kept of ["hidden", "off"]) {
    const run = await filing({ title: TITLED, description: WHOLE },
      { url: "", withheld: { new: kept }, session: `probe-withheld-${kept}` });
    assert.equal(run.out.hookSpecificOutput.permissionDecision, "deny", kept);
    assert.match(because(run), new RegExp(`\`forge new\` is ${kept} on this machine`, "u"));
    assert.match(because(run), /^Use `forge new` and not the raw call/u, kept);
  }
});

test("a raw call at a route no verb wraps is served whether or not an endpoint is saved", async () => {
  for (const url of ["", live()]) {
    const run = await raw({ action: "write", data: { text: "x" } },
      { name: "mcp__forge__forge_memory", url, session: `probe-unwrapped-${url ? "saved" : "none"}` });
    assert.equal(run.out, null, `no verb is the route to forge_memory write, so nothing refuses it (url: ${url || "none"})`);
  }
});

/* ISS-36's remaining half. Every identifier family of the requirements tree is letters-dash-digits,
   so the wider shape read each of them as an issue key: one case per family, because a prefix list
   widened later is exactly how they get swallowed again quietly. */
const FAMILIES = {
  FR: "FR-05", UC: "UC-05", AC: "AC-05", NFR: "NFR-02", BR: "BR-03",
  EI: "EI-01", G: "G-1", M: "M-2", C: "C-3", A: "A-4", R: "R-5",
};

test("no identifier of the requirements tree is an issue reference", () => {
  for (const [family, id] of Object.entries(FAMILIES)) {
    assert.equal(isReference(id), false, `${family}: \`${id}\` is a citation, not a key`);
  }
});

test("the tracker's own key still is one, in either case", () => {
  assert.equal(isReference("ISS-45"), true);
  assert.equal(isReference("iss-45"), true, "the lookup upper-cases, so this has always resolved");
  assert.equal(isReference(UUID), true, "and a uuid is the other form every verb takes");
});

/* The route the defect actually reaches the gate by, now that targets are parsed off argument
   positions rather than searched for in the text: a citation typed where the issue goes. */
test("a citation in the issue's own argument names no write target", () => {
  assert.deepEqual(targets("forge comment FR-05 @note.md"), [],
    "the gate asked for the comments of a specification clause");
  assert.deepEqual(targets("forge comment ISS-29 @note.md"), ["ISS-29"], "and a key is untouched");
});

/* The reported case, kept as a case: it stopped reproducing when the reading became positional, and
   nothing pinned that it stays gone. */
test("a plan whose body cites five clauses writes only to the issue it names", () => {
  const command = "forge record plan ISS-32 <(cat <<'MD'\n## Plan\nServes FR-05 and UC-05, criterion AC-05,"
    + " under BR-03 and NFR-02.\nMD\n)";
  assert.deepEqual(targets(command), ["ISS-32"]);
});

/* A worktree of this same project: a `cd` in the cases above reaches a tree the gate can name a
   project for, which is what those cases were about before a directory naming none went silent. */
const SAME_PROJECT = projectRoom(tempRoom("same-project-"), HOME.path, OWN);

/* AC-07-3-4. Every refusal this gate relays, composed where the verbs that print the same words
   compose it, each read for the order: the thread to read, a thread past what can be credited, a
   body the flow cannot carry, one that reads as a fix, and a raw route a verb wraps, typed and held back. */
test("every refusal this gate relays leads with its route", async () => {
  const reasons = {};
  owed({ [UUID]: [comment("c1", "read this before you write")] });
  reasons.thread = because(await gate(edgeWrite()));
  whole({ [UUID]: Array.from({ length: 401 }, (_, at) => comment(`past${at}`, "one of many")) });
  reasons["a thread past the credits"] = because(await gate("forge advance ISS-29"));
  whole({});
  reasons["a body the flow cannot carry"] = because(await filing({ title: "fix", description: "It is broken." }));
  reasons["a body that reads as a fix"] = because(await filing({ title: "forge issue writes an edge a token can write",
    description: "`forge issue` should take the `data.relations` route." }));
  reasons["a route a verb wraps"] = because(await filing({ title: TITLED, description: WHOLE }));
  reasons["a route whose verb is held back"] = because(await filing({ title: TITLED, description: WHOLE },
    { url: "", withheld: { new: "off" }, session: "probe-order-withheld" }));
  for (const [label, reason] of Object.entries(reasons)) assertRouteFirst(reason, label);
  assert.doesNotMatch(reasons["a body that reads as a fix"], /under `clear:`/u, "the fix's own head, not the shape's");
  assert.match(reasons["a thread past the credits"], /^Hold — re-send the same command/u, "the short thread's own head");
});
