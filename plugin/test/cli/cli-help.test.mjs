/* `-h` worked on four of seventeen verbs; the rest read it as a filename, a uuid or a tool name.
   The loop is the point: verb eighteen cannot ship without one. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { GROUPS, VERBS, VERB_NAMES, helpOf, usageOf } from "../../src/resolve/visibility.mjs";
import { flagsNamed, helpAskedOf, unknownFlag, wantsHelp } from "../../src/resolve/flags.mjs";
import { USAGE as KNOWLEDGE, SAYS as KNOWLEDGE_SAYS } from "../../src/tools/knowledge.mjs";
import { USAGE as CLOUDFLARE, SAYS as CLOUDFLARE_SAYS } from "../../src/tools/services/cloudflare.mjs";
import { USAGE as STATS, SAYS as STATS_SAYS } from "../../src/stats/stats.mjs";
import { SAYS as CODEX_SAYS, USAGE as CODEX } from "../../src/codex/codex.mjs";
import { CHECK_USAGE, USAGE as SPEC } from "../../src/spec/verbs.mjs";
import { KINDS, USAGE as RECORD, kindUsage } from "../../src/flow/record/record-rows.mjs";
import { RETIRED, commandShapes } from "../../src/checks/retired-names.mjs";
import { WHY, goalBlock } from "../../src/goals.mjs";
import { SHAPES } from "../../src/flow/machine.mjs";
import { tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../", import.meta.url).pathname;
/* One spawn per argv, held for the file: four walks ask the same names for help, and nothing asked here writes state. */
const HOME = tempRoom("cli-help-");
const ASKED = new Map();
const ask = (...argv) => {
  const key = argv.join("\0");
  if (!ASKED.has(key)) {
    ASKED.set(key, spawnSync(FORGE, argv, { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: HOME } }));
  }
  return ASKED.get(key);
};

test("every verb says what to type", () => {
  for (const verb of VERB_NAMES) {
    const run = ask(verb, "-h");
    assert.equal(run.status, 0, `forge ${verb} -h exited ${run.status}: ${run.stderr}`);
    assert.ok(
      `${run.stdout}${run.stderr}`.includes(usageOf(verb)),
      `forge ${verb} -h answered something else: ${run.stdout}${run.stderr}`,
    );
  }
});

/* On stderr, `forge -h | head` printed nothing, and callers learned to write `2>&1` first. */
test("help is an answer, not a failure", () => {
  const run = ask("-h");
  assert.equal(run.status, 0);
  assert.match(run.stdout, /Usage: forge </u, "it goes to stdout");
  assert.equal(run.stderr, "", `and nothing to stderr: ${run.stderr}`);
  const missing = ask("isues");
  assert.equal(missing.status, 1, "a verb that does not exist is still a failure");
  assert.match(missing.stderr, /No verb named isues. Did you mean: issue/u);
  assert.equal(missing.stdout, "", "and a failure says nothing on stdout");
});

test("the write-time rules wait to be asked for", () => {
  const brief = ask("-h").stdout;
  assert.ok(!brief.includes("Before you write"), `ten lines nobody asked for: ${brief}`);
  assert.match(brief, /forge -h --full/u, "and the way to ask is on the line");
  assert.match(ask("-h", "--full").stdout, /Before you write:/u);
});

/* Reported: the help advertised a pipeline run. `pipelineConfig` is a field the caller patches and
   the replace-not-merge warning is load-bearing, so the distinction is pinned rather than swept. */
test("no run of anything else is advertised", () => {
  for (const argv of [["-h"], ["-h", "--full"]]) {
    assert.ok(!ask(...argv).stdout.includes("pipeline run"), argv.join(" "));
  }
  assert.match(ask("-h", "--full").stdout, /replace-not-merge/u);
});

/* A reference followed by `-h` names a file to post, and help there is a write that never ran. */
test("an argument is not a question", () => {
  assert.ok(wantsHelp(["-h"]) && wantsHelp(["--help"]));
  assert.ok(!wantsHelp(["ISS-45", "-h"]), "a file to post");
  assert.ok(!wantsHelp(["x.md", "--title", "-h"]), "an issue may be titled -h");
  assert.ok(!wantsHelp(["forge_issues", '{"note":"-h"}']), "and a json field may hold it");
});

/* Which is why a verb that takes a subject spends a second name rather than widening the first:
   `wantsHelp` above cannot grow a slot without making that file-to-post a question again. */
