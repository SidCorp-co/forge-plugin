/* Every rule of `forge spec check`, each proved by a tree that breaks it and by nothing else. The
   real tree is clean for all of them, which is exactly why a fixture has to fail: a checker whose
   selector matches nothing looks the same from outside as a repository with nothing wrong. The
   whole-tree case at the end is the other half — a fixture proves the notation, never the tree. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { clauseIndex } from "../../src/spec/index.mjs";
import { identifierProblems } from "../../src/spec/rules.mjs";
import { matches, sectionsIn, shapeProblems } from "../../src/spec/shape.mjs";

const ROOT = new URL("../../..", import.meta.url).pathname;
const FORGE = join(ROOT, "plugin", "bin", "forge");

const RULES = `# The tree

## The rules of this tree

*What must be true of every document here?*

| # | Rule | The form a checker holds | Checked by |
|---|---|---|---|
| R-01 | One sequence. | one run from 01. | the spec gate |
| R-13 | Sections. | the table below. | the spec gate |

## The sections each document carries

*What must be in the file before it counts as written?*

| Document | Sections, in order |
|---|---|
| \`srs/01-introduction.md\` | \`Purpose\` · \`Notation\` |
| \`srs/fr-NN-<slug>.md\` | \`Purpose\` · \`Actors\` · \`Use cases\` · \`The way back\`, where the requirement declares coupling · \`Business rules enforced\` |
`;

const BUSINESS_RULES = `# BRD §4 — Business rules

## The rules

*Which rules hold whatever the software is asked to do?*

| Rule | Rev | Name | Stated in |
|---|---|---|---|
| **BR-01** | 1 | the shape of a refusal | \`CLAUDE.md\` |
`;

const OPEN_ITEMS = `# BRD §8 — Open items

## What is undecided

*What is not settled, and who settles it?*

| Question | Issue |
|---|---|
| Whether a park is lifted on the record. | ISS-13 |
`;

const INDEX = `# SRS — the index

## The functional requirements

*Which capability is specified where?*

| § | Requirement | File |
|---|---|---|
| 3 | FR-01 Resolution | [fr-01-resolution.md](./fr-01-resolution.md) |
`;

const INTRODUCTION = `# SRS §1 — Introduction

## Purpose

*What is this document for?*

To say what the product does.

## Notation

*How is a clause written?*

Under an identifier.
`;

const REQUIREMENT = `# SRS §3 — FR-01 — Resolution

Rev: 1 · Actors: developer · Enforces: BR-01

## Purpose

*Why does this requirement exist?*

Because a call needs an endpoint.

## Actors

*Who acts here?*

The developer.

## Use cases

*What has to exist?*

### UC-01-1 — A setting resolved

Rev: 1 · Actors: developer · Enforces: BR-01

One source per setting.

- **AC-01-1-1** · Rev: 1 · Proof: none yet — ISS-01
  WHEN a setting is asked for THEN the CLI SHALL answer from one source.

## Business rules enforced

*Which rules does this requirement carry out?*

| Rule | How |
|---|---|
| BR-01 | every refusal names its fix |
`;

const CLEAN = {
  "docs/requirements/README.md": RULES,
  "docs/requirements/brd/04-business-rules.md": BUSINESS_RULES,
  "docs/requirements/brd/08-open-items.md": OPEN_ITEMS,
  "docs/requirements/srs/README.md": INDEX,
  "docs/requirements/srs/01-introduction.md": INTRODUCTION,
  "docs/requirements/srs/fr-01-resolution.md": REQUIREMENT,
};

const treeOf = (changes = {}) =>
  Object.entries({ ...CLEAN, ...changes })
    .filter(([, text]) => text !== null)
    .map(([file, text]) => ({ file, text }));

const problemsIn = (changes) => {
  const documents = treeOf(changes);
  return [...identifierProblems({ documents, index: clauseIndex(documents) }), ...shapeProblems(documents)];
};

/** What the fixture refuses, as `<rule> <id>` — a case names the rule it broke and the clause it
 *  broke it in, so a rule that fires for the wrong reason is not mistaken for the one asked for. */
const said = (changes) => problemsIn(changes).map((one) => `${one.rule} ${one.id}`);

const replaced = (file, from, to) => ({ [file]: CLEAN[file].replace(from, to) });

