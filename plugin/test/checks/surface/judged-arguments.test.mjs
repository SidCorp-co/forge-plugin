/* A checker whose selector matches nothing looks exactly like a clean repository, and this rule's
   population is derived from three tables at once — so the walk's own reach is asserted here before
   anything is asserted about the tree. The mutation cases are the ones that would go green if the
   checker were deleted: each takes a judge this CLI spends today and breaks it one way (ISS-936). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DISPATCHES,
  JUDGE,
  JUDGES,
  blockFor,
  declaredSlots,
  masked,
  problems,
  slotsIn,
  sourceFor,
  surfaceSlots,
} from "../../../src/checks/surface/judged-arguments.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;
const TABLE = join(ROOT, "plugin/src/commands.mjs");
const keyed = (slots) => slots.map((one) => `${one.verb}.${one.name}`);

/* The one judge every unexempted slot answers to, spelled out so a rename of it turns this red. */
const STATUS_JUDGE = `${JUDGE}("issue", "status", filters.status,\n`
  + `        { values: declaredFor("forge_issues", "status"), hint: STATUSES_SEEN });`;

/* The whole surface, read off `forge -h`'s own rows by hand rather than off the walk being checked:
   a lower bound leaves a dropped slot green, and a dropped slot is a rule that stopped reaching an
   argument. A flag added to a row belongs here, which is the point — it is what classifies it. */
const SURFACE = {
  issue: ["status", "search", "limit", "fields", "set", "why", "blocks", "relates", "unlink",
    "statusNot", "priority", "category", "complexity", "createdAfter", "createdBefore", "updatedAfter"],
  new: ["title", "category", "status", "priority", "complexity", "with"],
  comment: ["title"],
  claim: ["minutes", "next", "open", "reconciled"],
  spec: [],
  attach: [],
  next: ["count", "graph", "holding", "checkout"],
  /* No row of its own for a subject-taking verb: `record`, `advance` and `resume` end theirs in
     `[...]`, and their arguments are their own help's, which this walk does not read. */
  guide: ["for"],
  project: ["name", "slug", "set"],
  knowledge: [],
  cloudflare: [],
  codex: [],
  chatgpt: ["resume", "model", "file", "save"],
  hooks: ["hook", "last", "off", "on", "how"],
  feedback: ["title", "kind", "with"],
  doctor: ["token", "url", "chatgpt-url", "chatgpt-key", "hide", "show", "ship", "runs", "set",
    "refresh", "confirm", "line", "title", "confidence", "meta"],
  stats: [],
  resume: [],
  record: [],
  advance: [],
};

test("the walk reads the whole surface, and exactly it", () => {
  const expected = Object.entries(SURFACE)
    .flatMap(([verb, flags]) => flags.map((name) => `${verb}.${name}`)).sort();
  assert.deepEqual(keyed(surfaceSlots()).sort(), expected);
  /* On no usage row: the list path turns each declared filter into a flag of its own. */
  assert.ok(expected.includes("issue.statusNot"), "the filters one verb adds are not in the walk");
});

test("a boolean flag is no slot, and a flag carrying a value is", () => {
  const read = slotsIn("[--full] [--status s] [--why] [--limit n]");
  assert.deepEqual(read, ["status", "limit"]);
});

test("the slots this rule reaches are the ones whose values are already written down here", () => {
  const held = keyed(declaredSlots());
  for (const one of ["issue.status", "issue.statusNot", "issue.priority", "issue.category",
    "issue.complexity", "new.status", "new.category", "new.complexity", "new.priority"]) {
    assert.ok(held.includes(one), `${one} takes a declared set and the walk does not hold it`);
  }
  assert.ok(!held.includes("issue.search"), "a free-text slot declares no set and is not this rule's");
});

test("two verbs of one file are two blocks, so one verb's judge does not answer for the other", () => {
  const text = readFileSync(TABLE, "utf8");
  const issue = blockFor(text, "issue");
  assert.ok(issue.includes(STATUS_JUDGE), "the issue block does not hold the judge it spends");
  assert.ok(!issue.includes(JUDGES["new.category"].call), "the issue block reached into the next verb");
  assert.ok(blockFor(text, "new").includes(JUDGES["new.category"].call));
});

test("this repository judges every argument whose values it declares", () => {
  assert.deepEqual(problems(sourceFor(ROOT)), []);
});

/* The four ways a judge can be there and answer for nothing. Each mutates the real command table,
   because a fixture proves the checker reads a shape and not that it reads this repository. */
const mutated = (change) => {
  const text = change(readFileSync(TABLE, "utf8"));
  assert.notEqual(text, readFileSync(TABLE, "utf8"), "the mutation matched nothing, so it proves nothing");
  return problems((verb) => (["issue", "new"].includes(verb) ? text : sourceFor(ROOT)(verb)));
};

