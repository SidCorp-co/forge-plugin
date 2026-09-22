/* What the kind table prints — the row per kind, the caps on it, and the paragraphs under a kind's
   own `-h`. The payload each kind writes and reads back is record.test.mjs's. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("record-rows-");
const { KINDS, USAGE, kindHelp, usage } = await import("../../../src/flow/record/record.mjs");
const { DISPLAY_ORDER } = await import("../../../src/flow/record/record-rows.mjs");
const { SHAPES } = await import("../../../src/flow/machine.mjs");
const { eachProblem } = await import("../../../src/flow/record/content.mjs");
const { CITED_IN, citationBlocks } = await import("../../../src/spec/checked.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ask = (...argv) => spawnSync(FORGE, argv, { encoding: "utf8", env: process.env });

test("every kind is on the usage line, and -h prints it without touching the tracker", () => {
  for (const kind of KINDS) assert.match(USAGE, new RegExp(`^  ${kind}\\b`, "mu"), kind);
  const run = ask("record", "-h");
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stdout.includes("Usage: forge record"), run.stdout);
  assert.doesNotMatch(run.stdout, /\(\d+\)/u, "the fields are each kind's own, so no cap is on this text");
  const note = ask("record", "note", "-h");
  assert.equal(note.status, 0, note.stderr);
  assert.match(note.stdout, /--user T\(500\)/u, "the cap on the kind's own row, with no endpoint saved to ask");
});

/* The list `forge record -h` prints is ordered by demand and not by the shape table, so it is
   checked against `KINDS` as a set: a kind added to one and not the other is either printed nowhere
   or printed twice. */
test("the list forge record -h prints is every kind, once each", () => {
  assert.deepEqual([...DISPLAY_ORDER].sort(), [...KINDS].sort());
});

/* AC-17-4-4: `criteria` and `plan` are written from their own dedicated help — Phase 3 sends a run
   straight to `forge record criteria -h` / `forge record plan -h` — so a caller composing one of
   those never comes back to this list to find it, and the rows most worth a quick scan lead it. */
test("criteria and plan are the last two kinds forge record -h lists", () => {
  const last = DISPLAY_ORDER.length - 1;
  assert.ok(DISPLAY_ORDER.indexOf("plan") >= last - 1, "plan is one of the last two rows");
  assert.ok(DISPLAY_ORDER.indexOf("criteria") >= last - 1, "criteria is one of the last two rows");
});

/* A note was drafted against a cap nobody had, refused, and rewritten — six sends for one note on
   ISS-525 (ISS-46). The row prints the cap it was handed, which is what a number of its own would
   fail on. */
