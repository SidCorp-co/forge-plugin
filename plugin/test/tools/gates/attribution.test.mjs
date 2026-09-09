/* Whose the runner says a failing test step's cases are, end to end on a checkout of its own. Two
   ships' gates were thrown away on cases that pass alone, and a run reading `Gate failed: test`
   could act on nothing (ISS-907). A case that reproduces must still refuse, and a case that does
   not must still let the run through: both, or the step is not proved. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { CASES_ENV } from "../../../../tools/gates/isolation.mjs";
import { fakeTracker } from "../../fixtures.mjs";
import { COPIED, entryDir, landed, passesFor, ranGate, reachedFrom, ROOT as SCRATCH_ROOT,
  ROUTE_ROOTS, run, runsFile, scratch, STAMPED } from "./scratch.mjs";

const DYNAMIC = /\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/gu;
const CASE = "plugin/test/tools/two.test.mjs";
const CASE_NAME = "a case of this scratch's own";
const REACHED = "plugin/src/two.mjs";
const FILED = "ISS-9001";
const SLUG = "forge-plugin";

const caseFile = (body) => `import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("a case of this scratch's own", () => {
${body}
});
`;

/* The one signal that differs between the step and its re-run: the runner names the failing-case
   record for a step and empties it for a re-run, so this stands in for a starved process without
   depending on load, ordering or a clock. */
const ONLY_IN_THE_STEP = `  if (process.env.${CASES_ENV}) throw new Error("only when the step ran it");`;
const HOWEVER_RUN = `  throw new Error("however it is run");`;
const ROOM_ON_THE_RERUN = `${ONLY_IN_THE_STEP}
  const room = join(tmpdir(), "${STAMPED}");
  mkdirSync(room, { recursive: true });
  writeFileSync(join(room, "planted-by-the-rerun"), "");`;

// Reproduces only when asked to, which is what varies between three runs at one unchanged digest.
const ASKED = "SCRATCH_REPRODUCES";
const WHEN_ASKED = `  if (process.env.${CASES_ENV} || process.env.${ASKED}) throw new Error("asked to");`;

/* The record is written where the runner told the reporter to write it, so a directory there is
   the one way a step fails with no case it could name. */
const UNWRITABLE = `  mkdirSync(process.env.${CASES_ENV}, { recursive: true });
  throw new Error("and then fails");`;

const withCase = (name, body, leaking) => {
  const made = scratch(name, undefined, leaking);
  landed(made.work, CASE, caseFile(body));
  landed(made.work, REACHED, "export const two = 2;\n");
  return made;
};

/* Carrying the filing route and a real project file, which is what a checkout with this plugin
   installed has and what the scratches above deliberately do not. */
const routed = (name, body = null) => {
  const made = scratch(name, undefined, undefined, { also: ROUTE_ROOTS, slug: SLUG });
  if (body) landed(made.work, CASE, caseFile(body));
  landed(made.work, REACHED, "export const two = 2;\n");
  return made;
};

const aloneFile = (work) => join(entryDir(work), "test-alone");