test("a subject's help stands in two slots and no more", () => {
  const subs = ["get", "search"];
  assert.deepEqual(helpAskedOf(["-h"], subs), { subject: null }, "the verb itself is the question");
  assert.deepEqual(helpAskedOf(["--help"], subs), { subject: null });
  assert.deepEqual(helpAskedOf(["get", "-h"], subs), { subject: "get" }, "and here the subject is");
  assert.equal(helpAskedOf(["get", "some-slug", "-h"], subs), null, "past the second slot it is a value");
  assert.equal(helpAskedOf(["search", "--limit", "-h"], subs), null, "and a flag's value may be it");
  assert.equal(helpAskedOf(["frobnicate", "-h"], subs), null, "a name the verb has not got is a typo");
  assert.equal(helpAskedOf([], subs), null, "and nothing typed is not a question either");
});

/* One row per action of every dispatcher that takes a subject. `-h` after the action ran the action: `knowledge search -h` searched the store by meaning for that word and `delete -h` resolved an endpoint to delete a slug named it, twelve of these twenty exited 1 and eight answered on stderr. The loop is the point: dispatcher six cannot ship without a row, and each row is judged against the module's own constant rather than a second copy of the prose here (ISS-305). */
const SUBJECT_HELP = [
  ["knowledge", KNOWLEDGE, KNOWLEDGE_SAYS, ["list", "get", "write", "search", "delete"]],
  ["cloudflare", CLOUDFLARE, CLOUDFLARE_SAYS,
    ["zones", "zone", "dns", "purge", "search", "login", "accounts"]],
  ["stats", STATS, STATS_SAYS, ["runs", "eval", "marks"]],
  ["codex", CODEX, CODEX_SAYS,
    ["consult", "verdict", "pending", "show", "log", "stats", "eval", "marks", "replay"]],
  ["spec", SPEC, { check: CHECK_USAGE }, ["check"]],
  ["record", RECORD, Object.fromEntries(KINDS.map((kind) => [kind, kindUsage(kind).split("\n")[0]])), KINDS],
];

/* The table above is what the cap and the stranger walk below measure, so a subject with a text of
   its own and no row here is a sub-verb neither reaches: each module's `SAYS` is compared with it. */
test("every subject a module answers help for has a row in the table", () => {
  for (const [verb, , says, subs] of SUBJECT_HELP) {
    if (verb === "spec") continue;
    assert.deepEqual(Object.keys(says).sort(), [...subs].sort(), `forge ${verb}: the rows and its SAYS differ`);
  }
});

const asking = ({ subs }) => [...subs.map((one) => [one, "-h"]), [subs[0], "--help"]];

/* Collected and asserted once: a loop throwing on its first row could not show that narrowing the predicate back to one slot takes all five dispatchers with it, which is how these were proven. */
test("an action asked what to type answers with its own usage, and reaches nothing to do it", () => {
  const wrong = [];
  for (const [verb, whole, says, subs] of SUBJECT_HELP) {
    for (const [named, word] of asking({ subs })) {
      const run = ask(verb, named, word);
      const said = `forge ${verb} ${named} ${word}`;
      if (run.status !== 0) wrong.push(`${said} exited ${run.status}: ${run.stdout}${run.stderr}`);
      if (run.stderr !== "") wrong.push(`${said} said this on stderr: ${run.stderr}`);
      if (!run.stdout.includes(says[named] ?? whole)) {
        wrong.push(`${said} answered something else: ${run.stdout}`);
      }
    }
  }
  assert.deepEqual(wrong, []);
});

/* The half a help path is easiest to buy at the price of: a name the verb has not got is still refused with the nearest ones, and a value is still a value. */
test("an action the verb has not got is a refusal, and a later help word is a value", () => {
  const missing = ask("knowledge", "frobnicate", "-h");
  assert.equal(missing.status, 1, `${missing.stdout}${missing.stderr}`);
  assert.match(missing.stderr, /No knowledge action named frobnicate/u);
  assert.equal(missing.stdout, "", "and a failure says nothing on stdout");
  const noted = ask("codex", "verdict", "--accepted", "F1", "--note", "-h");
  assert.doesNotMatch(`${noted.stdout}${noted.stderr}`, /Usage: forge codex </u,
    "a note reading -h reached the verdict writer, which answered about the consult it has none of");
});

/* The whole table rather than two examples: `<file>...` keeps its brackets and its ellipsis, and
   `[contract [part]|slug]` leaves an empty alternative behind, and neither shows in a sample. */
