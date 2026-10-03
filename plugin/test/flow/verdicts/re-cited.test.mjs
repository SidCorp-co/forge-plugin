/* A verdict whose judgement stands and only its citation is owed is asked for again with the value it
   holds: one placeholder shared across every criterion was filled with one value, and a run filling
   it with `pass` turned eight reasoned skips into passes nobody took (ISS-2252). Where a fresh look is
   what is owed, the ask still names the set and no held value. The printed line is read the way a
   run's shell and the verdict write read it, never by splitting on spaces. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-re-cited").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { CHECKS, judgedOwed, viewFrom } = await import("../../../src/flow/earned.mjs");
const { SHAPES, VERDICTS } = await import("../../../src/flow/machine.mjs");
const { blocksIn, checked } = await import("../../../src/flow/record/record.mjs");
const { heldBlocks } = await import("../../../src/flow/earned/asks.mjs");
const { RUNTIME_ASK } = await import("../../../src/flow/qa/verdicts.mjs");
const { foldedBody } = await import("../../../src/flow/earned/findings.mjs");
const { releaseFrom } = await import("../../../src/tracker/project-config.mjs");

const BUILDER = "the-builder-session";
const QA = "the-qa-session";
const MERGED = "c8c35500000000000000000000000000000000ab";
const DEPLOYED = "9e24c2af00000000000000000000000000000cde";
const MOVED = "3cd76450000000000000000000000000000000ef";
const AT = "2026-09-07T12:00:00.000Z";
const CRITERIA = "1. One.\n2. Two.\n3. Three.\n4. Four.";
const PLAN = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.";
const PLACEHOLDER = `--verdict <${VERDICTS.join("|")}>`;
/* A why a shell would cut or expand if it went out bare: an apostrophe, a dollar, a backtick. */
const AWKWARD = "the fixture's `$HOME` holds no login; it's out of reach";
const CHECKPOINT = {
  state: "judged", builder: BUILDER, branch: "iss-2252", head: MERGED,
  base: "6e4ecb10000000000000000000000000000000ff", candidate: DEPLOYED, deployment: DEPLOYED,
  files: ["plugin/src/flow/earned.mjs"], at: AT,
};
const INDEPENDENT = releaseFrom({
  baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true, qa: "independent" },
});