const about = (found, slot) => found.filter((one) => one.startsWith(`forge ${slot} `));

test("the judge taken out of the verbs that spend it is a finding for every slot it answered for", () => {
  const found = mutated((text) => text.replaceAll(`${JUDGE}(`, "judgedSomehow("));
  assert.equal(found.length, 6, found.join("\n"));
  const [said] = about(found, "issue --status");
  assert.match(said, /no call of `refuseUndeclared` appears where this verb reads its arguments/u);
  assert.match(said, /17 value\(s\) this CLI declares at plugin\/src\/tracker\/routes\.mjs/u,
    "the finding names neither the size of the set nor where it is written down");
  assert.match(said, /Judge it before the call: `refuseUndeclared`/u, "the finding names no action");
});

test("a judge kept and handed another argument's value is the finding", () => {
  const found = mutated((text) => text.replace(STATUS_JUDGE, STATUS_JUDGE.replace("filters.status", "argv[0]")));
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(about(found, "issue --status")[0], /is the value handed to none of them/u);
});

test("a judge kept and reached only after the call is spent is the finding", () => {
  const found = mutated((text) =>
    text.replace(STATUS_JUDGE, `await scoped("forge_issues", { action: "list" });\n      ${STATUS_JUDGE}`));
  /* One dispatch moved ahead of the judges puts every one of that verb's slots behind it. */
  assert.equal(found.length, 5, found.join("\n"));
  assert.match(about(found, "issue --status")[0], /after the call is spent/u);
});