test("the cap of a capped field is on its row, and a row with no cap read prints what it always did", () => {
  const caps = {
    releaseNotes: { self: null, halves: { userFacing: 40, technical: 41 } },
    acceptanceCriteria: { self: 42, halves: {} },
  };
  const shown = kindHelp("note", caps);
  assert.match(shown, /^ {2}note {9}--section S --user T\(40\) \[--technical T\(41\)\]/mu, "both halves of the note");
  assert.match(kindHelp("criteria", caps), /^ {2}criteria {5}<file\.md>\(42\) +numbered lines/mu, "and the criteria file");
  assert.match(shown, /^A number in parentheses after a value is that field's cap in code points/mu, "notation said once");
  assert.match(kindHelp("note"), /^ {2}note {9}--section S --user T \[--technical T\]/mu, "no cap read, and the row is untouched");
  assert.match(kindHelp("criteria"), /^ {2}criteria {5}<file\.md> +numbered lines/mu, "the description column holding where it was");
  assert.doesNotMatch(kindHelp("note"), /A number in parentheses/u, "and no notation to explain, so none is printed");
  assert.doesNotMatch(usage(), /\(4[01]\)|A number in parentheses/u,
    "and the text that lists the kinds carries no field of theirs, capped or not");
  assert.doesNotMatch(kindHelp("note"), /\(\d+\)|A number in parentheses/u, "and neither where none was read");
});

/* `record` answers its own help, so the dispatcher's route never sees the tail and `-h` after a kind
   was read as the issue reference: every kind refused for a flag, and four of them for a bad key,
   which is the one flag a refusal naming the missing flag could not answer for (ISS-208). */
test("naming a kind narrows -h to that kind's arguments rather than refusing for a flag", () => {
  for (const kind of KINDS) {
    const run = ask("record", kind, "-h");
    assert.equal(run.status, 0, `${kind}: ${run.stderr}`);
    assert.match(run.stdout, new RegExp(`^Usage: forge record ${kind}\\b`, "mu"), kind);
    assert.match(run.stdout, new RegExp(`^ {2}${kind}\\b`, "mu"), `${kind} is offered its own row`);
    assert.equal(run.stderr, "", `${kind} refuses nothing`);
  }
});

/* Both are read in the order they are typed, so both say which field leads the record (ISS-1699). */
test("what describes the confirmation puts the sentence before the path list, on either surface", () => {
  assert.match(ask("record", "confirmation", "-h").stdout,
    /^ {2}confirmation --is I --where W\.\.\. --finding F/mu, "the flag row, on the kind's own help");
  assert.match(ask("record", "-h").stdout,
    /^ {2}confirmation what the issue is, where you looked, and the finding$/mu,
    "and the one phrase the list of kinds carries");
});

test("the kind that opens a block carries what its one row cannot, and no other kind does", () => {
  const block = /^--criterion repeats/mu;
  assert.match(ask("record", "verdict", "-h").stdout, block);
  assert.doesNotMatch(ask("record", "confirmation", "-h").stdout, block);
});

/* One predicate over both field types showed `review` and `baseline` an --evidence their parse
   refuses, and `park`, `routed` and `finding` a --commit they have never had (ISS-835). Every kind
   is asked of its own shape, so a kind added tomorrow inherits no promise. */
test("a kind is shown the evidence vocabulary and the read sentence its own shape earns", () => {
  const VOCABULARY = /^Evidence is an attachment name on the issue/mu;
  const COMMIT = /^--commit is read off the merged mark's note/mu;
  const EVIDENCE = /^--evidence is read off what the latest record of this kind cited/mu;
  for (const kind of KINDS) {
    const shown = kindHelp(kind);
    const fields = SHAPES[kind]?.fields ?? [];
    const evidence = fields.find((one) => one.evidence);
    assert.equal(VOCABULARY.test(shown), Boolean(evidence), `${kind}: the vocabulary is the field's`);
    assert.equal(COMMIT.test(shown), fields.some((one) => one.commit), `${kind}: --commit is read for the kinds that take one`);
    const fills = Boolean(evidence && ((evidence.least ?? 1) >= 1 || evidence.owed));
    assert.equal(EVIDENCE.test(shown), fills, `${kind}: --evidence is read where the write fills it`);
    if (fills) {
      assert.equal(/and this record owes one\./u.test(shown), Boolean(evidence.owed),
        `${kind}: a fill made only where the record owes evidence says so`);
    }
    for (const second of fields.filter((one) => one.commit).slice(1)) {
      assert.doesNotMatch(shown, new RegExp(`--${second.flag} is read off`, "u"),
        `${kind}: the fill reads the first commit-typed field, so no other is promised one`);
    }
  }
  assert.doesNotMatch(kindHelp("review"), /evidence/iu, "the kind taking a commit and no evidence is told nothing of it");
  assert.doesNotMatch(kindHelp("park"), /--commit/u, "and the kind citing evidence and no commit hears of no --commit");
});

/* `[--contains C]` beside `--where W` reads as a slot for prose and the row's letters cannot say
   otherwise: the fill's sentence describes the first commit-typed field and said nothing of any
   other, so what `--contains` takes reached a caller only in a refusal for guessing (ISS-833). */
test("a commit-typed field the fill does not read is told what it takes", () => {
  for (const kind of KINDS) {
    const shown = kindHelp(kind);
    const commits = (SHAPES[kind]?.fields ?? []).filter((one) => one.commit);
    for (const field of commits.slice(1)) {
      assert.match(shown, new RegExp(`^--${field.flag} takes .+ as 7 to 40 hex digits\\.$`, "mu"),
        `${kind}: --${field.flag} is described, the fill promising it nothing`);
    }
    if (commits.length) {
      assert.doesNotMatch(shown, new RegExp(`^--${commits[0].flag} takes `, "mu"),
        `${kind}: the field the fill does read is described by the sentence saying so`);
    }
  }
  assert.match(kindHelp("verification"),
    /^--contains takes the landed commit the head on --commit carries as 7 to 40 hex digits\.$/mu,
    "and the words are the field's own label, so a new one of them needs no edit here");
});

/* A closed set of values reaches the caller off the field — `--verdict pass|fail|skipped|short` is
   the shape's own `oneOf` printed — and a form a predicate refuses reached nobody: `record review`
   turned back `f5b24b F3 accepted in part` naming the three forms it takes, and `record review -h`
   named none of them, so the grammar cost a composed write to learn (ISS-457). */
test("a field its own rule refuses is told in its kind's help what it takes, and one with none is told nothing", () => {
  let told = 0;
  for (const kind of KINDS) {
    const shown = kindHelp(kind);
    const forms = (SHAPES[kind]?.fields ?? []).filter((one) => one.form);
    for (const field of forms) {
      assert.match(shown, new RegExp(`^--${field.flag} takes .`, "mu"),
        `${kind}: --${field.flag} is refused for its form and its help says nothing of it`);
      assert.ok(shown.includes(`--${field.flag} takes ${field.form}.`),
        `${kind}: --${field.flag} is described in words its refusal does not use`);
      told += 1;
    }
    /* Commit-typed fields are told what they take by the sentence above, and are not this line. */
    for (const field of (SHAPES[kind]?.fields ?? []).filter((one) => !one.form && !one.commit)) {
      assert.doesNotMatch(shown, new RegExp(`^--${field.flag} takes [^\\n]+\\.$`, "mu"),
        `${kind}: --${field.flag} is refused for no form and its help states one anyway`);
    }
  }
  assert.equal(told, 3, "and the fields carrying a form are the ones the shapes declare");
});

/* The form and the refusal are one string or they are two copies, and the second is the one nobody
   corrects: `--decision` was spelt in the usage row and refused against a list beside it. */
test("every field carrying a rule over its values declares the form that rule refuses against", () => {
  const undeclared = [];
  const unquoted = [];
  for (const kind of KINDS) {
    for (const field of (SHAPES[kind]?.fields ?? []).filter((one) => one.each)) {
      if (!field.form) undeclared.push(`${kind} --${field.flag}`);
    }
  }
  for (const [kind, flag, bad] of [["confirmation", "where", "in the code"],
    ["decision", "decision", "one part only"], ["review", "finding", "looks fine"]]) {
    const field = SHAPES[kind].fields.find((one) => one.flag === flag);
    const said = eachProblem(field, [bad]) ?? "";
    if (!said.includes(field.form)) unquoted.push(`${kind} --${flag} refused \`${bad}\` with: ${said}`);
  }
  assert.deepEqual(undeclared, [], "a field refused value by value says what a value has to be");
  assert.deepEqual(unquoted, [], "and the refusal quotes the form its kind's help prints");
});

test("a kind -h answers for the kind alone, and a name that is no kind still refuses", () => {
  const one = ask("record", "park", "-h").stdout;
  assert.match(one, /^ {2}park\b.*--kind K/mu, "the kind asked about is answered");
  assert.doesNotMatch(one, /^ {2}verdict\b/mu, "one kind's help is not the whole table");
  const bad = ask("record", "nosuchkind", "-h");
  assert.equal(bad.status, 1, bad.stdout);
  assert.match(bad.stderr, /record knows no kind `nosuchkind`/u);
});

/* The demand the `approved` check makes was written in its refusal and on no surface a run reads
   before the file, so adding the citation moved text a consult had read and cost a second one (ISS-516). */
test("both file kinds print the citation demand, and only where the project keeps a tree", () => {
  for (const kind of ["criteria", "plan"]) {
    const kept = kindHelp(kind, {}, null, citationBlocks(true));
    assert.match(kept, /A criterion carries one by\nopening with `<id>~<rev>:`/u, `${kind} names the form`);
    assert.ok(kept.includes(CITED_IN), `${kind} names the fields a citation may sit in: ${CITED_IN}`);
    assert.match(kept, /a citation added afterwards is a second consult/u, `${kind} says what the refusal costs`);
    const none = kindHelp(kind, {}, null, citationBlocks(false));
    assert.doesNotMatch(none, /<id>~<rev>|requirements tree/u, `${kind} asks a project keeping no tree for nothing`);
  }
});
