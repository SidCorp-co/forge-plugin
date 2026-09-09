/* One sentence for every name this CLI turns away. The unit half pins the three clauses and what
   suppresses each; the verb half is run with no credential in reach, so a refusal that arrives at
   all is one that arrived before the endpoint was resolved. */
import assert from "node:assert/strict";
import test from "node:test";

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { didYouMean, suggest } from "../../src/suggest.mjs";
import { FORMS, ROUTES, routeSaid } from "../../src/resolve/handler.mjs";
import { RETIRED } from "../../src/checks/retired-names.mjs";
import { USAGE as CLAIM } from "../../src/flow/claim.mjs";
import { SAYS as CODEX } from "../../src/codex/codex.mjs";
import { kindUsage } from "../../src/flow/record/record-rows.mjs";
import { retiredFlagIn, retiredRefusal } from "../../src/resolve/retiring.mjs";
import { VERB_NAMES } from "../../src/resolve/visibility.mjs";
import { FLAG_WORD, flags, flagsNamed, partition, pullRepeated, unknownFlag } from "../../src/resolve/flags.mjs";
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
  /* A help text that points at another verb was declaring that verb's flags as its own, and the
     parser then took one: `record -h` names `forge advance --owed`, and --owed is no record flag. */
  assert.deepEqual(flagsNamed("Usage: forge record <kind> [--next <line>]\nEnds with what `forge advance --owed` prints."),
    ["--next"]);
  /* And a second usage line is a second command: `cloudflare dns -h` prints the three routes that change a record, whose --content and --ttl the listing route was taking and then ignoring. */
  assert.deepEqual(
    flagsNamed("Usage: forge cloudflare dns <zone-id> [--type A]\nThe routes that change one:\n"
      + "  Usage: forge cloudflare dns add <zone-id> --content C [--ttl n]"),
    ["--type"],
  );
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
  assert.deepEqual(flags(["--decision", said], "record decision", [], { usage: kindUsage("decision") }),
    { decision: said });
  assert.deepEqual(pullRepeated(["--open", said], "--open", "claim", { usage: CLAIM }).values, [said]);
});

/* The third site: it decides value from positional, so a value left unread lands in the flag argv
   as a key and the parser then refuses a flag nobody typed. */
