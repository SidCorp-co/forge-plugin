/* One flag, two values, and which of the two readings the parser makes. The unit half pins the
   sentence and what it names; the verb half runs with no credential in reach, so a refusal that
   arrives at all arrived before an endpoint was resolved, and every accumulating flag on this CLI
   is watched still accumulating beside it (ISS-930). */
import assert from "node:assert/strict";
import test from "node:test";

import { flags, pullRepeated, repeatedFlag } from "../../src/resolve/flags.mjs";
import { Refusal, refusing } from "../../src/resolve/settings.mjs";
import { homeEnv, ranAsync } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const env = homeEnv("repeated-flag");
const ran = (...argv) => ranAsync(FORGE, argv, env);
const USAGE = "Usage: forge thing <ref> [--one a] [--two b] [--full]";

/* `fail` exits the process outside an embedded run, so the sentence is read the way the CLI's own embedding reads it. */
const refused = async (call) => {
  try {
    await refusing(async () => call());
  } catch (error) {
    assert.ok(error instanceof Refusal, `not a refusal: ${error.stack}`);
    return error.message;
  }
  return assert.fail("nothing was refused");
};

/* Told only what was kept, a caller cannot tell which of their own arguments the parser threw away. */
test("both values are named, the caller's own words in their own order", async () => {
  const said = await refused(() => flags(["--one", "first", "--one", "second"], "thing", ["--full"], { usage: USAGE }));
  assert.match(said, /^thing: --one was given twice, `first` and then `second`, /u, said);
  assert.match(said, /one flag carries one value/u, "the rule, said once");
  assert.match(said, /Send the --one you meant, and make a second call for the other\./u, "the way on");
  assert.match(said, /Nothing was sent\./u, "and neither answer was preferred over the other");
  assert.equal(said, repeatedFlag("thing", "--one", "first", "second"),
    "the verb half and the unit half read one sentence, not two copies");
});

test("a third occurrence is refused at the second, so no reply grows with the argv", async () => {
  const said = await refused(() => flags(["--one", "a", "--one", "b", "--one", "c"], "thing", [], { usage: USAGE }));
  assert.match(said, /`a` and then `b`/u, said);
  assert.doesNotMatch(said, /`c`/u, "the parse stops at the first repeat rather than collecting them");
});

test("two different flags are two answers to two questions, and both are read", () => {
  assert.deepEqual(flags(["--one", "a", "--two", "b"], "thing", [], { usage: USAGE }), { one: "a", two: "b" });
});

/* Naming both values is the rule and a credential is the exception: the flag is the whole of what a
   caller needs, and a token printed to stderr is a token in a transcript and in the refusal log. */
test("a flag the verb declares a credential is refused without either value", async () => {
  const said = await refused(() =>
    flags(["--one", "sk-live-first", "--one", "sk-live-second"], "thing", [], { usage: USAGE, secret: ["--one"] }));
  assert.match(said, /--one was given twice, `\*\*\*` and then `\*\*\*`/u, said);
  assert.doesNotMatch(said, /sk-live/u, "neither credential reaches the reply");
  assert.match(said, /Send the --one you meant/u, "and the way on is unchanged");
});

test("a flag beside a declared one keeps its values, the declaration being per flag", async () => {
  const said = await refused(() =>
    flags(["--two", "a", "--two", "b"], "thing", [], { usage: USAGE, secret: ["--one"] }));
  assert.match(said, /--two was given twice, `a` and then `b`/u, said);
});

test("the two verbs that take a credential declare it, so neither prints one twice over", async () => {
  for (const argv of [["doctor", "--token", "sk-aaa", "--token", "sk-bbb"],
    ["cloudflare", "login", "--name", "n", "--token", "sk-aaa", "--token", "sk-bbb"]]) {
    const run = await ran(...argv);
    assert.equal(run.status, 1, `forge ${argv[0]}: ${run.stdout}`);
    assert.match(run.stderr, /--token was given twice, `\*\*\*` and then `\*\*\*`/u, run.stderr);
    assert.doesNotMatch(`${run.stdout}${run.stderr}`, /sk-aaa|sk-bbb/u,
      `forge ${argv[0]} printed a credential: ${run.stdout}${run.stderr}`);
  }
});