let clock = 0;
const at = () => `2026-09-07T13:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ documentId: `c-${clock + 1}`, createdAt: at(), authorId: "agent", body });
const mark = () => comment(`mark_merged target=base — merged to master at ${MERGED}`);
const verdictOf = (number, over = {}) =>
  ({ criterion: `${number} — text`, verdict: "pass", commit: MERGED, evidence: [MOVED], judge: QA, ...over });
/* Every value the set holds, each with what its write demands beside it. */
const HELD = [
  verdictOf(1),
  verdictOf(2, { verdict: "skipped", why: AWKWARD, evidence: [] }),
  verdictOf(3, { verdict: "short", why: "met for the list, short for the empty one", filed: "ISS-81" }),
  verdictOf(4, { verdict: "fail", why: "printed nothing" }),
];
const unjudgedOf = (verdict) => Object.fromEntries(Object.entries(verdict).filter(([key]) => key !== "judge"));
const issueOf = (over = {}) => ({
  acceptanceCriteria: CRITERIA, plan: PLAN, mergedAt: AT, attachments: [],
  sessionContext: { landing: CHECKPOINT }, ...over,
});
/* The judge's items alone: a held fail raises an item of its own beside them, which the last case reads. */
const owedOn = (verdicts, { issue = {}, release = INDEPENDENT } = {}) =>
  judgedOwed(viewFrom("the-uuid", issueOf(issue), [mark(), comment(render("verdict", verdicts))], null, release), "ISS-8")
    .filter((one) => one.what.startsWith("the verdict on criteria"));
/* The verdict write alone, without the correction route a held fail or skip prints after it. */
const writeOf = (command) => command.split("\n")[0];

/* The words a POSIX shell hands the CLI for what follows the issue key. */
const argvOf = (command, ref = "ISS-8") => {
  const tail = command.slice(command.indexOf(`forge record verdict ${ref} `) + `forge record verdict ${ref} `.length);
  /* A placeholder left in the line is a redirection to the shell, which would write a file here. */
  assert.doesNotMatch(tail, /[<>]/u, `nothing left for the run to fill in: ${command}`);
  const out = execFileSync("sh", ["-c", `printf '%s\\0' ${tail}`], { encoding: "utf8" });
  return out.split("\0").slice(0, -1);
};
const single = SHAPES.verdict.fields.filter((one) => !one.many).map((one) => `--${one.flag}`);
const fieldsOf = (block) => {
  const got = { evidence: [] };
  for (let at = 0; at < block.length; at += 2) {
    const flag = block[at].slice(2);
    if (flag === "evidence") got.evidence.push(block[at + 1]);
    else got[flag] = block[at + 1];
  }
  return got;
};
/* The two values only the judge has, filled as it fills them: the runtime it read off the deployment,
   and what it exercised. Every other value the line carries is the record's own. */
const EXERCISED = "<what you exercised>";
const filled = (command) => command.replace(RUNTIME_ASK, DEPLOYED).replace(EXERCISED, "judged.txt");
const blocksOf = (command, ref) =>
  blocksIn(argvOf(filled(command), ref), "criterion", single, "record verdict").map(fieldsOf);

test("a verdict citing nothing at the deployment is asked for again with the value each criterion holds", () => {
  const [item, ...rest] = owedOn(HELD);
  assert.deepEqual(rest, [], `one item for the one citation: ${rest.map((one) => one.what)}`);
  assert.match(item.what, /^the verdict on criteria 1, 2, 3, 4 cites nothing at 9e24c2a/u);
  assert.ok(item.command.includes(`--runtime ${RUNTIME_ASK} --evidence ${EXERCISED}`),
    `the runtime and what was exercised are the judge's to fill, and nothing else is: ${item.command}`);
  const blocks = blocksOf(item.command);
  assert.deepEqual(blocks.map((one) => [Number(one.criterion), one.verdict]), HELD.map((one) => [Number.parseInt(one.criterion, 10), one.verdict]),
    `each criterion its own block, carrying its own value: ${item.command}`);
});

test("a held why and a held filed row reach the write unchanged, through the shell", () => {
  const blocks = blocksOf(owedOn(HELD)[0].command);
  for (const [index, held] of HELD.entries()) {
    assert.equal(blocks[index].why, held.why, `criterion ${index + 1}'s why`);
    assert.equal(blocks[index].filed, held.filed, `criterion ${index + 1}'s filed row`);
  }
  assert.equal(blocks[1].why, AWKWARD, "the apostrophes, the dollar and the backticks all arrive as typed");
});

test("the line taken as printed is a write the verdict shape accepts, block by block", () => {
  for (const block of blocksOf(owedOn(HELD)[0].command)) {
    assert.equal(block.commit, MERGED.slice(0, 7), "every block carries the head");
    assert.equal(block.runtime, DEPLOYED, "names the runtime the judge read");
    assert.deepEqual(block.evidence, ["judged.txt"], "and cites what it exercised");
    assert.doesNotThrow(() => checked("verdict", block), `criterion ${block.criterion} as printed`);
  }
});

test("where the judge is the problem, the ask names the set and carries no held value", () => {
  const byBuilder = HELD.map((one) => ({ ...one, judge: BUILDER }));
  const unjudged = HELD.map(unjudgedOf);
  const inherited = HELD.map((one) => ({ ...one, "judge-from": "inherited" }));
  for (const [name, verdicts] of Object.entries({ byBuilder, unjudged, inherited })) {
    const [item] = owedOn(verdicts);
    assert.ok(item.command.includes(PLACEHOLDER), `${name}: ${item.command}`);
    assert.doesNotMatch(writeOf(item.command), /--verdict (pass|skipped|short|fail)\b|--why|--filed/u,
      `${name}: a fresh judgement is owed, so nothing of the builder's is offered to copy: ${item.command}`);
  }
});

