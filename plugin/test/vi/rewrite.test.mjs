/* A project whose `.forge.json` names a prose language has every comment body and every prose field
   rewritten on the way out, and a rewrite renames prose: eight verdicts and a verification earned
   nothing on one such project, and its owed list named a criterion `NaN`. So every kind is written,
   put through the rewrite, and read back here. */
import assert from "node:assert/strict";
import test from "node:test";
import { tempRoom, typedPlan } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("rewrite-");
const { protectInline, restoreInline, segment } = await import("../../vi-natural/format/doc.mjs");
const { sayStored } = await import("../../src/flow/record/record.mjs");
const { assemble, parse, render } = await import("../../src/flow/record/page.mjs");
/* The comparators moved to the field writer with the write they belong to (ISS-346). */
const { landedAs, noteLandedAs } = await import("../../src/tracker/field-write.mjs");
const { SHAPES } = await import("../../src/flow/machine.mjs");
const {
  PLAN_SECTIONS, planFlags, planSections, planSteps, protectMachine, restoreMachine, sectionsOwed,
} = await import("../../src/flow/machine.mjs");
const { CHECKS, ORDER, judgedOwed, viewFrom } = await import("../../src/flow/earned.mjs");

/* What the real call does, measured by putting a rendered record, a plan and a criteria list through
   `vi-natural doc --register san-pham --no-glossary`, which is the call the write boundary makes: a
   bullet's label is renamed and its value left, a list number is kept, an inline code span and a
   fenced block come back byte for byte. The stand-in below is those four rules and nothing else, so
   the sweep is judged against what the pipeline does rather than against a guess. */
const VI = "bản dịch của khối này";
const LABEL = /^(\s*- \*\*)([^*]+)(:\*\* )(.*)$/u;
const NUMBER = /^(\s*(?:\d+\.\s+)?)(.*)$/u;

const viLine = (line) => {
  const labelled = LABEL.exec(line);
  if (labelled) return `${labelled[1]}${VI}${labelled[3]}${labelled[4]}`;
  const [, head, rest] = NUMBER.exec(line);
  const said = rest.split(/(⟦VI\d+⟧)/u).map((part) => (/\p{L}/u.test(part) && !part.startsWith("⟦") ? VI : part));
  return `${head}${said.join("")}`;
};

const viBlock = (block) => {
  const slots = [];
  return restoreInline(protectInline(block, slots).split("\n").map(viLine).join("\n"), slots);
};

/* The real segmentation, so what counts as prose is the pipeline's answer and not this file's. */
const rewritten = (text) => segment(text).map(([kind, block]) => (kind === "text" ? viBlock(block) : block)).join("");

/* The write boundary whole, in the order `plugin/src/tools/vi.mjs` runs it: hold the declarations,
   rewrite the prose, hand them back. Reading a plan that had only been protected would judge text
   this CLI never posts. */
const throughVi = (text) => {
  const marks = {};
  return restoreMachine(rewritten(protectMachine("plan", text, marks)), marks);
};