/* Every verb and the fields the tracker takes for the routes it is the route for, spelled here rather than derived: read off the tables the code reads, this case would agree with a generator that had lost half the routes. A verb owning no route names none — `claim` and `resume` spend `forge_issues` and own nothing of it, so what they send is `forge issue`'s to declare. */
const FIELDS_OF = {
  issue: "documentId, edgeId, fields, filters, limit, offset",
  new: null,
  comment: "filters",
  claim: null,
  resume: null,
  record: null,
  advance: "documentId",
  spec: null,
  attach: "bytes",
  next: null,
  guide: "slug",
  project: "archived, projectRef",
  knowledge: "authoredBy, body, confidence, injection, injectionFilter, kind, kindFilter, metadata,"
    + " query, scope, slug, sourceFilter, strategy, title, topK",
  cloudflare: null,
  codex: null,
  chatgpt: null,
  hooks: null,
  feedback: null,
  doctor: "depth, issueId",
  stats: null,
};

/* The table is where an agent learns the surface, so one write has one row in it: a name a landing
   retired leaves the table with the flag it was reached through, and the row that took the write
   over says what it takes now. Read off the registry, so the next retirement is judged too (ISS-348). */
test("a retired name is in no row, and the row that took its write over says what it takes", () => {
  const brief = ask("-h").stdout;
  const rowOf = (verb) => brief.split("\n").find((line) => line.trim().startsWith(`${verb} `));
  for (const { name } of RETIRED.filter((one) => one.kind === "flag")) {
    const offering = VERB_NAMES.filter((verb) => rowOf(verb)?.includes(`--${name}`));
    assert.deepEqual(offering, [], `--${name} is retired and still offered by: ${offering.join(", ")}`);
  }
  assert.match(rowOf("comment"), /\[--title T\] the thread whole with no body, or post one/u);
  assert.match(rowOf("feedback"), /`forge new` with the kind, the project and the Where filled in/u,
    "and the verb kept as a name says what it expands to");
});

const pointerIn = (verb) =>
  helpOf(verb).split("\n").find((line) => line.startsWith("The fields the tracker takes"));

test("each verb's -h names the fields the tracker takes for the routes that verb owns", () => {
  assert.deepEqual(Object.keys(FIELDS_OF), VERB_NAMES, "a verb added is judged here or nowhere");
  for (const [verb, fields] of Object.entries(FIELDS_OF)) {
    assert.equal(
      pointerIn(verb),
      fields ? `The fields the tracker takes: ${fields}.` : undefined,
      `forge ${verb} -h: ${helpOf(verb)}`,
    );
  }
});

/* One scope, one verb: two places to answer *which project* is a precedence rule nobody wrote. */
const NAMES_A_PROJECT = /--project\b|--slug\b|<slug>|projectRef|project[- ]id/iu;

test("no row of the table but project names a project, its slug or its identifier", () => {
  const found = VERBS.filter((row) => NAMES_A_PROJECT.test(row[1] ?? "")).map((row) => row[0]);
  assert.deepEqual(found, ["project"],
    "a verb naming a project takes one from the caller, which the checkout already answered");
  assert.ok(NAMES_A_PROJECT.test(usageOf("project")), "and the one that does still says so");
});