test("the partitioner reads a value opening with two dashes as the value, not as a positional", () => {
  const held = partition(["a.mjs", "--only", "--limit and its friends", "b.mjs"], [],
    { verb: "codex consult", usage: CODEX.consult });
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

/* The form table is read before distance, so a synonym answers with one verb and not with two near
   spellings of the wrong one. What a row has to hold is held here rather than in prose: a form
   naming a retired verb would answer a name the CLI is supposed not to know, which is the redirect
   docs/cli/withholding-a-verb.md forbids, and a form that is itself a verb is a row nothing reads. */
const retiredRow = (given, retired) =>
  (retired.some((entry) => entry.kind === "verb" && entry.name === given)
    ? [`the table answers ${given}, retired in ${retired.find((entry) => entry.name === given).release}`
      + " — delete the row rather than aiming it at a live name (docs/cli/withholding-a-verb.md)"]
    : []);

const formProblems = (forms, retired, live) =>
  Object.entries(forms).flatMap(([given, { verb: meant }]) => [
    ...retiredRow(given, retired),
    ...(live.includes(meant) ? [] : [`the table sends ${given} to ${meant}, which no verb answers to`]),
    ...(live.includes(given) ? [`${given} is a verb of its own, so its row is never reached`] : []),
  ]);

test("a synonym answers with the one verb it means, before any distance is measured", () => {
  for (const [given, { verb: meant }] of Object.entries(FORMS)) {
    assert.deepEqual(suggest(given, VERB_NAMES), [meant], `forge ${given}`);
  }
  assert.deepEqual(suggest("list", ["lists", "plan"]), ["lists"],
    "and where the verb it means is not on offer, distance answers in its place");
});

/* The row fires on the name and the candidate list decides whether it answers. That is not a
   confinement to verbs and is not meant to be: `forge attach get` means `forge attach issue`, and
   `issue` is the answer wherever this CLI's own name for the thing is what a caller may type. */
test("an alias answers wherever the name it means is among the candidates", () => {
  assert.equal(didYouMean("attach target", "get", ["issue", "comment"]),
    "No attach target named get. Did you mean: issue? The set is issue, comment.");
  assert.equal(didYouMean("issue flag", "--get", ["--fields", "--full"]),
    "No issue flag named --get. The set is --fields, --full.");
  assert.deepEqual(suggest("list", ["consult", "verdict", "pending", "show", "log"]), [],
    "and a codex action named list reaches no name of this CLI's");
});

/* A route is a name for a call and not for a verb, so what a row owes differs from a form's: it is
   answered rather than performed, the call has to be one this CLI makes, and the flag in it is the whole
   point — the verb alone was not what that caller wanted. The retirement rule is the same one and for a
   stronger reason: a route naming a retired name is the redirect itself. Held beside the helper as the
   form table's rules are, because the tables themselves state neither. */
const routeProblems = (routes, forms, retired, live) =>
  Object.entries(routes).flatMap(([given, row]) => [
    ...retiredRow(given, retired),
    ...(live.includes(row.verb) ? [] : [`the route for ${given} is made through ${row.verb}, which no verb answers to`]),
    ...(row.call.startsWith(`forge ${row.verb} `) ? [] : [`the route for ${given} does not open with forge ${row.verb}`]),
    ...(row.call.includes(" --") ? [] : [`the route for ${given} names no flag, and the verb alone is not the call that caller wanted`]),
    ...(live.includes(given) || Object.hasOwn(forms, given)
      ? [`${given} is a word this CLI already answers, so its row is never reached`] : []),
  ]);

/* The route is the verb miss's own, said through the hint the sentence already takes, so it reaches no other caller: `forge attach search` wanted a target and no read of the backlog. */
test("a name for a call is answered with the call, and the flag in it is what the verb alone would miss", () => {
  const said = routeSaid("search", VERB_NAMES);
  assert.equal(said, "`forge issue --search <query>` reads the backlog by a query.");
  assert.equal(didYouMean("verb", "search", VERB_NAMES, said),
    "No verb named search. `forge issue --search <query>` reads the backlog by a query.");
  assert.equal(routeSaid("search", ["comment", "new"]), null,
    "a route through a verb this credential may not see is said to nobody");
  assert.equal(routeSaid("issue", VERB_NAMES), null, "and a word the CLI answers to has no row to read");
  assert.equal(didYouMean("attach target", "search", ["issue", "comment"]),
    "No attach target named search. The set is issue, comment.");
  assert.equal(didYouMean("kind", "search", KINDS), "No kind named search. The set is bug, enhancement, feature.");
});

test("every route is a call this CLI makes, names the flag in it, and re-spells no word the CLI answers", () => {
  assert.deepEqual(routeProblems(ROUTES, FORMS, RETIRED, VERB_NAMES), []);
  assert.ok(Object.keys(ROUTES).length > 0, "and the table holds something, so the rule judged a row");
});

test("the rule fires on a route through no verb, on a call with no flag, and on a word the CLI has", () => {
  const row = { verb: "issue", call: "forge issue --search <query>", does: "reads the backlog by a query" };
  const problems = (routes, retired = RETIRED) => routeProblems(routes, FORMS, retired, VERB_NAMES);
  assert.deepEqual(problems({ query: { ...row, verb: "gone", call: "forge gone --search q" } }),
    ["the route for query is made through gone, which no verb answers to"]);
  assert.deepEqual(problems({ query: { ...row, call: "forge issue ISS-45" } }),
    ["the route for query names no flag, and the verb alone is not the call that caller wanted"]);
  assert.deepEqual(problems({ query: { ...row, call: "forge next --search q" } }),
    ["the route for query does not open with forge issue"]);
  assert.deepEqual(problems({ issue: row }),
    ["issue is a word this CLI already answers, so its row is never reached"]);
  assert.deepEqual(problems({ list: row }),
    ["list is a word this CLI already answers, so its row is never reached"]);
  const found = problems({ query: row }, [{ name: "query", kind: "verb", release: "3.36.0" }]);
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /retired in 3\.36\.0/u, "a route to a retired name is the redirect itself");
});

test("every form names a live verb, and no form is a name the CLI answers to", () => {
  assert.deepEqual(formProblems(FORMS, RETIRED, VERB_NAMES), []);
  assert.ok(Object.keys(FORMS).length > 0, "and the table holds something, so the rule judged a row");
});

/* The rule above passes on a table of rows that happen to be sound, and would pass on a broken one
   were the registry to hold no verb it answers. One is planted, as retired-names.test.mjs plants `advance`. */
test("the rule fires on a table that answers a retired name", () => {
  const [form] = Object.keys(FORMS);
  const asIf = [{ name: form, kind: "verb", release: "3.36.0" }];
  const found = formProblems(FORMS, asIf, VERB_NAMES);
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /retired in 3\.36\.0/u);
  assert.match(found[0], /withholding-a-verb\.md/u, "and the finding says where the rule reads");
  assert.deepEqual(formProblems({ issue: { verb: "issue" } }, RETIRED, VERB_NAMES),
    ["issue is a verb of its own, so its row is never reached"]);
  assert.deepEqual(formProblems({ fetch: { verb: "gone" } }, RETIRED, VERB_NAMES),
    ["the table sends fetch to gone, which no verb answers to"]);
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
  const run = await ran("next", "--wh");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No next flag named --wh\. Did you mean: --why\?/u);
  assert.doesNotMatch(run.stderr, /given no value/u);
});