/* The one asymmetry in the rule, deliberate: refusing a boolean would spend a round on a call that meant exactly what it did. */
test("a repeated boolean is not refused, because a second `true` drops nothing", () => {
  assert.deepEqual(flags(["--full", "--full"], "thing", ["--full"], { usage: USAGE }), { full: true });
  assert.deepEqual(flags(["--full", "--one", "a", "--full"], "thing", ["--full"], { usage: USAGE }),
    { full: true, one: "a" });
});

test("a flag pulled out first is not a flag the parser has seen, so it still accumulates", () => {
  const pulled = pullRepeated(["--one", "a", "--one", "b", "--two", "c"], "--one", "thing", { usage: USAGE });
  assert.deepEqual(pulled.values, ["a", "b"], "pullRepeated is the one declaration that a flag repeats");
  assert.deepEqual(flags(pulled.rest, "thing", [], { usage: USAGE }), { two: "c" },
    "and what it leaves behind carries no second occurrence for the parser to refuse");
});

test("a repeated flag missing its value is still the missing value, which is the nearer mistake", async () => {
  const said = await refused(() => flags(["--one", "a", "--one"], "thing", [], { usage: USAGE }));
  assert.match(said, /--one was given no value/u, said);
  assert.doesNotMatch(said, /given twice/u, "a flag with nothing after it has no second value to name");
});

test("an unknown flag is answered before a repeat, since the name is the nearer mistake", async () => {
  const said = await refused(() => flags(["--one", "a", "--nope", "b", "--one", "c"], "thing", [], { usage: USAGE }));
  assert.match(said, /No thing flag named --nope\./u, said);
});

test("the refusal reaches a caller of a real verb before any credential is looked for", async () => {
  const run = await ran("issue", "ISS-1", "--fields", "status", "--fields", "title");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^issue: --fields was given twice, `status` and then `title`, /mu, run.stderr);
  assert.match(run.stderr, /Nothing was sent\./u);
  assert.doesNotMatch(run.stderr, /No Forge endpoint/u, "nothing was resolved to say that");
  assert.doesNotMatch(run.stderr, /No issue flag named --fields/u,
    "and it is not reported as a flag the verb has not got");
  assert.equal(run.stdout, "", "and no body came back");
});

test("the same call given the flag once is not refused, so the mode split is untouched", async () => {
  const run = await ran("issue", "ISS-1", "--fields", "status");
  assert.doesNotMatch(run.stderr, /given twice/u, run.stderr);
});

test("a repeated --full still reads the whole body, the boolean losing nothing", async () => {
  const run = await ran("issue", "ISS-1", "--full", "--full");
  assert.doesNotMatch(run.stderr, /given twice/u, run.stderr);
  assert.match(run.stderr, /No Forge endpoint|endpoint/u, "it got as far as needing one, which is past the parse");
});

/* Every flag this CLI means to accumulate, watched accumulating: the parser's refusal is safe only
   because each of these is pulled out before it, and a verb that forgets is a red here and not a
   silent drop. Named individually rather than derived, so adding an accumulator to a verb without a
   case is what goes red. */
test("the flags this CLI accumulates are not turned away by the new refusal", async () => {
  const calls = [
    ["record", "confirmation", "ISS-1", "--where", "a.mjs", "--where", "b.mjs", "--is", "i", "--finding", "holds"],
    ["record", "verdict", "ISS-1", "--criterion", "1", "--verdict", "pass", "--criterion", "2", "--verdict", "pass"],
    ["record", "decision", "ISS-1", "--decision", "a | b | c", "--decision", "d | e | f"],
    ["advance", "ISS-1", "--evidence", "a.txt", "--evidence", "b.txt"],
    ["doctor", "--refresh", "-", "--meta", "a=1", "--meta", "b=2"],
    ["project", "forge-plugin", "--set", "a=1", "--set", "b=2"],
    ["issue", "ISS-1", "--set", "complexity=m", "--set", "priority=high", "--why", "w"],
  ];
  for (const argv of calls) {
    const run = await ran(...argv);
    assert.doesNotMatch(run.stderr, /given twice/u, `forge ${argv.join(" ")} lost a value: ${run.stderr}`);
  }
});

/* The one path in this CLI that can synthesise a repeat out of a call that named the flag once: the
   handler renames --kind to --park, so both together ask one question twice. Its --to twin is refused
   by the handler itself, and this is the arm the parser answers. */
test("a form that renames a flag onto one already given is refused rather than collapsed", async () => {
  const run = await ran("park", "ISS-1", "--kind", "blocked", "--park", "question");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--park was given twice, `blocked` and then `question`/u, run.stderr);
});
