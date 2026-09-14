/* Every command in a document is one a developer will run, and `writes.md` drifted three ways in a day
   while every gate stayed green. The CLI's own tables answer, so a flag renamed there fails here. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { claimProblems, docClaims, nameProblems, namesClaimed, namesHeld } from "../../../src/checks/doc-shape.mjs";
import { codeOf, quoted } from "../../../src/checks/tracker-names.mjs";
import { VERB_NAMES } from "../../../src/resolve/visibility.mjs";
import { FORM_NAMES } from "../../../src/resolve/handler.mjs";
import { surfaceOf, wordsOf } from "../../surfaces.mjs";
import { KINDS } from "../../../src/flow/record/record-rows.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;
const HOW = join(ROOT, "plugin", "hooks", "how");

/* Every directory the plugin ships code in — `protectInline` is documented and lives under `vi-natural` — and not the suite, whose fixtures name words on purpose that nothing reads. */
const SHIPPED = ["src", "hooks", "scripts", "vi-natural"];
const sources = () => {
  const out = [];
  const walk = (dir) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) {
        if (one.name !== "vendor" && one.name !== "node_modules") walk(join(dir, one.name));
      } else if (one.name.endsWith(".mjs")) {
        out.push(readFileSync(join(dir, one.name), "utf8"));
      }
    }
  };
  for (const one of SHIPPED) walk(join(ROOT, "plugin", one));
  return out.join("\n");
};

/* A handled form is a command the CLI has, so a document naming one is naming something a reader can
   type; what the forms may not appear in is any help text, which cli-help.test.mjs holds. */
const held = {
  verbs: [...VERB_NAMES, ...FORM_NAMES],
  usageOf: surfaceOf,
  wordsOf,
  documented: readdirSync(HOW).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3)),
  sources: sources(),
};

