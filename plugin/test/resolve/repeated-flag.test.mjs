/* One flag, two values, and which of the two readings the parser makes. The unit half pins the
   sentence and what it names; the verb half runs with no credential in reach, so a refusal that
   arrives at all arrived before an endpoint was resolved, and every accumulating flag on this CLI
   is watched still accumulating beside it (ISS-930). */
import assert from "node:assert/strict";
import test from "node:test";

import { flags, pairOf, pairsFrom, pullRepeated, repeatedFlag, shortOfAsk } from "../../src/resolve/flags.mjs";
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
  assert.match(said, /Ask for the one you meant: `--one <value>`, once\./u,
    "and the form to type, which every other refusal on this CLI carries");
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
  assert.match(said, /Ask for the one you meant: `--one <value>`, once\./u,
    "and the form is the flag with a placeholder, never a command built out of the value");
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

/* ISS-945. This is the one place a repeated flag's words are read, so it is the one place a count of
   them can be established, and every layer that later reports on the work answers to it rather than
   to whatever it was itself handed. */
const SET_USAGE = "Usage: forge thing <ref> [--set <field>=<value>]...";
const askFor = (...words) =>
  pullRepeated(words.flatMap((one) => ["--set", one]), "--set", "thing", { usage: SET_USAGE }).ask;

test("the ask carries the caller's own words, the verb and the flag they were given to", () => {
  const ask = askFor("status=open", "priority=high");
  assert.deepEqual([...ask.items], ["status=open", "priority=high"], "as typed, in the order typed");
  assert.equal(ask.verb, "thing");
  assert.equal(ask.flag, "--set");
  assert.equal(ask.wordFor({ field: "status", value: "open" }), "status=open",
    "and the ask words what a reporting layer holds, so neither layer chooses a vocabulary");
});

test("an ask every word of which reached the layer is answered with nothing to say", () => {
  const held = [{ field: "status", value: "open" }, { field: "priority", value: "high" }];
  assert.equal(shortOfAsk(askFor("status=open", "priority=high"), held), null);
});

test("a word that did not reach the layer is named, with both counts", () => {
  const said = shortOfAsk(askFor("status=open", "priority=high", "complexity=m"),
    [{ field: "priority", value: "high" }]);
  assert.match(said, /^thing: --set was given 3 thing\(s\) and 1 reached the write\./u, said);
  assert.match(said, /`status=open` and `complexity=m` did not/u, "each in the caller's own spelling");
  assert.match(said, /Nothing was sent\./u, said);
  assert.match(said, /Ask for what you meant, once each: `--set <value>`/u, "the form to type");
  assert.match(said, /this CLI lost it between your call and the write/u,
    "and the other reading, since no layer here can tell which of the two it was");
});

/* Two of one word cannot be answered by one thing that arrived: a count that only tested membership
   would call a call complete that was not. */
test("occurrences are consumed, so two identical words are not answered by one", () => {
  const said = shortOfAsk(askFor("priority=high", "priority=high"), [{ field: "priority", value: "high" }]);
  assert.match(said, /was given 2 thing\(s\) and 1 reached the write/u, said);
  assert.match(said, /`priority=high` did not/u, said);
});

/* A layer asked to judge a call against nothing has judged nothing, and answering `null` there would
   read exactly like a call every word of which arrived — the shape this whole rule is against. */
test("a layer handed no ask at all is refused as this CLI's own defect", () => {
  const said = shortOfAsk(undefined, [{ field: "status", value: "open" }]);
  assert.match(said, /no record of what was asked for reached the layer that reports/u, said);
  assert.match(said, /Nothing was sent\./u, said);
  assert.match(said, /a defect in this CLI, not in what you typed/u, said);
});

/* ISS-1056. The de-duplication and the shortfall are one reading of one list, so they have one home:
   a verb keying its own object by field drops the first of a repeat before the count is taken. */
const setPair = (one) => {
  const { key, value } = pairOf(one, "--set");
  return { field: key, value };
};
const pairs = (...words) => pairsFrom(words, "--set", { each: setPair });

test("a field named twice is refused with its name, both its values and the count", async () => {
  const said = await refused(() => pairs("status=open", "status=closed"));
  assert.match(said, /^--set names status 2 times, as `open` and `closed`, /u, said);
  assert.match(said, /one call writes each field once\./u, "the rule, said once");
  assert.match(said, /Ask for the one you meant: --set status=<value>\./u, "and the form that works");
  assert.match(said, /Nothing was sent\./u, "and neither value was preferred over the other");
});

/* No route named is what a verb reaching this reading for the first time gets, so a third inherits it. */
test("a caller that names no refusal route of its own is still refused", async () => {
  const said = await refused(() => pairsFrom(["a=1", "a=2"], "--set", { each: setPair }));
  assert.match(said, /--set names a 2 times, as `1` and `2`/u, said);
});

test("distinct fields pass through in the order they were given", () => {
  assert.deepEqual(pairs("status=open", "priority=high"),
    [{ field: "status", value: "open" }, { field: "priority", value: "high" }]);
});

/* A pair a layer above dropped is a shortfall: read as a repeat it would name a field typed once. */
test("a list one word of which never arrived is no repeat, so the shortfall keeps its own sentence", () => {
  const held = pairs("status=open");
  assert.match(shortOfAsk(askFor("status=open", "priority=high"), held),
    /this CLI lost it between your call and the write/u, "the reading a genuine loss still gets");
});

/* Both verbs watched arriving at the one sentence: a keyed object of a verb's own goes red here. */
test("the two `--set`-taking verbs print one rule, before either resolves an endpoint", async () => {
  const project = await ran("project", "forge-plugin", "--set", "name=a", "--set", "name=b");
  assert.equal(project.status, 1, project.stdout);
  assert.match(project.stderr, /^project: --set names name 2 times, as `a` and `b`, /mu, project.stderr);
  const issue = await ran("issue", "ISS-1", "--set", "a=1", "--set", "a=2", "--why", "w");
  assert.equal(issue.status, 1, issue.stdout);
  assert.match(issue.stderr, /--set names a 2 times, as `1` and `2`, /u, issue.stderr);
  for (const run of [project, issue]) {
    assert.match(run.stderr, /one call writes each field once\./u, run.stderr);
    assert.doesNotMatch(run.stderr, /No Forge endpoint/u, "neither got as far as needing one");
  }
});