const REQUIREMENT_FILE = "docs/requirements/srs/fr-01-resolution.md";
const INDEX_FILE = "docs/requirements/srs/README.md";

test("the clean fixture breaks no rule, so every case below is about the change it makes", () => {
  assert.deepEqual(said({}), []);
});

test("a finding is one line naming the file and line, the identifier, the rule and the fix", () => {
  const [one, ...rest] = problemsIn(replaced(REQUIREMENT_FILE, "*Who acts here?*", "The people below."));
  assert.deepEqual(rest, [], "one break, one finding");
  assert.equal(one.file, REQUIREMENT_FILE);
  assert.equal(one.line, CLEAN[REQUIREMENT_FILE].split("\n").indexOf("## Actors") + 1);
  assert.equal(one.id, "## Actors");
  assert.equal(one.rule, "R-14");
  assert.match(one.fix, /Write the question this section answers/u);
  const printed = execFileSync(FORGE, ["spec", "check"], { cwd: join(ROOT, "plugin"), encoding: "utf8" });
  assert.equal(printed, "", "this repository's tree prints nothing, so the shape above is what a finding is");
});

/* The rule this file exists to hold: a checker nobody has watched refuse is a checker nobody has,
   and a rule reported by the source with no case here is exactly what that looks like. */
test("every rule this check reports has a case of its own that fails without it", () => {
  const source = ["rules.mjs", "shape.mjs"]
    .map((one) => readFileSync(join(ROOT, "plugin", "src", "spec", one), "utf8"))
    .join("\n");
  const reported = [...new Set([...source.matchAll(/"(R-\d+)"/gu)].map((one) => one[1]))].sort();
  assert.ok(reported.length >= 12, `${reported.length} rule(s) reported; the selector found nothing`);
  const own = readFileSync(new URL(import.meta.url), "utf8");
  for (const rule of reported) {
    assert.match(own, new RegExp(`^test\\("${rule}: `, "mu"), `${rule} is reported and no case here breaks it`);
  }
});

test("R-01: a gap in the functional-requirement sequence is refused, and the missing number named", () => {
  const two = REQUIREMENT.replaceAll("FR-01", "FR-03").replaceAll("UC-01-1", "UC-03-1")
    .replaceAll("AC-01-1-1", "AC-03-1-1");
  const found = problemsIn({
    "docs/requirements/srs/fr-03-second.md": two,
    [INDEX_FILE]: `${INDEX}| 5 | FR-03 Second | [fr-03-second.md](./fr-03-second.md) |\n`,
  });
  const gap = found.filter((one) => one.rule === "R-01");
  assert.deepEqual(gap.map((one) => one.id), ["FR-02"], JSON.stringify(found, null, 1));
  assert.match(gap[0].fix, /is missing from the functional-requirement sequence/u);
});

test("R-01: a requirement with no file of its own is refused", () => {
  const found = said({ [REQUIREMENT_FILE]: null, "docs/requirements/srs/elsewhere.md": REQUIREMENT });
  assert.ok(found.includes("R-01 FR-01"), found.join(" · "));
});

/* A file named for the number is not the same claim as the clause being in it: a checker asking
   only whether some `fr-01-*.md` exists passes a tree whose requirements swapped titles. */
test("R-01: a requirement defined in a file named for another number is refused", () => {
  const found = problemsIn({
    [REQUIREMENT_FILE]: CLEAN[REQUIREMENT_FILE].replace("# SRS §3 — FR-01 — Resolution", "# SRS §3 — Resolution"),
    "docs/requirements/srs/fr-02-elsewhere.md": `# SRS §4 — FR-01 — Resolution\n\nRev: 1 · Actors: developer\n`,
  });
  const said = found.find((one) => one.rule === "R-01" && one.id === "FR-01");
  assert.ok(said, JSON.stringify(found, null, 1));
  assert.match(said.fix, /is defined in .*fr-02-elsewhere\.md and the file named for it is .*fr-01-resolution\.md/u);
});

test("R-01: two files named for one requirement are refused", () => {
  const found = problemsIn({ "docs/requirements/srs/fr-01-again.md": "# A second file for FR-01\n" });
  const said = found.find((one) => one.rule === "R-01" && one.id === "FR-01");
  assert.ok(said, JSON.stringify(found, null, 1));
  assert.match(said.fix, /is carried by .* and .*, and a requirement has one file/u);
});

