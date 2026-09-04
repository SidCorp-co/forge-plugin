/* One sentence for every name this CLI turns away. The unit half pins the three clauses and what
   suppresses each; the verb half is run with no credential in reach, so a refusal that arrives at
   all is one that arrived before the endpoint was resolved. */
import assert from "node:assert/strict";
import test from "node:test";

import { didYouMean, flagsNamed, unknownFlag } from "../../src/suggest.mjs";
import { homeEnv, ranAsync } from "../fixtures.mjs";

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