test("a verb taking no flag at all says what it does take", async () => {
  const run = await ran("spec", "UC-01", "--body", "a finding");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No spec flag named --body\./u);
  assert.match(run.stderr, /Usage: forge spec <id>/u);
  assert.doesNotMatch(run.stderr, /ENOENT|no such file/u, "and not as a file nobody meant");
});

/* One shape for every verb: the set, then the row. A verb taking one flag once left the row out,
   and the caller who typed a flag in the body slot was told the set and not where the body goes. */
test("a verb taking one flag names the set and the row it read the set off", async () => {
  const run = await ran("comment", "ISS-1", "--body", "a finding");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No comment flag named --body\. The set is --title\./u);
  assert.match(run.stderr, /^Usage: forge comment <uuid\|ISS-45> \[<file\.md\|@file\|->\] \[--title T\]$/mu,
    "the row, which is where the body slot the caller wanted is spelled");
  assert.doesNotMatch(run.stderr, /ENOENT|no such file/u, "and not as a file nobody meant");
});

test("a flag standing in the body slot is this verb's own unknown flag", async () => {
  const run = await ran("new", "--read", "--title", "T");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No new flag named --read\. The set is --title, --category,/u);
  assert.doesNotMatch(run.stderr, /ENOENT|no such file/u, "and not as a file nobody meant");
  assert.doesNotMatch(run.stderr, /No Forge endpoint/u, "nor after a credential was looked for");
});

/* Two dashes name nothing, so no near miss answers them, and read as a flag one would silently take
   the next word as its value: one sentence for the shape, and every verb prints it. */
test("two dashes and nothing after them is refused by the same sentence everywhere", async () => {
  const run = await ran("issue", "ISS-1", "--", "status");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^issue: `--` names no flag, and read as one it would take the next word as its value\.$/mu);
  assert.doesNotMatch(run.stderr, /Did you mean/u, "and it is no misspelling of a flag there is");
  const bare = await ran("codex", "consult", "--", "x");
  assert.match(bare.stderr, /^codex consult: `--` names no flag/mu, bare.stderr);
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
  const run = await ran("resume", "ISS-1", "--report");
  assert.doesNotMatch(run.stderr, /No resume flag/u, `refused its own flag: ${run.stderr}`);
});

test("a target is turned away like any other name", async () => {
  const run = await ran("attach", "isue", "ISS-1", "note.md");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No attach target named isue\. Did you mean: issue\? The set is issue, comment\./u);
});

/* The cost this fixes is context: the sentence was right and the 33 lines behind it were the waste,
   so the bound is on the whole of what came back — a case reading only the first line passes on the
   block it exists to keep out (ISS-846). */
const BUDGET = 300;
const wholeOf = (run) => `${run.stdout}${run.stderr}`;

