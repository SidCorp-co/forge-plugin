/* One sentence for every name this CLI turns away. The unit half pins the three clauses and what
   suppresses each; the verb half is run with no credential in reach, so a refusal that arrives at
   all is one that arrived before the endpoint was resolved. */
import assert from "node:assert/strict";
import test from "node:test";

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { didYouMean, flagsNamed, unknownFlag } from "../../src/suggest.mjs";
import { FLAG_WORD, flags, partition, pullRepeated } from "../../src/resolve/flags.mjs";
import { bodyFrom, notABody } from "../../src/resolve/payload.mjs";
import { homeEnv, ranAsync, tempRoom } from "../fixtures.mjs";

const KINDS = ["bug", "enhancement", "feature"];
const NINE = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

test("the sentence carries what was given, the nearest names and the short set", () => {
  assert.equal(
    didYouMean("kind", "bugg", KINDS),
    "No kind named bugg. Did you mean: bug? The set is bug, enhancement, feature.",
  );
});

test("a set nobody could read at a glance is left for the route to it", () => {
  const said = didYouMean("word", "zzz", NINE, "Ask `forge words`.");
  assert.equal(said, "No word named zzz. Ask `forge words`.");
  assert.doesNotMatch(said, /The set is/u, "nine names is a list, not a sentence");
});

/* The hint is a route to the set, so naming both spends a clause on a route to what was just said. */
test("the route is spent where the set itself is named", () => {
  assert.equal(didYouMean("kind", "zzz", KINDS, "Ask `forge new -h`."),
    "No kind named zzz. The set is bug, enhancement, feature.");
});

test("a set that says no more than the suggestion did is not repeated", () => {
  assert.equal(didYouMean("flag", "--al", ["--all"]), "No flag named --al. Did you mean: --all?");
  assert.equal(didYouMean("target", "nothing", []), "No target named nothing.");
});

test("a verb's flags are the ones its own row names, and nothing else on the line", () => {
  assert.deepEqual(flagsNamed("Usage: forge issue <uuid|ISS-45> [--fields a,b] [--full]"),
    ["--fields", "--full"]);
  assert.deepEqual(flagsNamed("Usage: forge comment <uuid|ISS-45> <file.md|@file|->"), []);
});

test("a flag no row names is accepted where the call site declares it, and offered to nobody", () => {
  const usage = "Usage: forge guide [contract [part]|slug]";
  assert.equal(unknownFlag("guide", ["--tracker"], { usage, hidden: ["--tracker"] }), null);
  const said = unknownFlag("guide", ["--trackr"], { usage, hidden: ["--tracker"] });
  assert.match(said, /No guide flag named --trackr\./u);
  assert.doesNotMatch(said, /--tracker\b/u, "the hidden flag is in no refusal either");
});

/* A flag is one word. The shell has already bound a quoted value to its flag, so re-reading that
   value for flags is what refused a decision record naming `--limit` first (ISS-255). */
test("a flag is one word, so a value saying more than that word is not one", () => {
  assert.equal(FLAG_WORD.test("--limit"), true);
  assert.equal(FLAG_WORD.test("--limit becomes the count of rows printed"), false);
  assert.equal(FLAG_WORD.test("--"), true, "two dashes and nothing else is an attempt at one");
  assert.equal(FLAG_WORD.test("--fields=plan"), false, "the `=` form is the parser's own to refuse");
});

test("a value the shell bound to its flag is that flag's value, whatever it opens with", () => {
  const said = "--limit becomes the count of rows printed | a limit is about rows | one line";
  assert.deepEqual(flags(["--decision", said], "record decision"), { decision: said });
  assert.deepEqual(pullRepeated(["--open", said], "--open", "claim").values, [said]);
});

/* The third site: it decides value from positional, so a value left unread lands in the flag argv
   as a key and the parser then refuses a flag nobody typed. */
test("the partitioner reads a value opening with two dashes as the value, not as a positional", () => {
  const held = partition(["a.mjs", "--only", "--limit and its friends", "b.mjs"], []);
  assert.deepEqual(held.positionals, ["a.mjs", "b.mjs"]);
  assert.deepEqual(held.flagArgv, ["--only", "--limit and its friends"]);
});

/* A body slot is the one place the sentence above cannot reach: the path is split off before the
   tail is read, so the token went to `open()` and the run ended on an fs error (ISS-240). */
test("a flag standing where a body goes is refused as a flag, never opened as a file", async () => {
  const said = notABody("--read");
  assert.match(said, /`--read` is a flag, not a body/u);
  assert.match(said, /`-` for stdin/u, "and the route out is in the refusal itself");
  assert.match(said, /`\.\/--read`/u, "as is the way to a file whose own name opens that way");
  const held = process.exit;
  const stderr = console.error;
  const shouted = [];
  process.exit = () => {
    throw new Error("exited");
  };
  console.error = (line) => shouted.push(line);
  try {
    await assert.rejects(() => bodyFrom("--read"), /exited/u);
    assert.equal(shouted.join("\n"), said);
    assert.doesNotMatch(shouted.join("\n"), /ENOENT/u, "and no fs error for a path nobody named");
  } finally {
    process.exit = held;
    console.error = stderr;
  }
});