test("a judge handed the right value and another slot's set is the finding", () => {
  const found = mutated((text) =>
    text.replace(STATUS_JUDGE, STATUS_JUDGE.replace('declaredFor("forge_issues", "status")', "KIND_NAMES")));
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(about(found, "issue --status")[0], /judged against some other slot's set/u);
});

test("the set is the expression `values` is given, not a spelling of it in a comment", () => {
  const found = mutated((text) => text.replace(STATUS_JUDGE, STATUS_JUDGE.replace(
    'values: declaredFor("forge_issues", "status")',
    'values: [] /* declaredFor("forge_issues", "status") */')));
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(about(found, "issue --status")[0], /judged against some other slot's set/u);
});

/* The three the reviewer of this change asked for: each keeps the judge's name, its value, its set
   and its position, and each leaves the caller's status unjudged. */
test("a judge commented out is no judge, whichever comment carries it", () => {
  for (const wrap of [(one) => `/* ${one} */`, (one) => `// ${one}`]) {
    const found = mutated((text) => text.replace(STATUS_JUDGE, wrap(STATUS_JUDGE.replace(/\n\s+/u, " "))));
    assert.equal(found.length, 1, found.join("\n"));
    assert.match(about(found, "issue --status")[0], /is the value handed to none of them/u,
      "the commented-out call was read as one that judges the status");
  }
  /* And with every one of them commented out there is no call of the judge at all. */
  const gone = mutated((text) => text.replaceAll(`      ${JUDGE}(`, `      // ${JUDGE}(`));
  assert.match(about(gone, "issue --status")[0], /no call of `refuseUndeclared` appears/u);
});

test("a judge whose value slot is undefined is no judge, wherever the value is mentioned", () => {
  const found = mutated((text) => text.replace(STATUS_JUDGE,
    `${JUDGE}("issue", "status", undefined,\n`
    + '        { values: declaredFor("forge_issues", "status"), hint: `${filters.status}` });'));
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(about(found, "issue --status")[0], /is the value handed to none of them/u);
});

test("a judge reached only on some paths is the finding, whatever its source position", () => {
  const found = mutated((text) =>
    text.replace(STATUS_JUDGE, `if (filters.search) {\n        ${STATUS_JUDGE}\n      }`));
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(about(found, "issue --status")[0], /not as a statement of the block the call is spent in/u);
});

/* A hole is code and its braces are not the statement's, so the pair below has to come out one way
   each: the early dispatch is late for every judge, and the same dispatch after them is no finding. */
const TEMPLATED = 'const sent = `"${await everyIssue(filters)}"`;';

test("a dispatch inside a template hole, quotes and all, is a dispatch the judges come after", () => {
  const found = mutated((text) => text.replace(`      ${JUDGE}("issue", "status"`,
    `      ${TEMPLATED}\n      ${JUDGE}("issue", "status"`));
  assert.equal(found.length, 5, found.join("\n"));
  assert.match(about(found, "issue --status")[0], /after the call is spent/u);
});

test("the same dispatch written after the judges is no finding", () => {
  const found = mutated((text) => text.replace("      return printIssues(",
    `      ${TEMPLATED}\n      return printIssues(`));
  assert.deepEqual(found, [], "a template hole after the judges was read as one they come after");
});

test("a judge under a braceless conditional is the finding, though its depth matches", () => {
  const found = mutated((text) =>
    text.replace(STATUS_JUDGE, `if (filters.search)\n        ${STATUS_JUDGE}`));
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(about(found, "issue --status")[0], /not as a statement of the block the call is spent in/u);
});

test("a slash in a second template hole is read afresh, not off what the first hole ended on", () => {
  const held = "const sent = `${filters.search}${/}/u.test(filters.search) && await everyIssue(filters)}`;";
  const found = mutated((text) => text.replace(`      ${JUDGE}("issue", "status"`,
    `      ${held}\n      ${JUDGE}("issue", "status"`));
  assert.equal(found.length, 5, found.join("\n"));
  assert.match(about(found, "issue --status")[0], /after the call is spent/u);
});

test("a second `values` on the options object is the shape JavaScript takes, so it is no shape at all", () => {
  const found = mutated((text) => text.replace(STATUS_JUDGE,
    STATUS_JUDGE.replace("hint: STATUSES_SEEN", "hint: STATUSES_SEEN, values: []")));
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(about(found, "issue --status")[0], /judged against some other slot's set/u);
});

test("a guard that no longer turns the value away leaves its helper composing a sentence", () => {
  for (const [key, row] of Object.entries(JUDGES).filter(([, one]) => one.guard)) {
    const name = key.split(".")[1];
    const found = mutated((text) => text.replaceAll(row.guard, row.guard.replace("!", "")));
    assert.match(about(found, `new --${name}`)[0] ?? "", /the judgement is that whole statement/u,
      `${key}: the guard was reversed and its judge still counted`);
  }
});

/* A narrowing reads as the row does term for term and judges fewer calls than the row says, which is
   why the row is the whole statement and not the part of it a scan can find. Both shapes of row are
   narrowed here: the condition a composing call sits inside, and the statement that acts on an
   answering call's value. */
test("a further term on the judgement judges fewer values than the row says, and is the finding", () => {
  const narrowed = {
    "new --category": [JUDGES["new.category"].guard, (one) => `${one} && fresh`],
    "new --priority": [JUDGES["new.priority"].acts, (one) => one.replace(")", " && fresh)")],
  };
  for (const [slot, [written, narrow]] of Object.entries(narrowed)) {
    assert.deepEqual(about(problems(sourceFor(ROOT)), slot), [],
      `${slot} as written is a finding, so what follows would pass for the wrong reason`);
    const found = mutated((text) => text.replaceAll(written, narrow(written)));
    assert.equal(found.length, 1, found.join("\n"));
    assert.match(about(found, slot)[0], /the judgement is that whole statement/u);
  }
});

test("a judge of the filing that comes after the body is read is the finding", () => {
  const moved = (text, judge) => text.replace(judge, "")
    .replace("    const unnamed = await servesOwed(", `${judge}\n    const unnamed = await servesOwed(`);
  const found = mutated((text) => moved(text,
    `    ${JUDGE}("new", "status", given.status,\n`
    + '      { values: declaredFor("forge_issues", "status"), hint: STATUSES_SEEN });'));
  assert.match(about(found, "new --status")[0] ?? "", /after `bodyFrom\(`/u,
    "the status was judged only after the body had been read, and that passed");
});

test("an options object a spread could rewrite is a shape this cannot read, not one it certifies", () => {
  const found = mutated((text) => text.replace(STATUS_JUDGE,
    STATUS_JUDGE.replace("hint: STATUSES_SEEN", "hint: STATUSES_SEEN, ...options")));
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(about(found, "issue --status")[0], /judged against some other slot's set/u);
});

/* The statement verbatim is not the statement reached: wrapped in a condition it reads the same and
   judges only the calls that condition lets through, which is the narrowing again by another route. */
test("a judgement the same but one condition deeper is the finding, for either shape of row", () => {
  const wrapped = {
    "new --category": JUDGES["new.category"],
    "new --priority": JUDGES["new.priority"],
  };
  for (const [slot, row] of Object.entries(wrapped)) {
    const name = slot.split("--")[1];
    const written = row.acts ?? `if (${row.guard}) ${row.ends}${row.call}(${name}));`;
    const found = mutated((text) => text.replaceAll(written, `if (fresh) { ${written} }`));
    assert.equal(found.length, 1, found.join("\n"));
    assert.match(about(found, slot)[0], /not as a statement of the block the call is spent in/u);
  }
});

/* The narrowing and the whole statement at once: the copy past the body read answers the depth and
   the spelling, the narrowed one before it does the running, and no single check sees both. */
test("the statement kept whole past the boundary while a narrowed one runs is the finding", () => {
  const { acts } = JUDGES["new.priority"];
  assert.deepEqual(about(problems(sourceFor(ROOT)), "new --priority"), [],
    "the statement as written is a finding, so what follows would pass for the wrong reason");
  const found = mutated((text) => text
    .replace(`    ${acts}\n`, `    ${acts.replace(")", " && fresh)")}\n`)
    .replace("    const unnamed = await servesOwed(", `    ${acts}\n    const unnamed = await servesOwed(`));
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(about(found, "new --priority")[0], /not where it runs/u);
});

test("a verb's own judge acted on only after the body is read is the finding", () => {
  const found = mutated((text) => text
    .replace("    if (rank.refusal) fail(rank.refusal.text);\n", "")
    .replace("    const unnamed = await servesOwed(", "    if (rank.refusal) fail(rank.refusal.text);\n    const unnamed = await servesOwed("));
  assert.match(about(found, "new --priority")[0] ?? "", /does not end the call on its answer before/u,
    "the rank was refused only after the body had been read, and that passed");
});

test("a verb's own judge whose answer nothing acts on is the finding", () => {
  for (const [key, row] of Object.entries(JUDGES)) {
    const name = key.split(".")[1];
    const found = mutated((text) => text.replaceAll(row.ends, `${row.ends.replace("(", "Somehow(")}`));
    /* The ending is inside the statement each row now names, so that is the reason reported first;
       what holds the ending's own position is the pair of boundary cases above. */
    assert.match(about(found, `new --${name}`)[0] ?? "", /the judgement is that whole statement/u,
      `${key}: its judge was certified with nothing acting on it`);
  }
});

/* The mask is the whole of what every reader here indexes into, so the shapes it has to survive are
   asserted on their own rather than only through a mutation that happens to hold one. */
test("the mask keeps its length and its boundaries through every nesting this tree can write", () => {
  const wrap = (body) => `  issue: async (argv) => {\n    ${body}\n    everyIssue(x);\n  }\n`;
  const shapes = {
    "a nested template in a hole": "const s = `a${`b${c}d`}e`;",
    "an object literal in a hole": "const s = `a${JSON.stringify({ x: 1 })}b`;",
    "a backtick inside a comment": "/* a ` b */",
    "a comment inside a hole": "const s = `a${/* } */ b}c`;",
    "a regex inside a hole": "const s = `a${x.replace(/[}{]/u, y)}b`;",
    "a quote inside a template's text": "const s = `\"${d}\"`;",
    "an unterminated string": "const s = \"a",
  };
  for (const [said, body] of Object.entries(shapes)) {
    const text = wrap(body);
    assert.equal(masked(text).length, text.length, `${said}: the mask no longer indexes the source`);
    if (said === "an unterminated string") continue;
    assert.match(blockFor(text, "issue"), /everyIssue\(x\);\n {2}$/u, `${said}: it moved the block's end`);
  }
});

test("a literal or a comment holding a delimiter moves no boundary", () => {
  const found = mutated((text) => text.replace(STATUS_JUDGE,
    `const shape = /[}{()]/u; /* ${JUDGE}( } */ const said = "})(";\n      ${STATUS_JUDGE}`));
  assert.deepEqual(found, [], "a brace inside a regex, a comment or a string closed a block");
});

test("the judge ends the call rather than answering, so no call site can read it and carry on", async () => {
  const { refuseUndeclared } = await import("../../../src/tracker/rest.mjs");
  const { refusing } = await import("../../../src/resolve/settings.mjs");
  await refusing(async () => {
    assert.throws(() => refuseUndeclared("issue", "status", "nonesuch", { values: ["open", "closed"] }),
      /issue --status: No status named nonesuch\./u);
    assert.equal(refuseUndeclared("issue", "status", "open", { values: ["open", "closed"] }), undefined);
    assert.equal(refuseUndeclared("issue", "status", undefined, { values: ["open"] }), undefined,
      "an argument nobody gave is no value outside a set");
  });
});

test("a judge in a block whose dispatch this checker cannot see is the finding", () => {
  const found = mutated((text) =>
    DISPATCHES.reduce((held, one) => held.replaceAll(`${one}(`, `${one}Somehow(`), text));
  assert.ok(found.length >= 6, `every declared slot of those verbs is owed a finding, not ${found.length}`);
  assert.match(about(found, "issue --status")[0], /cannot say the judgement comes first/u);
});

test("a verb whose source cannot be read is the finding, never a pass", () => {
  const found = problems(() => null);
  assert.equal(found.length, declaredSlots().length);
  assert.match(found[0], /could not read the source/u);
});