let clock = 0;
const at = () => `2026-09-03T11:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const posted = (kind, fields, status = null) =>
  ({ createdAt: at(), authorId: "agent", body: rewritten(render(kind, fields, status)) });

const FIELDS = {
  confirmation: { where: ["plugin/src/flow/record/record.mjs:246", "plugin/src/flow/earned.mjs:96"], is: "the reader keys on a label", finding: "holds", detail: "one detail" },
  decision: { decision: ["a reading | an assumption | the undo"], none: undefined },
  question: { reading: ["one reading -> one outcome", "another -> another"], to: "the reporter" },
  park: { kind: "blocked", why: "ISS-9 first", evidence: [] },
  correction: { moved: "the plan names a second file", why: "the ship path needs it" },
  baseline: { gate: "npm run check", result: "one known failure", commit: "117978d" },
  verdict: { criterion: "1 — the first outcome", verdict: "pass", commit: "117978d", evidence: ["run.txt"], why: "the check is green" },
  review: { reviewer: "codex", commit: "117978d", outcome: "approved", finding: ["F1 accepted"] },
  finding: { expected: "the list sorted", seen: "sorted by id", evidence: ["run.txt"], quoted: "I cannot find it" },
  triage: { outcome: "not-met", "would-have-caught": "a verdict on the order" },
  routed: { what: "the gate reads a stale mtime", to: "ISS-80, filed", evidence: [], none: undefined },
  gap: { where: "references/plan.md", lacked: "the three declaration lines it owes", did: "read them off the contract", none: undefined },
  verification: { where: "the installed copy", commit: "117978d", evidence: ["run.txt"] },
};

test("every kind's payload survives the rewrite byte for byte, and reads back under its flags", () => {
  for (const [kind, fields] of Object.entries(FIELDS)) {
    const body = render(kind, fields, SHAPES[kind].stamp ? "in_progress" : null);
    const after = rewritten(body);
    const block = /```forge-record\n[\s\S]*?\n```/u;
    assert.match(after, block, kind);
    assert.equal(block.exec(after)[0], block.exec(body)[0], `${kind}: the payload block is rewritten`);
    assert.notEqual(after, body, `${kind}: nothing about this document was rewritten, so it proves nothing`);
    const read = parse(after);
    assert.equal(read.rewritten, false, kind);
    for (const field of SHAPES[kind].fields) {
      const held = fields[field.flag];
      if (held === undefined || (Array.isArray(held) && !held.length)) continue;
      assert.deepEqual(read.fields[field.flag], held, `${kind} --${field.flag}`);
    }
  }
  assert.deepEqual(Object.keys(FIELDS).sort(), Object.keys(SHAPES).sort(), "every shaped kind is swept");
});

test("a status is earned from records that came back through the rewrite, with nothing owed", () => {
  const plan = throughVi(typedPlan());
  const criteria = rewritten("1. The first outcome.\n2. The second outcome.");
  assert.deepEqual(planFlags(plan), { screen: "no", schema: "no", deploy: null, look: null }, "the declarations are read through it");
  assert.match(criteria, /^1\. /mu, "and a criterion keeps the number a verdict names");
  const verdict = (number) => posted("verdict", { ...FIELDS.verdict, criterion: `${number} — an outcome` });
  const issue = {
    plan: plan,
    acceptanceCriteria: criteria,
    mergedAt: "2026-09-03T11:30:00.000Z",
    releaseNotes: { section: "Fixed", userFacing: "You see it now." },
    attachments: [{ name: "run.txt" }],
    /* The branch `in_progress` owes, which no rewrite touches: the field is the lease's, not prose. */
    sessionContext: { worklog: { branch: "iss-67-the-work" } },
  };
  const comments = [
    posted("confirmation", FIELDS.confirmation),
    posted("decision", FIELDS.decision),
    posted("baseline", FIELDS.baseline),
    posted("review", FIELDS.review),
    { createdAt: at(), authorId: "agent", body: "mark_merged target=base — merged to master at 117978d" },
    verdict(1),
    verdict(2),
    posted("verification", FIELDS.verification),
  ];
  const view = viewFrom("the-uuid", issue, comments);
  for (const status of ORDER.slice(1)) {
    assert.deepEqual(CHECKS[status](view, "ISS-67").map((one) => one.what), [], `${status} is not earned`);
  }
});

/* The whole of the defect in one body: this is what the tracker returned for a confirmation the
   verb had just written, and the labels the reader keyed on are gone. */
const REWRITTEN_RECORD = "## Xác nhận\n\n"
  + "- **Đã kiểm tra tại:** plugin/src/flow/record/record.mjs:246\n"
  + "- **Cách hoạt động:** reader dùng nhãn đã render làm khóa\n"
  + "- **Kết luận:** đúng\n\n"
  + "`forge-record: confirmation · contract 1`";

test("a record whose keys were rewritten is named as rewritten, and never as fields it lacks", () => {
  const read = parse(REWRITTEN_RECORD);
  assert.equal(read.kind, "confirmation", "the tag is a code span, so it survives and the kind is known");
  assert.deepEqual(read.fields, {}, "and not one key of the shape reads back");
  assert.ok(read.rewritten);
  const view = viewFrom("the-uuid", {}, [{ createdAt: at(), authorId: "agent", body: REWRITTEN_RECORD }]);
  const owed = CHECKS.confirmed(view, "ISS-67");
  assert.equal(owed.length, 1);
  assert.match(owed[0].what, /was rewritten by the project's prose pipeline/u);
  assert.doesNotMatch(owed[0].what, /it lacks/u, "the write supplied them; a list of flags sends the author back");
  assert.match(owed[0].command, /^forge record confirmation ISS-67 /u);
});

test("a bullet-form record this build did not write still reads back under its flags", () => {
  const older = "## Baseline\n\n- **Gate:** npm run check\n- **Result:** one known failure; and a second\n"
    + "- **Commit:** 117978d\n\n`forge-record: baseline · contract 1`";
  assert.deepEqual(parse(older), {
    kind: "baseline",
    contract: 1,
    rewritten: false,
    fields: { gate: "npm run check", result: "one known failure; and a second", commit: "117978d" },
  });
  const park = "## Park\n\n- **Kind:** blocked\n- **Why:** ISS-9 first\n- **Status left:** in_progress\n\n"
    + "`forge-record: park · contract 1`";
  assert.equal(parse(park).fields.left, "in_progress", "the stamp's label resolves to its key too");
});

test("no owed item is keyed by anything but a criterion's number, so none can name NaN", () => {
  const criteria = [{ number: 1, text: "a" }, { number: 2, text: "b" }];
  const unkeyed = [
    { createdAt: at(), authorId: "agent", body: REWRITTEN_RECORD.replace("confirmation", "verdict") },
    { createdAt: at(), authorId: "agent", body: "## Verdict\n\n```forge-record\nverdict: pass\n```\n\n`forge-record: verdict · contract 1`" },
    posted("verdict", { ...FIELDS.verdict, criterion: "1 — a" }),
  ];
  const { verdicts, owed, unreadable } = assemble(unkeyed, criteria);
  assert.deepEqual([...verdicts.keys()], [1], "a verdict with no readable criterion keys nothing");
  assert.deepEqual(owed, [2], "and the criterion nobody judged is still owed under its own number");
  assert.equal(unreadable.length, 2);
  const view = viewFrom("the-uuid", { acceptanceCriteria: "1. a\n2. b", attachments: [{ name: "run.txt" }] }, unkeyed);
  const said = judgedOwed(view, "ISS-67").map((one) => `${one.what} ${one.command}`).join("\n");
  assert.doesNotMatch(said, /NaN/u, said);
  assert.match(said, /criterion 2 has no verdict/u);
  assert.equal(said.match(/names no criterion this build can read/gu)?.length, 2);
});

test("a value carries what the old separator, a newline and a fence marker would have broken", () => {
  const one = render("correction", { moved: "a; b", why: "first line\nsecond line\n\nfourth" });
  assert.deepEqual(parse(one).fields, { moved: "a; b", why: "first line\nsecond line\n\nfourth" });
  const held = render("review", { reviewer: "codex", commit: "117978d", outcome: "approved", finding: ["F1 rejected: it read ```forge-record``` as a record"] });
  assert.match(held, /^````forge-record$/mu, "the fence outruns the run inside it");
  assert.deepEqual(parse(held).fields.finding, ["F1 rejected: it read ```forge-record``` as a record"]);
  assert.deepEqual(parse(rewritten(held)).fields.finding, ["F1 rejected: it read ```forge-record``` as a record"]);
});

/* Two rounds of review, both on this seam: a value is only ever split where something joined it,
   and the protector has to reach every form the reader accepts or the plan declares nothing. */
test("a fenced value holding the old separator is one value, and a labelled one is still split", () => {
  const one = render("decision", { decision: ["keep A; remove B", "the second reading"] });
  assert.deepEqual(parse(one).fields.decision, ["keep A; remove B", "the second reading"]);
  assert.deepEqual(parse(rewritten(one)).fields.decision, ["keep A; remove B", "the second reading"]);
  const older = "## Decision record\n\n- **Decision:** keep A; the second reading\n\n`forge-record: decision · contract 1`";
  assert.deepEqual(parse(older).fields.decision, ["keep A", "the second reading"]);
});

test("the protector holds every declaration the reader accepts, once, wherever it sits in the plan", () => {
  const inline = "Screen change: no. Schema coupling: no.\n\nThe plan itself.";
  const marks = {};
  const held = protectMachine("plan", inline, marks);
  assert.deepEqual(marks.texts, ["Screen change: no", "Schema coupling: no"], "two on one line, with periods");
  assert.equal(protectMachine("plan", held), held, "a marked declaration is not marked twice");
  assert.equal(restoreMachine(held, marks), inline, "and the restore hands back what the author wrote");
  assert.deepEqual(planFlags(throughVi(inline)), { screen: "no", schema: "no", deploy: null, look: null });
  const spread = "- Screen change: yes\nDecision: schema coupling: yes\nUser-facing outcome: no";
  assert.deepEqual(planFlags(throughVi(spread)), { screen: "yes", schema: "yes", deploy: null, look: "no" });
  assert.deepEqual(planFlags(rewritten(spread)), { screen: null, schema: null, deploy: null, look: null }, "and unprotected it declares nothing");
  const split = "Screen change:\n  yes\n\nSchema coupling: no.";
  const held2 = {};
  assert.equal(restoreMachine(protectMachine("plan", split, held2), held2), split,
    "a value on the next line is held too, and comes back spaced as it was written");
  assert.deepEqual(planFlags(throughVi(split)), { screen: "yes", schema: "no", deploy: null, look: null });
  const inside = "`Decision: screen change: yes because the migration lands first`";
  assert.equal(protectMachine("plan", inside), inside, "one already inside a span is left whole");
  assert.equal(planFlags(throughVi(inside)).screen, null, "and quoted is named, not declared (ISS-488)");
  assert.doesNotMatch(throughVi(inline), /forge-machine/u, "no mark of the protector's survives the boundary");
  const quoting = "Screen change: no.\n\nThe mark is written `forge-machine-0` and means nothing here.";
  const named = {};
  assert.equal(restoreMachine(protectMachine("plan", quoting, named), named), quoting,
    "a plan quoting the mark keeps its quotation: the protector names its own away from the text");
});

/* A section name is prose, and prose is what the boundary renames. Unheld, `approved` would refuse
   every plan on a project with a prose language — so the heading and the step's criterion cross by
   the mechanism the declarations cross by, and are read off the stored field on the other side. */
test("a plan's sections and its steps' criteria cross the boundary byte for byte", () => {
  const plan = typedPlan({ Steps: "1. The one step — criteria 1, 2\n2. The next one, criteria: 3\n3. The wrapped one, criteria:\n   4, 5" });
  const marks = {};
  const held = protectMachine("plan", plan, marks);
  assert.deepEqual(marks.texts.filter((one) => one.startsWith("#")), PLAN_SECTIONS.slice(0, -1).map((one) => `## ${one.name}`),
    "every heading the table names, in the order the plan writes them");
  assert.deepEqual(marks.texts.filter((one) => /^criteri/iu.test(one)), ["criteria 1, 2", "criteria: 3", "criteria:\n   4, 5"],
    "and each step's citation, in either spelling and wrapped: a break the step reader reads across is one this holds");
  assert.equal(restoreMachine(held, marks), plan, "the restore hands back what the author wrote");
  const back = throughVi(plan);
  assert.deepEqual([...planSections(back).keys()], PLAN_SECTIONS.slice(0, -1).map((one) => one.name));
  assert.deepEqual(planSteps(back).map((one) => one.cites), [[1, 2], [3], [4, 5]]);
  assert.deepEqual(planSteps(plan).map((one) => one.cites), planSteps(back).map((one) => one.cites),
    "the same sets the plan was written with, so nothing the rewrite touched changed what a step serves");
  assert.deepEqual(sectionsOwed(back, planFlags(back)), [], "so a plan stored on such a project owes nothing");
  assert.deepEqual(planSections(rewritten(plan)).size, 0, "and unprotected it carries no section at all");
  /* Both draw the line where markdown draws it, or one holds what the other drops. */
  const tight = "##Before\n\n## Steps\n\n1. one — criteria 1";
  const drawn = {};
  protectMachine("plan", tight, drawn);
  assert.deepEqual(drawn.texts, ["## Steps", "criteria 1"], "`##Before` is no heading, so the protector holds no such line");
  assert.deepEqual([...planSections(tight).keys()], ["Steps"], "and the section reader opens none for it");
});