test("R-02: an identifier the index lists and no file carries is refused", () => {
  const found = said({ [INDEX_FILE]: `${INDEX}| 4 | FR-02 Absent | [fr-02-absent.md](./fr-02-absent.md) |\n` });
  assert.ok(found.includes("R-02 FR-02"), found.join(" · "));
});

test("R-02: a file the index does not list is refused", () => {
  const found = said({ [INDEX_FILE]: INDEX.replace("FR-01 Resolution", "Resolution") });
  assert.ok(found.includes("R-02 FR-01"), found.join(" · "));
});

test("R-03: an identifier naming no clause is refused", () => {
  const found = said(replaced(REQUIREMENT_FILE, "Enforces: BR-01\n\n## Purpose", "Enforces: BR-99\n\n## Purpose"));
  assert.ok(found.includes("R-03 BR-99"), found.join(" · "));
});

test("R-03: a bare identifier in a field line is not a citation and is not refused", () => {
  assert.deepEqual(said({}).filter((one) => one.startsWith("R-03")), []);
});

test("R-03: a rule of the tree that the index defines no row for is refused", () => {
  const found = said(replaced(REQUIREMENT_FILE, "One source per setting.", "One source per setting (R-99)."));
  assert.ok(found.includes("R-03 R-99"), found.join(" · "));
  const held = problemsIn(replaced(REQUIREMENT_FILE, "One source per setting.", "One source per setting (R-01)."));
  assert.deepEqual(held.filter((one) => one.rule === "R-03"), [], "a rule the index does define resolves");
});

test("R-03: a citation carrying a line number is refused", () => {
  const found = said(replaced(REQUIREMENT_FILE, "Because a call needs an endpoint.",
    "Because a call needs an endpoint, as `plugin/src/cli.mjs:42` says."));
  assert.ok(found.some((one) => one.startsWith("R-03")), found.join(" · "));
});

test("R-06: a deviation mark naming neither an issue nor a decision is refused", () => {
  const found = said(replaced(REQUIREMENT_FILE, "One source per setting.", "One source per setting ▲."));
  assert.ok(found.includes("R-06 ▲"), found.join(" · "));
  const held = said(replaced(REQUIREMENT_FILE, "One source per setting.", "One source per setting ▲ ISS-19."));
  assert.deepEqual(held, [], "a mark that names its issue is not a finding");
});

test("R-07: a deferral marker inside a clause is refused", () => {
  const found = said(replaced(REQUIREMENT_FILE, "One source per setting.", "One source per setting, TBD."));
  assert.ok(found.includes("R-07 UC-01-1"), found.join(" · "));
});

test("R-07: an open item naming no issue is refused", () => {
  const found = said(replaced("docs/requirements/brd/08-open-items.md", "| ISS-13 |", "| |"));
  assert.ok(found.some((one) => one.startsWith("R-07")), found.join(" · "));
});

test("R-08: a use case with no criterion under it is refused", () => {
  const found = said(replaced(REQUIREMENT_FILE,
    "- **AC-01-1-1** · Rev: 1 · Proof: none yet — ISS-01\n  WHEN a setting is asked for THEN the CLI SHALL answer from one source.\n", ""));
  assert.ok(found.includes("R-08 UC-01-1"), found.join(" · "));
});

test("R-09: a business rule no clause enforces is refused", () => {
  const found = said(replaced("docs/requirements/brd/04-business-rules.md", "**BR-01**", "**BR-02**"));
  assert.ok(found.includes("R-09 BR-02"), found.join(" · "));
});

test("R-11: a criterion with no sentence under its field line is refused", () => {
  const found = said(replaced(REQUIREMENT_FILE,
    "\n  WHEN a setting is asked for THEN the CLI SHALL answer from one source.", ""));
  assert.ok(found.includes("R-11 AC-01-1-1"), found.join(" · "));
});

test("R-11: two sentences on consecutive lines under one field line are refused", () => {
  const found = problemsIn(replaced(REQUIREMENT_FILE, "answer from one source.",
    "answer from one source.\n  WHILE it answers the CLI SHALL name where the value came from."));
  const ears = found.filter((one) => one.rule === "R-11");
  assert.equal(ears.length, 1, JSON.stringify(found, null, 1));
  assert.match(ears[0].fix, /carries 2 sentences/u);
});