test("a verb nobody has is answered with the way to the list, and never with the list", async () => {
  const run = await ran("nosuchverb");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^No verb named nosuchverb\. `forge -h` lists the verbs\.$/mu);
  assert.doesNotMatch(wholeOf(run), /Usage: forge </u, "the list is what `forge -h` prints when it is asked for");
  assert.equal(wholeOf(run).trimEnd().split("\n").length, 1, wholeOf(run));
  assert.ok(wholeOf(run).length < BUDGET, `${wholeOf(run).length} characters for one miss: ${wholeOf(run)}`);
});

test("a name for a call spends one sentence on the call, not thirty-three lines on the catalogue", async () => {
  const run = await ran("search", "foo");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^No verb named search\. `forge issue --search <query>` reads the backlog by a query\.$/mu);
  assert.doesNotMatch(wholeOf(run), /Usage: forge </u);
  assert.equal(wholeOf(run).trimEnd().split("\n").length, 1, wholeOf(run));
  assert.ok(wholeOf(run).length < BUDGET, `${wholeOf(run).length} characters for one miss: ${wholeOf(run)}`);
  assert.doesNotMatch(run.stderr, /forge: read search as/u, "and the word is answered, never performed");
  assert.doesNotMatch(run.stderr, /No Forge endpoint/u, "nor was anything resolved to answer it");
});

/* The one place this CLI answers a name with a replacement, and it is bounded: a write that had two
   verbs gets one release of the line, in front of the did-you-mean, so an agent that learned the
   losing name types the winning one next rather than reading a near miss (ISS-348). The window and
   what closes it: docs/cli/withholding-a-verb.md. */
const WINDOW = [{ typed: "sweep", release: "3.36.0", verb: "new", flag: "--sweep", instead: "forge attach <issue> <file>" }];

/* The registry is empty between retirements, which is most of the time, so the rule is watched against a row of its own and both entry points read it. */
test("a retiring name is refused with the verb to type, and nothing else", () => {
  const [row] = WINDOW;
  const said = retiredRefusal(row.typed, WINDOW);
  assert.match(said, new RegExp(`^\`forge ${row.typed}\` is retired`, "mu"));
  assert.ok(said.includes(row.instead), `the line names no verb to type: ${said}`);
  assert.doesNotMatch(said, /Did you mean/u, "a retirement is answered before the near miss");
  assert.equal(retiredRefusal("attach", WINDOW), null, "and a live name is not answered with a row");
  assert.equal(retiredFlagIn("new", ["--sweep", "ISS-1"], WINDOW), said, "the flag half prints the same line");
  assert.equal(retiredFlagIn("comment", ["--sweep"], WINDOW), null, "on the verb the row names and no other");
});

/* What closing the window buys: a name past its release gets what a name that never existed gets (ISS-704). */
test("a name whose window has closed is answered as any unknown one", async () => {
  for (const { name } of RETIRED.filter((one) => one.kind === "verb" && one.release === "3.35.211")) {
    for (const argv of [[name, "ISS-1", "body.md"], [name, "-h"]]) {
      const run = await ran(...argv);
      assert.equal(run.status, 1, `forge ${argv.join(" ")}: ${run.stdout}`);
      assert.doesNotMatch(run.stderr, /is retired/u, "a closed window leaves no line behind");
      assert.match(run.stderr, new RegExp(`^No verb named ${name}\\.`, "mu"), run.stderr);
      assert.doesNotMatch(run.stderr, new RegExp(`Usage: forge ${name}`, "u"), "and no usage for it either");
    }
  }
});

test("a form typed at the CLI is performed by the verb behind it, and suggested by nothing", async () => {
  for (const [form, { verb }] of Object.entries(FORMS)) {
    const run = await ran(form, "ISS-1");
    assert.match(run.stderr, new RegExp(`^forge: read ${form} as forge ${verb} ISS-1$`, "mu"),
      `forge ${form}: ${run.stderr.split("\n")[0]}`);
    assert.doesNotMatch(run.stderr, /Did you mean/u, "a word that runs is not answered with a near miss");
    assert.doesNotMatch(run.stderr, /No verb named/u, `forge ${form} is a word this CLI performs`);
  }
});
