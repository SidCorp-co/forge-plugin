/* `-h` worked on four of seventeen verbs; the rest read it as a filename, a uuid or a tool name.
   The loop is the point: verb eighteen cannot ship without one. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { VERB_NAMES, helpOf, takesATrackerField, usageOf } from "../../src/resolve/visibility.mjs";
import { helpAskedOf, wantsHelp } from "../../src/resolve/flags.mjs";
import { USAGE as KNOWLEDGE, SAYS as KNOWLEDGE_SAYS } from "../../src/tools/knowledge.mjs";
import { USAGE as CLOUDFLARE, SAYS as CLOUDFLARE_SAYS } from "../../src/tools/cloudflare.mjs";
import { USAGE as STATS, SAYS as STATS_SAYS } from "../../src/stats/stats.mjs";
import { USAGE as CODEX } from "../../src/codex/codex.mjs";
import { CHECK_USAGE, USAGE as SPEC } from "../../src/spec/verbs.mjs";
import { tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ask = (...argv) =>
  spawnSync(FORGE, argv, {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: tempRoom("cli-help-") },
  });

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
  assert.match(missing.stderr, /No verb named isues. Did you mean: issues/u);
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

/* One usage line documents every action, and the actions are what a caller needs: a generic
   `Usage: forge codex <...>` would satisfy the old assertion while deleting all of it. */
test("a verb with actions of its own keeps its own help", () => {
  const out = ask("codex", "-h");
  assert.equal(out.status, 0);
  assert.match(`${out.stdout}${out.stderr}`, /--verify <risk>/u);
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

/* One row per action of every dispatcher that takes a subject. `-h` after the action ran the action:
   `knowledge search -h` searched the store by meaning for that word and `delete -h` resolved an
   endpoint to delete a slug named it, twelve of these twenty exited 1 and eight answered on stderr.
   The loop is the point: dispatcher six cannot ship without a row, and each row is judged against
   the module's own constant rather than a second copy of the prose here (ISS-305). */
const SUBJECT_HELP = [
  ["knowledge", KNOWLEDGE, KNOWLEDGE_SAYS, ["list", "get", "write", "search", "delete"]],
  ["cloudflare", CLOUDFLARE, CLOUDFLARE_SAYS,
    ["zones", "zone", "dns", "purge", "search", "login", "accounts"]],
  ["stats", STATS, STATS_SAYS, ["runs", "eval", "marks"]],
  ["codex", CODEX, {},
    ["consult", "verdict", "pending", "show", "log", "stats", "eval", "marks", "replay"]],
  ["spec", SPEC, { check: CHECK_USAGE }, ["check"]],
];

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
const POINTS_AT = {
  issues: "forge_issues",
  issue: "forge_issues",
  new: null,
  comment: null,
  claim: "forge_issues",
  resume: "forge_issues",
  record: "forge_issues",
  advance: "forge_issues",
  spec: null,
  attach: null,
  deps: "forge_issues",
  next: null,
  dep: "forge_project_pm",
  guide: null,
  project: null,
  knowledge: "forge_knowledge",
  cloudflare: null,
  codex: null,
  hooks: null,
  feedback: null,
  doctor: null,
  stats: null,
  tools: null,
  schema: null,
  call: null,
};

/* The table is where an agent learns the surface, so one write has one row in it: a name a landing
   retired leaves the table with the flag it was reached through, and the row that took the write
   over says what it takes now. `plan` is judged by the deepEqual above; these are its two halves
   the table still has rows for (ISS-348). */
test("a retired name is in no row, and the row that took its write over says what it takes", () => {
  const brief = ask("-h").stdout;
  const rowOf = (verb) => brief.split("\n").find((line) => line.trim().startsWith(`${verb} `));
  assert.ok(!rowOf("new").includes("--into"), `the new row still offers --into: ${rowOf("new")}`);
  assert.match(rowOf("comment"), /\[--title T\] post a comment; the lease on the record decides/u);
  assert.match(rowOf("feedback"), /`forge new` with the kind, the project and the Where filled in/u,
    "and the verb kept as a name says what it expands to");
});

const pointerIn = (verb) =>
  helpOf(verb).split("\n").find((line) => line.startsWith("The fields the tracker takes"));

test("the schema pointer goes to the rows whose every value the tracker names", () => {
  assert.deepEqual(Object.keys(POINTS_AT), VERB_NAMES, "verb twenty-five is judged here or nowhere");
  for (const [verb, tool] of Object.entries(POINTS_AT)) {
    assert.equal(
      pointerIn(verb),
      tool ? `The fields the tracker takes: \`forge schema ${tool}\`.` : undefined,
      `forge ${verb} -h: ${helpOf(verb)}`,
    );
  }
});

/* A usage line no verb has: what the derivation reads is the line, so a list of the verbs that
   take a file could not answer any of these, and the vocabulary is pinned where it is spelled. */
test("which values are the tracker's is read off the args line alone", () => {
  for (const [args, earns] of [
    ["[--status s] [--search q]", true],
    ["<uuid|ISS-45>", true],
    ["[contract [part]|slug]", true],
    ["[--credentials] [--full]", false],
    ["", false],
    ["<file.md|@file|->", false],
    ["<file>...", false],
    ["<uuid|ISS-45> <report.md|@file|-> --title T", false],
    ["[--count n] [--project dir]", false],
  ]) {
    assert.equal(takesATrackerField(args), earns, `\`${args}\``);
  }
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