test("a case that fails however it is run refuses the gate, and the refusal names the case", () => {
  const { at, work } = withCase("attributed-tree-", HOWEVER_RUN);
  try {
    const said = run(work);
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, new RegExp(`Gate failed: test — 1 of 1 case\\(s\\) reproduced alone `
      + `— the tree judged: ${work}`, "u"), said.stderr);
    assert.match(said.stderr, /a case of this scratch's own/u, said.stderr);
    assert.match(said.stderr, new RegExp(CASE.replace(/\//gu, "\\/"), "u"), said.stderr);
    assert.match(said.stdout, /reproduced alone/u, said.stdout);
    assert.deepEqual(passesFor(work, "test"), [], "a step whose case reproduced was recorded as passed");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a case that does not reproduce alone does not refuse, and the run says what it knows", () => {
  const { at, work } = withCase("attributed-quiet-", ONLY_IN_THE_STEP);
  try {
    const said = run(work);
    assert.equal(said.status, 0, said.stdout + said.stderr);
    assert.match(said.stdout, /=== isolation: test — 1 failing case\(s\), each re-run once, alone, at this head ===/u, said.stdout);
    assert.match(said.stdout, /not reproduced +\d+s +plugin\/test\/tools\/two\.test\.mjs/u, said.stdout);
    assert.match(said.stdout, /was not shown to be this tree's/u, said.stdout);
    assert.match(said.stdout, /a starved process and an interaction between cases both answer this way/u, said.stdout);
    assert.ok(!said.stdout.includes("the machine's"), `a cause the re-run cannot read was named:\n${said.stdout}`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("the run that carried on prints no clean verdict, no figure, and no pass for that step", () => {
  const { at, work } = withCase("attributed-verdict-", ONLY_IN_THE_STEP);
  try {
    const said = run(work);
    assert.ok(!said.stdout.includes("gate step(s) passed"), `it read as a clean pass:\n${said.stdout}`);
    assert.match(said.stdout, /gate step\(s\) ran in \d+s and this is not a clean pass/u, said.stdout);
    assert.match(said.stdout, /1 case\(s\) failed in a step and were not reproduced alone:/u, said.stdout);
    assert.match(said.stdout, /test {2}plugin\/test\/tools\/two\.test\.mjs {2}a case of this scratch's own/u, said.stdout);
    assert.match(said.stdout, /the next invocation on this content spends each of them whole/u, said.stdout);
    assert.deepEqual(passesFor(work, "test"), [], "a step that exited non-zero was recorded as passed");
    assert.equal(passesFor(work, "lint").length, 1, "a step that passed beside it was not recorded");
    assert.ok(!existsSync(runsFile(work)), "a run that re-ran a case left a whole-run figure");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("the same case not reproduced twice at one digest is a suite-interaction finding, and still does not refuse", () => {
  const { at, work } = withCase("attributed-again-", ONLY_IN_THE_STEP);
  try {
    const first = run(work);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.ok(!first.stdout.includes("suite-interaction"), `the first attribution claimed a repeat:\n${first.stdout}`);
    assert.match(readFileSync(aloneFile(work), "utf8"), /"digest":"[0-9a-f]{12}"/u);

    const again = run(work);
    assert.equal(again.status, 0, again.stdout + again.stderr);
    assert.match(again.stdout, /suite-interaction finding/u, again.stdout);
    assert.match(again.stdout, /It does not refuse, and it is filed/u, again.stdout);
    assert.ok(!again.stdout.includes("What a refusal would need"),
      `the line still asks for a ruling that has been made:\n${again.stdout}`);
    assert.match(readFileSync(aloneFile(work), "utf8"), /"at":"\d{4}-\d\d-\d\dT[\d:.]+Z"/u);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* A checkout without this plugin's own CLI is every checkout the scratches above are: the filing
   route is not there, and the one thing that may not happen is the gate refusing for it. */
test("a filing whose route cannot be loaded prints why, prints the body, names the command by hand, and refuses nothing", () => {
  const { at, work } = withCase("attributed-no-route-", ONLY_IN_THE_STEP);
  try {
    run(work);
    const again = run(work);
    assert.equal(again.status, 0, again.stdout + again.stderr);
    assert.ok(!again.stdout.includes("Gate failed"), again.stdout);
    assert.match(again.stdout,
      /the filing could not be made: the filing route could not be loaded: Cannot find module/u, again.stdout);
    assert.ok(again.stdout.includes("file it by hand, the body being the block below: forge new - --title "),
      again.stdout);
    assert.ok(again.stdout.includes("--category bug"), again.stdout);
    assert.ok(again.stdout.includes("## What happened"), again.stdout);
    assert.ok(again.stdout.includes(`- case: ${CASE_NAME}`), again.stdout);
    assert.match(again.stdout, /→ no issue: the filing route could not be loaded/u, again.stdout);
    assert.deepEqual(passesFor(work, "test"), [], "the step the recurrence was in was recorded as passed");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The leak refusal is an exit like the other two and owes the same list: a step leaking after the
   step that attributed would otherwise leave the finding only in the middle of the log. */
test("a step that leaks after a recurrence still names what the recurrence reached", () => {
  const { at, work } = withCase("attributed-leak-after-", ONLY_IN_THE_STEP, "check:dup");
  try {
    run(work);
    const again = run(work);
    assert.equal(again.status, 1, again.stdout);
    assert.match(again.stderr, /Gate failed: check:dup/u, again.stderr);
    assert.match(again.stderr, /hook stamp\(s\) in/u, again.stderr);
    assert.ok(again.stderr.includes(`test  ${CASE}  ${CASE_NAME}  → no issue:`),
      `the leak refusal named no finding:\n${again.stderr}`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The walk behind the copy sets follows static imports only, so a module reached by a literal
   dynamic one is a root somebody declares. This says when a new one appears, rather than leaving a
   scratch quietly copying less than the runner needs. */
test("every module the copy sets reach by a literal dynamic import is in them", () => {
  const held = new Set([...COPIED, ...reachedFrom(ROUTE_ROOTS)]);
  const missing = [];
  for (const one of held) {
    const text = readFileSync(join(SCRATCH_ROOT, one), "utf8");
    for (const [, spec] of text.matchAll(DYNAMIC)) {
      const target = relative(SCRATCH_ROOT, resolve(dirname(join(SCRATCH_ROOT, one)), spec));
      if (!held.has(target)) missing.push(`${one} imports ${target}`);
    }
  }
  assert.deepEqual(missing, [], `declare each of these among scratch.mjs's roots: ${missing.join("; ")}`);
});

/* The runner's own wiring, which no module test reaches: the dynamic import resolving, the lookup
   asking, the create arriving. A scratch carrying the route and pointed at a server of this case's
   own, so what the gate sent is read off the wire and no live backlog is written. */
test("the runner asks the tracker nothing until a recurrence, and then files it", async () => {
  const state = { issues: [], calls: [], key: FILED };
  const tracker = await fakeTracker(state);
  const clean = routed("attributed-route-clean-");
  const held = routed("attributed-route-filed-", ONLY_IN_THE_STEP);
  const env = { XDG_CONFIG_HOME: tracker.env.XDG_CONFIG_HOME };
  try {
    const green = await ranGate(clean.work, [], clean.work, env);
    assert.equal(green.status, 0, green.stdout + green.stderr);
    assert.equal(state.calls.length, 0, `a clean run called the tracker: ${JSON.stringify(state.calls)}`);

    const first = await ranGate(held.work, [], held.work, env);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.equal(state.calls.length, 0, `a first attribution called the tracker: ${JSON.stringify(state.calls)}`);

    const again = await ranGate(held.work, [], held.work, env);
    assert.equal(again.status, 0, again.stdout + again.stderr);
    const made = state.calls.filter((one) => one.method === "POST" && /\/issues$/u.test(one.path));
    assert.equal(made.length, 1, JSON.stringify(state.calls.map((one) => `${one.method} ${one.path}`)));
    assert.equal(made[0].sent.category, "bug");
    assert.ok(made[0].sent.description.includes(`- case: ${CASE_NAME}`), made[0].sent.description);
    assert.match(again.stdout, new RegExp(`filed as ${FILED}`, "u"), again.stdout);
    assert.match(again.stdout, new RegExp(`→ ${FILED}, filed`, "u"), again.stdout);
  } finally {
    tracker.close();
    for (const one of [clean.at, held.at]) rmSync(one, { recursive: true, force: true });
  }
});

/* Recurrence is a claim about the attribution before this one and no earlier: a case reproduced in
   between is a run of them ended, so the third attribution here has nothing to repeat. */
test("a case reproduced between two attributions ends the run of them, so the third claims no repeat", () => {
  const { at, work } = withCase("attributed-broken-run-", WHEN_ASKED);
  try {
    const first = run(work);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(readFileSync(aloneFile(work), "utf8"), /a case of this scratch's own/u);

    const between = run(work, [], work, { [ASKED]: "1" });
    assert.equal(between.status, 1, between.stdout);
    assert.match(between.stderr, /1 of 1 case\(s\) reproduced alone/u, between.stderr);
    assert.equal(readFileSync(aloneFile(work), "utf8"), "", "the reproduced attribution left the earlier one standing");

    const third = run(work);
    assert.equal(third.status, 0, third.stdout + third.stderr);
    assert.match(third.stdout, /not reproduced/u, third.stdout);
    assert.ok(!third.stdout.includes("suite-interaction"), `a repeat was claimed across a reproduction:\n${third.stdout}`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("--full attributes the case and claims no repeat of it, having read no digest", () => {
  const { at, work } = withCase("attributed-full-", ONLY_IN_THE_STEP);
  try {
    const first = run(work, ["--full"]);
    const again = run(work, ["--full"]);
    for (const said of [first, again]) {
      assert.equal(said.status, 0, said.stdout + said.stderr);
      assert.match(said.stdout, /not reproduced/u, said.stdout);
      assert.ok(!said.stdout.includes("suite-interaction"), `a --full run claimed a repeat:\n${said.stdout}`);
    }
    assert.deepEqual(passesFor(work, "test"), [], "a --full run recorded a pass for the step it attributed");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a test step that failed with no case to name refuses, and says none was re-run", () => {
  const { at, work } = withCase("attributed-unnamed-", UNWRITABLE);
  try {
    const said = run(work);
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, new RegExp(`Gate failed: test — no failing case was named, so none was `
      + `re-run — the tree judged: ${work}`, "u"), said.stderr);
    assert.match(said.stdout, /# the failing cases could not be recorded at \S+: EISDIR/u, said.stdout);
    assert.ok(!said.stdout.includes("=== isolation:"), `a case was re-run with none named:\n${said.stdout}`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a step no case can be named in refuses exactly as it did before any of this", () => {
  const { at, work } = scratch("attributed-not-a-suite-", "lint");
  try {
    landed(work, REACHED, "export const two = 2;\n");
    const said = run(work);
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, new RegExp(`Gate failed: lint — the tree judged: ${work}`, "u"), said.stderr);
    assert.ok(!said.stdout.includes("=== isolation:"), `a case was re-run for a step with none:\n${said.stdout}`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The re-run gets a room below the gate's own, so what it leaves is not what the step left: the
   leak check would otherwise refuse a step for its own attribution's leavings. */
test("a stamp room the re-run left does not fail the step the re-run was judging", () => {
  const { at, work } = withCase("attributed-room-", ROOM_ON_THE_RERUN);
  try {
    const said = run(work);
    assert.equal(said.status, 0, said.stdout + said.stderr);
    assert.ok(!said.stderr.includes("hook stamp(s) in"), `the re-run's room failed the step:\n${said.stderr}`);
    assert.match(said.stdout, /not reproduced/u, said.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("every file of the step still runs in the suite, the attribution adding no exclusion", () => {
  const { at, work } = withCase("attributed-whole-suite-", ONLY_IN_THE_STEP);
  try {
    const said = run(work);
    assert.match(said.stdout, /the green case of plugin\/test\/tools\/one\.test\.mjs/u, said.stdout);
    assert.match(said.stdout, /1 case\(s\) failed in the suite beside [1-9]\d* that passed/u, said.stdout);
    assert.match(said.stdout, /each of the 1 was re-run once, alone, at this head/u, said.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