/* The case the clause reader cannot see: `parse.mjs` closes a criterion at the first blank line
   after its body, so the second sentence never reaches `clause.text` at all (ISS-27, consult a79f3c). */
test("R-11: a second sentence a blank line below the first is refused too", () => {
  const found = problemsIn(replaced(REQUIREMENT_FILE, "answer from one source.",
    "answer from one source.\n\n  WHILE it answers the CLI SHALL name where the value came from."));
  const ears = found.filter((one) => one.rule === "R-11");
  assert.equal(ears.length, 1, JSON.stringify(found, null, 1));
  assert.match(ears[0].fix, /carries 2 sentences/u);
});

test("R-11: WHEN with no THEN is refused", () => {
  const found = problemsIn(replaced(REQUIREMENT_FILE, "asked for THEN the CLI", "asked for, the CLI"));
  assert.deepEqual(found.map((one) => one.rule), ["R-11"], JSON.stringify(found, null, 1));
  assert.match(found[0].fix, /opens with WHEN and holds no THEN/u);
});

test("R-11: IF with no THEN is refused", () => {
  const found = problemsIn(replaced(REQUIREMENT_FILE,
    "WHEN a setting is asked for THEN the CLI", "IF a setting is asked for, the CLI"));
  assert.match(found.find((one) => one.rule === "R-11").fix, /opens with IF and holds no THEN/u);
});

test("R-11: a sentence with no SHALL is refused", () => {
  const found = problemsIn(replaced(REQUIREMENT_FILE, "THEN the CLI SHALL answer", "THEN the CLI answers"));
  assert.match(found.find((one) => one.rule === "R-11").fix, /holds no SHALL/u);
});

test("R-11: a sentence opening with none of the four forms is refused", () => {
  const found = problemsIn(replaced(REQUIREMENT_FILE, "WHEN a setting is asked for THEN the", "The"));
  assert.match(found.find((one) => one.rule === "R-11").fix, /opens with none of WHEN, IF, WHILE or WHERE/u);
});

test("R-12: an identifier two documents define is refused, and both files are named", () => {
  const found = problemsIn({ "docs/requirements/srs/fr-01-again.md": REQUIREMENT });
  const twice = found.find((one) => one.rule === "R-12" && one.id === "FR-01");
  assert.ok(twice, JSON.stringify(found, null, 1));
  assert.match(twice.fix, /fr-01-again\.md/u);
  assert.match(twice.fix, /fr-01-resolution\.md/u);
});

test("R-12: an identifier one document defines twice is refused", () => {
  const found = problemsIn(replaced(REQUIREMENT_FILE, "\n## Business rules enforced",
    "\n### UC-01-1 — A setting resolved again\n\nRev: 1 · Actors: developer\n\n"
    + "- **AC-01-1-9** · Rev: 1 · Proof: none yet — ISS-01\n"
    + "  WHEN it is asked twice THEN the CLI SHALL answer twice.\n\n## Business rules enforced"));
  const twice = found.find((one) => one.rule === "R-12" && one.id === "UC-01-1");
  assert.ok(twice, JSON.stringify(found, null, 1));
  assert.match(twice.fix, /defined twice in/u);
});

test("R-13: a requirement missing a declared section is refused", () => {
  const found = said(replaced(REQUIREMENT_FILE, "## Actors\n\n*Who acts here?*\n\nThe developer.\n\n", ""));
  assert.ok(found.includes("R-13 ## Actors"), found.join(" · "));
});

test("R-13: declared sections out of the declared order are refused", () => {
  const text = CLEAN[REQUIREMENT_FILE];
  const at = text.indexOf("## Business rules enforced");
  const found = said({ [REQUIREMENT_FILE]: `${text.slice(at)}\n${text.slice(0, at)}` });
  assert.ok(found.includes("R-13 ## Business rules enforced"), found.join(" · "));
});

test("R-13: the section a row marks as conditional may be absent, and passes where it is present", () => {
  assert.deepEqual(said({}).filter((one) => one.startsWith("R-13")), [], "no way back, no finding");
  const found = said(replaced(REQUIREMENT_FILE, "## Business rules enforced",
    "## The way back\n\n*What undoes a change here?*\n\nA revert.\n\n## Business rules enforced"));
  assert.deepEqual(found.filter((one) => one.startsWith("R-13")), [], "in its place, no finding");
});