test("a file whose own name opens with two dashes is still reachable", async () => {
  const room = tempRoom("body-");
  const named = join(room, "--body.md");
  writeFileSync(named, "the body itself");
  assert.equal(await bodyFrom(named), "the body itself");
  assert.equal(await bodyFrom(`@${named}`), "the body itself");
});

/* `--flag=value` has its own refusal in the parser, which says the form to write instead. */
test("the form the parser refuses is left to the parser", () => {
  const usage = "Usage: forge issue <uuid|ISS-45> [--fields a,b] [--full]";
  assert.equal(unknownFlag("issue", ["--fields=plan"], { usage }), null);
  assert.equal(unknownFlag("issue", ["ISS-1", "--fields", "plan"], { usage }), null);
});

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const env = homeEnv("did-you-mean");
const ran = (...argv) => ranAsync(FORGE, argv, env);

/* The defect with a wrong answer behind it rather than a wrong message: the flag was dropped and
   the whole body came back reading as the one field that was asked for. */
test("a mistyped flag is refused before a credential is looked for", async () => {
  const run = await ran("issue", "ISS-1", "--feilds", "status");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No issue flag named --feilds\. Did you mean: --fields\?/u);
  assert.doesNotMatch(run.stderr, /No Forge endpoint/u, "nothing was resolved to say that");
  assert.equal(run.stdout, "", "and no body came back");
});

test("an unknown flag is an unknown flag, never a known one given no value", async () => {
  const run = await ran("tools", "--al");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No tools flag named --al\. Did you mean: --all\?/u);
  assert.doesNotMatch(run.stderr, /given no value/u);
});

test("a verb taking no flag at all says what it does take", async () => {
  const run = await ran("comment", "ISS-1", "--body", "a finding");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No comment flag named --body\./u);
  assert.match(run.stderr, /Usage: forge comment <uuid\|ISS-45> <file\.md\|@file\|->/u);
  assert.doesNotMatch(run.stderr, /ENOENT|no such file/u, "and not as a file nobody meant");
});

test("a flag standing in the body slot is this verb's own unknown flag", async () => {
  const run = await ran("new", "--read", "--title", "T");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No new flag named --read\./u);
  assert.match(run.stderr, /Usage: forge new <file\.md\|@file\|->/u);
  assert.doesNotMatch(run.stderr, /ENOENT|no such file/u, "and not as a file nobody meant");
  assert.doesNotMatch(run.stderr, /No Forge endpoint/u, "nor after a credential was looked for");
});

/* `onlyFlags` turns away what it does not know, so a flag the row DOES name went straight past it
   and the parser then refused the title as a key it could not read. */
/* It names no flag, so read as one it would silently take the next word as its value and the verb
   would answer with the filter nobody asked for. */
test("two dashes and nothing after them is refused by name, never read as a field", async () => {
  const run = await ran("issue", "ISS-1", "--", "status");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No issue flag named --\./u);
  const bare = await ran("codex", "consult", "--", "x");
  assert.match(bare.stderr, /`--` names no flag/u, bare.stderr);
});

test("a flag the verb declares is refused in the body slot too, by what the slot takes", async () => {
  const run = await ran("new", "--title", "T");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`--title` is a flag, not a body/u);
  assert.match(run.stderr, /`-` for stdin/u);
});

/* The preflight reads the whole argv, values with it, so the rule above has to hold there too or a
   verb that runs it turns away a value the parser would have taken. */
test("a value the shell bound to its flag is not turned away by the preflight either", async () => {
  const body = join(tempRoom("filing-"), "body.md");
  writeFileSync(body, "## Outcome\n\nIt reads.\n");
  const run = await ran("new", body, "--title", "--limit becomes the count of rows printed");
  assert.doesNotMatch(run.stderr, /No new flag named/u, run.stderr);
});

test("a bare flag word in a value slot is refused by naming the token, not the consequence", async () => {
  const run = await ran("record", "decision", "ISS-1", "--decision", "--limit");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`--limit` after it reads as the next flag/u);
  assert.match(run.stderr, /saying more than the one word is taken as the value/u);
});

test("a flag a row deliberately omits still runs", async () => {
  const run = await ran("schema", "forge_issues", "--all");
  assert.doesNotMatch(run.stderr, /No schema flag/u, `refused its own flag: ${run.stderr}`);
});

test("a target is turned away like any other name", async () => {
  const run = await ran("attach", "isue", "ISS-1", "note.md");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No attach target named isue\. Did you mean: issue\? The set is issue, comment\./u);
});

test("a verb nobody has is named back before the list of the ones there are", async () => {
  const run = await ran("nosuchverb");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^No verb named nosuchverb\./u);
});