const markdown = execFileSync("git", ["-C", ROOT, "ls-files", "*.md"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

/* The tree whose subject is this code, and the identifier rule's scope: a whole-repository selector fires 82 times, 79 of them on a name owned by the sibling package or by Claude Code (ISS-897). */
const CLI_DOCS = /^docs\/cli\//u;
const source = sources();
const named = namesHeld(codeOf(source), quoted(source));

test("every command a document tells a reader to run is one the CLI has", () => {
  let claims = 0;
  const read = markdown;
  for (const rel of read) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    const found = docClaims(text);
    claims += found.calls.length + found.flags.length + found.envs.length;
    assert.deepEqual(claimProblems(text, held), [], rel);
  }
  assert.ok(read.length > 20, `${read.length} markdown file(s) found`);
  assert.ok(claims > 40, `${claims} claims across ${read.length} documents: the pattern found nothing`);
});

/* No document is exempt: every markdown file this repository tracks is read as an instruction, so a
   command named in one is a command the CLI has. */
test("a retired verb named in any tracked document is a finding", () => {
  const said = claimProblems("The run typed `forge nonsense ISS-45` and it was refused.", held);
  assert.equal(said.length, 1, "no filter removes it");
});

test("a renamed flag, a dropped verb, a document that moved and a dead switch each fail", () => {
  const said = claimProblems(
    "Run `forge hooks --nope`, then `forge nonsense`, read `forge hooks --how ghost`, set FORGE_MADE_UP=1.",
    held,
  );
  assert.deepEqual(said, [
    "`forge nonsense` is no verb",
    "`forge hooks --nope` is in no usage line",
    "`--how ghost` names no document",
    "FORGE_MADE_UP is read by nothing",
  ]);
  /* A truncation is in the real flag by substring, and truncation is how a flag drifts. */
  assert.deepEqual(claimProblems("`forge hooks --den`", held), ["`forge hooks --den` is in no usage line"]);
});

/* The verb here is one the CLI does not have: `advance` was the fixture until ISS-3 shipped it,
   and a proposal for a verb that exists would prove nothing about the exemption. */
test("a proposal may name the verb it opens with, and nothing else the CLI lacks", () => {
  const marker = "**Status: proposal for `forge reopen`.** Nothing here is built.";
  const body = "Run `forge reopen ISS-1`, then `forge tranistion`, then `forge hooks --nope`.";
  const rest = ["`forge tranistion` is no verb", "`forge hooks --nope` is in no usage line"];
  assert.deepEqual(claimProblems(`# A title\n\n${marker}\n\n${body}`, held), rest);
  assert.deepEqual(claimProblems(`${body}\n\n${marker}`, held), ["`forge reopen` is no verb", ...rest]);
});

/* The flags of a verb that takes a sub-verb live with the sub-verb, and holding them to the verb's
   own row would have failed every true document — so they went unjudged, and a document naming a
   flag no action takes read as clean. The word after the verb says which surface answers (ISS-700). */
test("a sub-verb's flags are judged against the sub-verb's own usage", () => {
  assert.deepEqual(claimProblems("`forge codex consult --diff --only blocker`", held), []);
  assert.deepEqual(claimProblems("`forge codex consult --nonsense x`", held),
    ["`forge codex consult --nonsense` is in no usage line"]);
  assert.deepEqual(claimProblems("`forge record verdict ISS-1 --criterion 2 --verdict pass`", held), []);
  assert.deepEqual(claimProblems("`forge record confirmation ISS-1 --criterion 2`", held),
    ["`forge record confirmation --criterion` is in no usage line"],
    "and a kind is a surface too: `--criterion` is verdict's, and the kinds' union would pass this");
});


/* The verbs whose first word the CLI refuses against a set of its own, so a kind or an action added or retired moves this rule with it. `spec` is not among them: that slot takes a clause of the requirements tree, and reading `forge spec BR-09` as a bad word would refuse a true document. */
const CLOSED_VERBS = ["chatgpt", "cloudflare", "codex", "coolify", "knowledge", "record", "stats"];

/* `forge record report` was served to every session that read Phase 7 and passed the full gate twice: the verb was real, there were no flags, and the word between them was read by nothing. `record` refuses an unknown kind by name, so that word costs a reader the round a renamed flag does. */
test("a first argument the verb refuses is a finding, with the word and the set it takes", () => {
  const said = claimProblems("Write it up with `forge record report ISS-1`.", held);
  assert.equal(said.length, 1, "one finding for one drift");
  assert.match(said[0], /^`forge record report` is no word it takes: /u, "the word it refused");
  for (const kind of KINDS) assert.ok(said[0].includes(kind), `${kind} is missing from the set printed`);
  assert.deepEqual(claimProblems("`forge stats summary --since 3d`", held),
    ["`forge stats summary` is no word it takes: runs or eval or marks"],
    "and the flags of a word the verb refuses go unjudged: they belong to a surface that is not there");
});

test("the reach is every verb whose first word the CLI refuses against a set, and no other", () => {
  assert.deepEqual(held.verbs.filter((verb) => wordsOf(verb)).sort(), [...CLOSED_VERBS].sort());
  for (const verb of CLOSED_VERBS) {
    const words = wordsOf(verb);
    assert.ok(words.length > 1, `forge ${verb} names no set of first words`);
    assert.deepEqual(claimProblems(`\`forge ${verb} frobnicate\``, held),
      [`\`forge ${verb} frobnicate\` is no word it takes: ${words.join(" or ")}`], verb);
    assert.deepEqual(claimProblems(`\`forge ${verb} ${words[0]} ISS-1\``, held), [], `forge ${verb} ${words[0]}`);
  }
  assert.equal(wordsOf("spec"), null, "`forge spec BR-09` names a clause, not a word from a set");
  assert.deepEqual(claimProblems("`forge spec BR-09` prints the clause.", held), []);
});

/* A help word is what a document tells a reader to run more often than any write, and a placeholder is how the kinds are written where no one kind is meant. Neither is a word the verb was given. */
test("a help word, a placeholder and a short form of a verb's own are no finding", () => {
  assert.deepEqual(claimProblems("`forge record -h`", held), []);
  assert.deepEqual(claimProblems("`forge record verdict -h`", held), []);
  assert.deepEqual(claimProblems("`forge record <kind> -h`", held), []);
  assert.deepEqual(claimProblems("`forge coolify apps`", held), [],
    "and coolify's short forms dispatch through ALIASES, which have no help text of their own");
});

/* ISS-822 renamed a function across 67 files, left `bandFor` in a document, and nothing failed: the retired-name rule reads quoted spans of sources alone, and a path is not an identifier. */
test("every identifier a document under docs/cli names is one this repository's code holds", () => {
  const read = markdown.filter((rel) => CLI_DOCS.test(rel));
  let claimed = 0;
  for (const rel of read) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    claimed += namesClaimed(text).length;
    assert.deepEqual(nameProblems(text, named), [], rel);
  }
  assert.ok(read.length > 20, `${read.length} document(s) under docs/cli`);
  assert.ok(claimed > 20, `${claimed} identifier(s) claimed across ${read.length} documents: the selector found nothing`);
});

test("a name this tree does not declare is a finding, and the one it declares in its place is not", () => {
  assert.deepEqual(nameProblems("`bandFor` writes the rung back as a complexity.", named),
    ["`bandFor` names nothing in this repository's code"]);
  assert.deepEqual(nameProblems("`complexityFor` writes the rung back as a complexity.", named), []);
  assert.deepEqual(nameProblems("`protectInline` runs before translation.", named), [],
    "a name declared under plugin/vi-natural is code this repository holds");
});

/* A rename leaves the old word in prose beside the code as readily as in a document. */
const namesOf = (source) => namesHeld(codeOf(source), quoted(source));

test("a name surviving only in prose is no evidence the binding is there", () => {
  const gone = "/* bandFor was the name */\nconst complexityFor = 1;\nfail(\"bandFor is retired\");\n";
  assert.deepEqual(nameProblems("`bandFor`", namesOf(gone)),
    ["`bandFor` names nothing in this repository's code"]);
  assert.deepEqual(nameProblems("`bandFor`", namesOf("const bandFor = 1;\n")), []);
  assert.deepEqual(nameProblems("`devDependencies`", namesOf('const OWES = ["devDependencies"];\n')), [],
    "a key this code reads by name lives in a string and nowhere else");
});

test("a dotted form and a SCREAMING name are no identifier claim", () => {
  assert.deepEqual(namesClaimed("`rank.band` was the key, and `ALLOWED` is search-master's."), []);
  assert.deepEqual(namesClaimed("`forge issue --offset 200` is a call, not a name."), []);
});