test("a screen change's attachment ask carries each criterion's held value", () => {
  const looked = [
    verdictOf(1, { evidence: [MERGED] }),
    verdictOf(2, { verdict: "short", why: AWKWARD, filed: "ISS-81", evidence: [MERGED] }),
  ];
  const item = judgedOwed(viewFrom("the-uuid", issueOf({
    acceptanceCriteria: "1. One.\n2. Two.", plan: PLAN.replace("Screen change: no", "Screen change: yes"),
    sessionContext: {},
  }), [mark(), comment(render("verdict", looked.map(unjudgedOf)))]), "ISS-8")
    .find((one) => one.command.startsWith("forge attach"));
  const command = item.command.replace("<that attachment>", "rendered.png");
  const blocks = blocksOf(command);
  assert.deepEqual(blocks.map((one) => [one.verdict, one.why, one.filed]),
    [["pass", undefined, undefined], ["short", AWKWARD, "ISS-81"]], command);
  for (const block of blocks) assert.deepEqual(block.evidence, ["rendered.png"], "every block cites the attachment");
});

test("a criterion holding no verdict is given the set, and never `pass`", () => {
  assert.equal(heldBlocks([[1, undefined], [2, { verdict: "skipped", why: "none" }]]),
    ` --criterion 1 ${PLACEHOLDER} --criterion 2 --verdict skipped --why none`);
  const HANDLE = "6bd04311";
  const folded = { documentId: `${HANDLE}-be5c-4f45-81fb-32e3c05c1886`, createdAt: at(), authorId: "agent",
    body: foldedBody("a title", "## What happened\n\nit broke\n\n## Outcome\n\nit works\n") };
  const view = viewFrom("the-uuid", {
    status: "testing", plan: PLAN, mergedAt: AT,
    acceptanceCriteria: `1. One.\n2. Takes the name — finding ${HANDLE}.`,
  }, [mark(), folded, comment(render("verdict", verdictOf(1, { judge: undefined })))]);
  const [item] = CHECKS.awaiting_release(view, "ISS-8").filter((one) => one.what.includes(`finding ${HANDLE}`));
  assert.match(item.what, /criterion 2 carries finding 6bd04311 and has no verdict/u);
  assert.ok(item.command.includes(`--criterion 2 ${PLACEHOLDER}`), item.command);
  assert.doesNotMatch(item.command, /--verdict pass\b/u, item.command);
});

test("where a fresh look is owed, the ask names the set rather than the value held", () => {
  const plain = (number, over = {}) => comment(render("verdict", { ...verdictOf(number), evidence: [MERGED], ...over }));
  /* A function and not a value, so the ruling is written after the verdict it moves past. */
  const ruling = () => comment(render("triage", { outcome: "wrong-test", "would-have-caught": "a criterion naming it" }, "0"));
  const pages = {
    skipped: [mark(), plain(1), plain(2, { verdict: "skipped", why: AWKWARD, evidence: [] })],
    failed: [mark(), plain(1), plain(2, { verdict: "fail", why: "printed nothing" })],
    reopened: [mark(), plain(2, { verdict: "short", why: "met short", filed: "ISS-81" }), ruling(), plain(1)],
  };
  for (const [name, page] of Object.entries(pages)) {
    const view = viewFrom("the-uuid", { acceptanceCriteria: "1. One.\n2. Two.", mergedAt: AT, attachments: [] }, page);
    const asked = CHECKS.awaiting_release(view, "ISS-8").filter((one) => one.what.includes("criterion 2"));
    assert.equal(asked.length, 1, `${name}: ${asked.map((one) => one.what)}`);
    assert.ok(asked[0].command.includes(PLACEHOLDER), `${name}: ${asked[0].command}`);
    assert.doesNotMatch(writeOf(asked[0].command), /--verdict (pass|skipped|short|fail)\b|--why|--filed/u,
      `${name} carries no held value: ${asked[0].command}`);
  }
});
