/* The fourth verdict value. Three values covered four outcomes, so a judge who exercised a criterion,
   found it short of its wording and judged the shortfall harmless had only `skipped` to write — the
   value that also means nobody could reach it, and that is exempt from citing evidence for exactly
   that reason. The overload therefore dropped the proof obligation on the one record that had proof
   to show (ISS-1875). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-short").path;
const { parse, parseAll, render } = await import("../../../src/flow/record/page.mjs");
const { SHORT, VERDICTS, somebodyLooked } = await import("../../../src/flow/machine.mjs");
const { judgedOwed, shapeGaps, viewFrom } = await import("../../../src/flow/earned.mjs");
const { kindHelp } = await import("../../../src/flow/record/record-rows.mjs");

const COMMIT = "43b811e";
const NOTE = `merged to master at ${COMMIT}; reviewed head ${COMMIT}; judged head ${COMMIT}; landing moved nothing`;
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const ATTACHED = [{ name: "run.txt" }];
const BUILT = { sessionContext: { worklog: { branch: "iss-3-the-work" } } };

let clock = 0;
const at = () => `2026-09-20T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ createdAt: at(), authorId: "agent", body });
const recorded = (kind, fields) => comment(render(kind, fields));
const mark = () => comment(`mark_merged target=base — ${NOTE}`);

const verdict = (fields) => ({ criterion: "1. The first outcome.", commit: COMMIT, evidence: [COMMIT], ...fields });
const gapsOn = (fields) => shapeGaps("verdict", parse(render("verdict", verdict(fields))), ["run.txt"]);
const said = (fields) => gapsOn(fields).join(" ");

const view = (issue, comments) => viewFrom("the-uuid", { ...BUILT, ...issue, attachments: ATTACHED }, comments);
const judging = (issue, comments) => judgedOwed(view(issue, comments), "ISS-3").map((one) => one.what);

test("the verdict shape takes a fourth value, for a criterion exercised and found short of its wording", () => {
  assert.equal(SHORT, "short", "the value a judge types");
  assert.ok(VERDICTS.includes(SHORT), `VERDICTS carries it: ${VERDICTS.join(", ")}`);
  assert.deepEqual(VERDICTS, ["pass", "fail", "skipped", SHORT],
    "beside the three it joins, none of which moved");
  assert.deepEqual(gapsOn({ verdict: SHORT, why: "the second column rounds where the wording says truncates", filed: "ISS-9" }), [],
    "and a complete one reads back with no gap at all");
});

test("a short verdict written with no reason is refused by a message naming the flag that carries it", () => {
  assert.match(said({ verdict: SHORT, filed: "ISS-9" }), /--why/u);
  assert.match(said({ verdict: SHORT, filed: "ISS-9" }), /short of its wording/u,
    "and says what the reason is about, a `short` being the value that releases the change");
});

test("a short verdict naming no row is refused by a message naming the flag that carries the row", () => {
  assert.match(said({ verdict: SHORT, why: "the shortfall" }), /--filed/u);
  assert.match(said({ verdict: SHORT, why: "the shortfall" }), /closes nothing/u,
    "because the value records that the observation went somewhere else, and is no way to close one");
  assert.match(said({ verdict: SHORT, why: "the shortfall", filed: "it went on the backlog somewhere" }), /--filed/u,
    "and a sentence is no reference: nobody downstream can follow it");
  assert.match(said({ verdict: SHORT, why: "the shortfall", filed: "   " }), /--filed/u,
    "and an emptied one is the same shortfall to a reader, a record written by hand reaching this check too");
});

test("a short verdict carrying both reads back with its value and its row as fields of the record", () => {
  const body = render("verdict", [verdict({ verdict: SHORT, why: "the second column rounds", filed: "ISS-9" })]);
  const [held] = parseAll(body);
  assert.equal(held.fields.verdict, SHORT, `the value survives the read the entry checks weigh:\n${body}`);
  assert.equal(held.fields.filed, "ISS-9", "and so does the row it became, which is the whole point of writing it");
});

test("the row flag is refused on a verdict that is not short, rather than written and never read", () => {
  for (const one of ["pass", "fail", "skipped"]) {
    assert.match(said({ verdict: one, why: "a reason", filed: "ISS-9" }), /--filed/u,
      `--filed has no meaning on a \`${one}\` verdict and is refused rather than dropped`);
  }
});

test("a short verdict written with no evidence is refused, the exemption reaching skipped alone", () => {
  assert.match(said({ verdict: SHORT, why: "the shortfall", filed: "ISS-9", evidence: [] }), /--evidence/u,
    "somebody looked, so there is something to cite");
  assert.equal(somebodyLooked(SHORT), true);
  assert.equal(somebodyLooked("skipped"), false);
});

test("a skipped verdict is written with no evidence at all, as it always was", () => {
  assert.deepEqual(gapsOn({ verdict: "skipped", why: "no credential reaches that screen", evidence: [] }), [],
    "there was nothing to look at");
});

test("no verdict value is exempt from one evidence obligation without being exempt from the other", () => {
  const screened = { plan: "Screen change: yes\nSchema coupling: no", acceptanceCriteria: CRITERIA };
  for (const one of VERDICTS) {
    const fields = { verdict: one, why: "a reason", evidence: [], ...(one === SHORT ? { filed: "ISS-9" } : {}) };
    const atWrite = gapsOn(fields).some((gap) => gap.includes("--evidence"));
    const judged = [mark(), recorded("verdict", verdict({ ...fields, evidence: [COMMIT] }))];
    const atScreen = judging(screened, judged).some((what) => what.includes("cites no attachment"));
    assert.equal(atWrite, atScreen,
      `\`${one}\` is exempt from both or from neither: the write says ${atWrite}, the screen check says ${atScreen}`);
  }
});

test("a screen change owes an attachment on a short verdict and none on a skipped one", () => {
  const screened = { plan: "Screen change: yes\nSchema coupling: no", acceptanceCriteria: "1. The first outcome." };
  const judged = (fields) => [mark(), recorded("verdict", verdict(fields))];
  const shortfall = { verdict: SHORT, why: "the second column rounds", filed: "ISS-9" };
  assert.match(judging(screened, judged(shortfall)).join(" "), /cites no attachment/u,
    "somebody looked at the screen and saw the shortfall, so the record shows what they looked at");
  assert.deepEqual(judging(screened, judged({ ...shortfall, evidence: ["run.txt"] })), [],
    "and an attachment this issue carries answers it");
  assert.deepEqual(judging(screened, judged({ verdict: "skipped", why: "no credential reaches it", evidence: [] })), [],
    "while a skipped verdict is named in nothing that holds `testing`");
});

test("a complete short verdict holds no rung where a fail written in the same place holds testing", () => {
  const plain = { acceptanceCriteria: "1. The first outcome." };
  const judged = (fields) => [mark(), recorded("verdict", verdict(fields))];
  assert.deepEqual(judging(plain, judged({ verdict: SHORT, why: "the second column rounds", filed: "ISS-9" })), [],
    "the change releases: that is what the judgement was made to allow");
  assert.match(judging(plain, judged({ verdict: "fail", why: "the column is empty" })).join(" "), /failed its verdict/u,
    "and a fail in the same place still holds the rung, which this adds a case beside and does not soften");
});

test("a verdict written under the three-value set reads back with the gaps it read back with before", () => {
  const before = (fields) => shapeGaps("verdict", parse(render("verdict", verdict(fields))), ["run.txt"]);
  assert.deepEqual(before({ verdict: "pass" }), [], "a pass citing its evidence");
  assert.deepEqual(before({ verdict: "fail", why: "the column is empty" }), [], "a fail with its reason");
  assert.deepEqual(before({ verdict: "skipped", why: "no credential", evidence: [] }), [], "a skip with neither");
  assert.match(before({ verdict: "pass", evidence: [] }).join(" "), /--evidence/u, "and a pass with no evidence still refused");
  assert.match(before({ verdict: "fail" }).join(" "), /--why/u, "and a fail with no reason still refused");
  assert.equal(parse(render("verdict", verdict({ verdict: "pass" }))).fields.filed, undefined,
    "nothing already written gains a field, so a reader of an old record gets the old reading");
});

test("the verdict help names each of the four values and the outcome it records", () => {
  const help = kindHelp("verdict");
  for (const one of VERDICTS) {
    assert.match(help, new RegExp(`^\\s+${one}\\s+\\S`, "mu"), `\`${one}\` has its own line:\n${help}`);
  }
  assert.match(help, /pass\|fail\|skipped\|short/u, "and the usage row offers all four");
  assert.match(help, /--filed/u, "and names the flag a short verdict owes, or the parse refuses it as a stranger");
});