test("R-14: a section heading with no question under it is refused", () => {
  const found = said(replaced(REQUIREMENT_FILE, "*Who acts here?*", "The people below."));
  assert.ok(found.includes("R-14 ## Actors"), found.join(" · "));
});

test("R-14: a question written in emphasis is a question", () => {
  assert.deepEqual(said({}).filter((one) => one.startsWith("R-14")), []);
});

test("R-15: a clause heading with no field line under it is refused", () => {
  const found = said(replaced(REQUIREMENT_FILE, "\nRev: 1 · Actors: developer · Enforces: BR-01\n", "\n"));
  assert.ok(found.includes("R-15 FR-01"), found.join(" · "));
});

/* A criterion is a list item and carries its field line on its own first line, so the heading
   reader above cannot see it: an EARS sentence with its machinery gone was green (consult 84e75c F3). */
test("R-15: a criterion whose own first line carries no Rev is refused, sentence or no sentence", () => {
  const found = problemsIn(replaced(REQUIREMENT_FILE,
    "- **AC-01-1-1** · Rev: 1 · Proof: none yet — ISS-01", "- **AC-01-1-1**"));
  assert.deepEqual(found.map((one) => `${one.rule} ${one.id}`), ["R-15 AC-01-1-1"], JSON.stringify(found, null, 1));
  assert.match(found[0].fix, /whose own first line does not carry/u);
});

test("R-15: a field line behind a proposal paragraph is a field line", () => {
  const found = said(replaced(REQUIREMENT_FILE, "\nRev: 1 · Actors: developer · Enforces: BR-01\n",
    "\n**Status: proposal for `forge spec`.** Nothing below is built,\nand the issue is named beside it.\n\nRev: 1 · Actors: developer · Enforces: BR-01\n"));
  assert.deepEqual(found.filter((one) => one.startsWith("R-15")), [], found.join(" · "));
});

test("a cell that names a clause rather than a heading declares no section list", () => {
  assert.equal(sectionsIn("one clause per `NFR-` identifier"), null);
  assert.equal(sectionsIn("one section per file, its own heading"), null);
  assert.deepEqual(sectionsIn("`Purpose` · `Notation`"),
    [{ name: "Purpose", optional: false }, { name: "Notation", optional: false }]);
});

/* A row whose placeholders were read literally would match the one file nobody wrote, and R-13
   would be green over every requirement in the tree. */
test("a document row's placeholders each stand for a segment of the path", () => {
  assert.ok(matches("srs/fr-NN-<slug>.md", "docs/requirements/srs/fr-01-resolution.md"));
  assert.ok(!matches("srs/fr-NN-<slug>.md", "docs/requirements/srs/README.md"));
  assert.ok(matches("srs/01-introduction.md", "docs/requirements/srs/01-introduction.md"));
  assert.ok(!matches("srs/01-introduction.md", "docs/requirements/brd/01-introduction.md.bak"));
});

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".md")) out.push(path);
  }
  return out;
};

/* A fixture proves the notation and never the tree: every rule above is answered by six documents
   somebody wrote for it, and this is the only case that reads the thirty-one that are real. */
test("this repository's own requirements tree breaks none of these rules", () => {
  const dir = join(ROOT, "docs", "requirements");
  const documents = walk(dir).map((path) => ({ file: relative(ROOT, path), text: readFileSync(path, "utf8") }));
  assert.ok(documents.length >= 20, `${documents.length} document(s) read; the walk found nothing`);
  const found = [...identifierProblems({ documents, index: clauseIndex(documents) }), ...shapeProblems(documents)];
  assert.deepEqual(found.map((one) => `${one.file}:${one.line} ${one.id} ${one.rule} ${one.fix}`), []);
});

test("the verb prints nothing and exits 0 where the project keeps no requirements tree", () => {
  const ran = execFileSync(FORGE, ["spec", "check"], { cwd: "/", encoding: "utf8" });
  assert.equal(ran, "");
});

test("the verb refuses an argument, because it reads the whole tree or nothing", () => {
  assert.throws(() => execFileSync(FORGE, ["spec", "check", "FR-01"], { cwd: ROOT, encoding: "utf8" }),
    /reads the whole tree and takes no argument/u);
});