test("a field's read-back is compared with the copy the boundary sent, not the source it was handed", () => {
  const source = "1. The first outcome.";
  const sent = rewritten(source);
  assert.notEqual(sent, source, "a rewrite that changed nothing proves nothing");
  assert.ok(landedAs(sent, sent), "what came back is what went out");
  assert.ok(!landedAs(sent, source), "and comparing the source refuses every write that landed");
});

test("a record verb says what the stored copy will be, wherever a prose language is set", () => {
  assert.equal(sayStored("record", null), null, "a project with none is told nothing");
  assert.match(sayStored("record", "vi"), /^prose vi: the payload block is stored as written/u);
  assert.match(sayStored("criteria", "vi"), /^prose vi: the criteria are rewritten/u);
  assert.match(sayStored("note", "vi"), /^prose vi: the user-facing half is rewritten/u);
});

/* The note is the one prose field that is an object, and the comparator that reads it back closed
   over the copy the caller wrote: the moment the layer reached the user-facing half every note
   write on a prose-vi project would land and then be refused (ISS-288). */
test("a release note reads back half by half against the copy that went out", () => {
  const wrote = { section: "Fixed", userFacing: "You see it now.", technical: "One entry in PROSE_FIELDS." };
  const sent = { ...wrote, userFacing: rewritten(wrote.userFacing) };
  assert.notEqual(sent.userFacing, wrote.userFacing, "a rewrite that changed nothing proves nothing");
  assert.ok(noteLandedAs(sent, sent), "what came back is what went out");
  assert.ok(!noteLandedAs(sent, wrote), "and comparing the source refuses every note that landed");
  assert.ok(!noteLandedAs({ ...sent, technical: null }, sent), "a half that arrived empty is not a landing");
  const skipped = { section: "Skip", userFacing: "Nothing a reporter sees changed.", technical: null };
  assert.ok(noteLandedAs(skipped, skipped), "and an absent technical half compares as the null it was sent as");
});