/* An agent in another project learns where a defect in this plugin goes from `-h` or from nowhere. */
test("both help forms name the verb a plugin defect is filed with, and no folder", () => {
  for (const argv of [["-h"], ["-h", "--full"]]) {
    const run = ask(...argv);
    assert.equal(run.status, 0);
    assert.match(run.stdout, /forge feedback/u, `forge ${argv.join(" ")} names no route for a defect`);
    assert.doesNotMatch(run.stdout, /feedback\//u, `forge ${argv.join(" ")} still points at a folder`);
  }
});

/* An agent that does not know a thing exists spends no turn on it; one that knows and cannot act
   reads it and weighs it anyway. So `forge doctor` carries all of that and no help text does. */
test("no help text names a guide this plugin withholds, or a flag only a maintainer can act on", async () => {
  const { heldSlugs } = await import("../../src/guides/guides.mjs");
  for (const argv of [["-h"], ["-h", "--full"], ["guide", "-h"]]) {
    const run = ask(...argv);
    const text = `${run.stdout}${run.stderr}`;
    assert.equal(text.includes("--tracker"), false, `forge ${argv.join(" ")} names the flag: ${text}`);
    for (const slug of heldSlugs()) {
      assert.equal(text.includes(slug), false, `forge ${argv.join(" ")} names ${slug}`);
    }
  }
});

/* It paraphrased the tracker's `agent-setup`, five of whose rules the contract has replaced. */
test("the preamble carries this CLI's rules and not the runner's", () => {
  const full = ask("-h", "--full").stdout;
  for (const runner of ["forge_memory", "clarify", "draft"]) {
    assert.ok(!full.includes(runner), `the runner's ${runner} is still in the preamble: ${full}`);
  }
  assert.match(full, /`forge new` refuses/u, "what a filing is refused without");
  assert.match(full, /A status is earned, not set/u, "and that a status is earned");
  assert.match(full, /`forge record plan` and\n\s+`forge record criteria`/u, "by the agent, through these");
});

/** Every name that answers `-h`: the verbs, and each subject of the table above. */
const EVERY_HELP = [
  ...VERB_NAMES.map((verb) => [verb]),
  ...SUBJECT_HELP.flatMap(([verb, , , subs]) => subs.map((sub) => [verb, sub])),
];

/* One screen — eighty by thirty — with room for the widest state a project can put a verb in: `new -h` prints a reason its project's own state chooses, so the number sits above the longest of those and not at what a fresh home happens to print. `codex -h` was 6.5 KB of guide prose no run looking for a flag reads. `forge -h` is exempt and only it: a list of verbs is a different question (ISS-700). */
const CAP = 2500;

/* Measured whole: nothing is stripped before the count, because a cap over a subset of the text a
   caller reads is a smaller claim than the one this case makes. The fresh home reads the shortest
   reason there can be for having no goals, so the widest one is added back to what it measured: a
   cap proven at one project's state is proven for no other. */
test("every verb's help and every action's is under the cap, at the widest state a project can make", () => {
  const blocks = Object.values(WHY).map((why) => goalBlock({ why, goals: [] }, "").join("\n\n").length);
  const widest = Math.max(...blocks) - goalBlock({ why: WHY.endpoint, goals: [] }, "").join("\n\n").length;
  const over = [];
  for (const argv of EVERY_HELP) {
    const run = ask(...argv, "-h");
    const said = `${run.stdout}${run.stderr}`;
    const size = said.includes("`Serves:") ? said.length + widest : said.length;
    if (size > CAP) over.push(`forge ${argv.join(" ")} -h is ${size} bytes, over ${CAP}`);
  }
  assert.deepEqual(over, []);
  assert.ok(widest > 0, "and the reasons differ in length, or this case measures one of them twice");
});

/* The set is read off the text the name's own `-h` prints, for a verb as for an action: the text is
   taken by running it, so a flag added there is taken with no second edit and nothing here is a
   second copy of a flag list. Under the message are rows the help printed, and where the help names
   a flag at all one of them names one — the half a nearest name lacks. */
test("the set every name refuses against is the one its own help prints", () => {
  const wrong = [];
  for (const argv of EVERY_HELP) {
    const name = argv.join(" ");
    const usage = `${ask(...argv, "-h").stdout}`;
    const said = unknownFlag(name, ["--zzz"], { usage });
    const rows = said ? said.split("\n").slice(1) : [];
    const printed = usage.split("\n").map((line) => line.trimEnd());
    if (!said) wrong.push(`forge ${name} takes --zzz, which its help does not name`);
    else if (!said.includes("--zzz")) wrong.push(`forge ${name}: ${said}`);
    else if (!rows.length || !rows.every((row) => printed.includes(row))) {
      wrong.push(`forge ${name} ends on a line its help does not print: ${said}`);
    } else if (flagsNamed(usage).length && !flagsNamed(rows.join("\n")).length) {
      wrong.push(`forge ${name} refuses without naming one flag it does take: ${said}`);
    }
    for (const flag of flagsNamed(usage)) {
      if (unknownFlag(name, [flag], { usage })) wrong.push(`forge ${name} refuses ${flag}, which it names`);
    }
  }
  assert.deepEqual(wrong, []);
});

/* And the wiring, which the derivation above cannot show. One invocation per name, with whatever
   positional it needs first, because a stranger in the positional slot is a different refusal. */
const ARGS = {
  issue: ["ISS-1"],
  claim: ["ISS-1"],
  resume: ["ISS-1"],
  advance: ["ISS-1"],
  comment: ["ISS-1", "body.md"],
  attach: ["issue", "ISS-1", "body.md"],
  new: ["body.md"],
  feedback: ["body.md"],
  schema: ["forge_issues"],
  call: ["forge_issues"],
  spec: ["BR-01"],
  "knowledge get": ["slug"],
  "knowledge write": ["slug", "body.md"],
  "knowledge search": ["query"],
  "knowledge delete": ["slug"],
  "cloudflare zone": ["zone-id"],
  "cloudflare dns": ["zone-id"],
  "cloudflare purge": ["zone-id"],
  "cloudflare search": ["query"],
  ...Object.fromEntries(KINDS.map((kind) => [`record ${kind}`, ["ISS-1"]])),
};

test("every verb and every action hands the parser its text before it reads or asks", () => {
  const wrong = [];
  for (const argv of EVERY_HELP) {
    const name = argv.join(" ");
    const run = ask(...argv, ...(ARGS[name] ?? []), "--zzz", "x");
    const said = `${run.stdout}${run.stderr}`;
    if (run.status !== 1) wrong.push(`forge ${name} --zzz x exited ${run.status}: ${said}`);
    else if (!said.includes("--zzz")) wrong.push(`forge ${name} --zzz x named nothing: ${said}`);
  }
  assert.deepEqual(wrong, []);
});

/* So the check is not a blanket refusal, and a known flag with no value keeps its own line. */
test("a flag the text names is taken, and one with no value says so", () => {
  const known = ask("issues", "--status", "open");
  assert.doesNotMatch(`${known.stdout}${known.stderr}`, /No issues flag named/u);
  const empty = ask("claim", "ISS-1", "--minutes");
  assert.match(empty.stderr, /--minutes was given no value/u);
  assert.doesNotMatch(empty.stderr, /No claim flag named/u);
});

/* `onlyFlags` had ten calls in one file and four more verbs spelled the check themselves. */
test("no verb spells the flag-name check itself", () => {
  const held = spawnSync("grep", ["-rn", "onlyFlags", "plugin/src", "plugin/hooks"],
    { cwd: ROOT, encoding: "utf8" });
  assert.equal(held.stdout, "", `the preflight is back:\n${held.stdout}`);
  const named = spawnSync("grep", ["-rln", "unknownFlag", "plugin/src"], { cwd: ROOT, encoding: "utf8" });
  assert.deepEqual(named.stdout.split("\n").filter(Boolean).sort(),
    ["plugin/src/commands.mjs", "plugin/src/resolve/flags.mjs"],
    "the check lives in the parser; commands.mjs asks it the one other question, a flag in the body slot");
});

/* Twenty-five rows flat is a list nobody reads for one of them, so `forge -h` prints groups. Every
   verb sits under exactly one heading, which is the row's own field and not a second list here. */
test("forge -h prints the verbs in groups, each under its heading", () => {
  const said = ask("-h").stdout;
  const headings = GROUPS.filter((group) => said.includes(`\n${group}\n`));
  assert.deepEqual(headings, GROUPS, `a heading is missing: ${said}`);
  const under = {};
  let group = null;
  for (const line of said.split("\n")) {
    if (GROUPS.includes(line)) group = line;
    else if (group && /^ {2}\S/u.test(line)) (under[group] ??= []).push(line.trim().split(" ")[0]);
  }
  assert.deepEqual(Object.values(under).flat().sort(), [...VERB_NAMES].sort(),
    "every verb is under exactly one heading");
});

/* One home, `forge doctor`; the exceptions carry the key of the issue that owns those lines. */
const FILE_HOMES = ["plugin/src/resolve/settings.mjs", "plugin/src/tools/doctor.mjs"];
const ROUTED = { "plugin/src/tracker/project-config.mjs": "ISS-702" };

test("the project file is named by doctor and by no other verb's help", () => {
  const named = [];
  for (const argv of EVERY_HELP) {
    const run = ask(...argv, "-h");
    if (`${run.stdout}${run.stderr}`.includes(".forge.json")) named.push(`forge ${argv.join(" ")} -h`);
  }
  assert.deepEqual(named, []);
  const held = spawnSync("grep", ["-rn", "--include=*.mjs", "\\.forge\\.json", "plugin/src"],
    { cwd: ROOT, encoding: "utf8" });
  const stray = held.stdout.split("\n").filter(Boolean)
    /* A comment names it for a reader of the code; a print, for a reader of the answer. */
    .filter((line) => !/^\S+:\d+:\s*(?:\/\*|\*|\/\/)/u.test(line))
    .filter((line) => !FILE_HOMES.some((home) => line.startsWith(`${home}:`)))
    .filter((line) => !Object.keys(ROUTED).some((home) => line.startsWith(`${home}:`)));
  assert.deepEqual(stray, [], "a new mention, with its file and line");
});

test("the guides and the contract name the project file nowhere", () => {
  const held = spawnSync("grep", ["-rn", ".forge.json", "plugin/guides"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(held.stdout, "", `a guide names the file rather than \`forge doctor\`:\n${held.stdout}`);
});

/* A tripwire with a declared dormancy, not a dead selector: the handler's table is part 4's, this walk matches nothing until it lands, and ISS-700's rules ask for it by name — the day `handler.mjs` exports FORMS its words are held out of every help text with no second edit. Deleting it as dead is the one move to not make here; it was made at afeb945 and undone. */
test("no help text names a form of the handler's table", async () => {
  /* Dormant while the file is absent and never for any other reason: an import that throws, or a
     table renamed, is the walk going quiet on a tree that has the handler in it (F1). */
  const at = new URL("../../src/resolve/handler.mjs", import.meta.url);
  if (!existsSync(at)) {
    assert.equal(existsSync(at), false, "the handler has not landed, so this walk has nothing to match");
    return;
  }
  const held = await import(at.href);
  const forms = Object.keys(held.FORMS ?? {});
  assert.ok(forms.length, "the handler landed, so FORMS is what every help text is walked for");
  const named = [];
  /* The checker's reading, not a bare word, since `list`, `get` and `confirm` are English a help
     text is written in; and narrowed by whose table it is — a row of one verb's own help is that
     verb's sub-name, so `record park` and `knowledge list` are live and keep their rows. */
  for (const argv of [["-h"], ["-h", "--full"], ...EVERY_HELP.map((one) => [...one, "-h"])]) {
    const said = `${ask(...argv).stdout}${ask(...argv).stderr}`;
    const top = argv.every((word) => word.startsWith("-"));
    for (const form of forms) {
      const shapes = top ? commandShapes(form) : commandShapes(form).slice(0, 1);
      if (shapes.some((shape) => shape.test(said))) named.push(`forge ${argv.join(" ")}: ${form}`);
    }
  }
  assert.deepEqual(named, [], "a form named as a verb this CLI offers, with the help text naming it");
});

/* The kinds are the list `record -h` is for; a kind's flags are that kind's own call. */
test("record -h lists the kinds one per line, and each kind's flags are under its own help", () => {
  const said = ask("record", "-h").stdout;
  for (const kind of KINDS) {
    const row = said.split("\n").find((line) => line.startsWith(`  ${kind} `));
    assert.ok(row, `record -h lists no ${kind}: ${said}`);
    assert.ok(row.trim().split(/\s+/u).length > 2, `the ${kind} row carries no phrase: ${row}`);
    assert.ok(!row.includes("--"), `the ${kind} row still carries its flags: ${row}`);
  }
  assert.match(ask("record", "verdict", "-h").stdout, /--criterion N --verdict pass\|fail\|skipped/u);
  assert.match(ask("record", "baseline", "-h").stdout, /--gate G --result R --commit C/u);
});

/* Now that the set is the text's, a field the row leaves out is a field the parse refuses: the verification's `--contains` was offered by `earned.mjs` as the way out of a build past the merge and named on no row, so the one command that cleared it was turned away. */
test("every field a kind's shape takes is named on the row its help prints", () => {
  const missing = [];
  for (const kind of KINDS) {
    const named = flagsNamed(kindUsage(kind));
    for (const field of SHAPES[kind]?.fields ?? []) {
      if (field.derived || field.written || field.stamped || named.includes(`--${field.flag}`)) continue;
      missing.push(`record ${kind} takes --${field.flag}, which its help does not name`);
    }
  }
  assert.deepEqual(missing, []);
  assert.ok(SHAPES.verification.fields.some((one) => one.flag === "contains"), "the case has a field to find");
});

/* A configuration key on a verb's help is a second copy of what resolved, and the values it names
   go stale silently: what is in effect is `forge codex show`'s to print. */
test("codex -h names no configuration key", () => {
  const said = ask("codex", "-h").stdout;
  for (const key of ["pathRe", "budgetMs", "maxTokens", "roundsMax", "effortLines", "toolChoiceNone"]) {
    assert.ok(!said.includes(key), `codex -h names ${key}: ${said}`);
  }
  assert.match(said, /forge codex show/u, "and it says where what is in effect is printed");
});
