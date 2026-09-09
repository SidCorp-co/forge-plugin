/* Whose a failing test step's cases are. A step of 2267 printed `Gate failed: test` and exited, so
   three runs told a regression from a starved process by hand, a gate each (ISS-907). */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

// Unset, the reporter writes nothing, so a suite spent by hand leaves no record for a gate to read.
export const CASES_ENV = "GATE_FAILED_CASES";

export const HUMAN_REPORTER = process.stdout.isTTY ? "spec" : "tap";

const named = (one) => `${one.file}\t${one.name}`;

const isFile = (data) => typeof data.file === "string" && resolve(data.name) === data.file;

const jsonLines = (at) =>
  readFileSync(at, "utf8").trim().split("\n").filter(Boolean).map((one) => JSON.parse(one));

/** The nesting-0 failures, because a pattern naming a nested leaf alone selects nothing: the case a
 *  re-run can name is the outermost test, which node reports failing too. The leaves under it are
 *  kept per file so the line can say what the selected unit actually contains. */
export default async function* failedCases(source) {
  const failed = [];
  const inside = new Map();
  let passed = 0;
  for await (const { type, data } of source) {
    if (type === "test:pass" && data.nesting === 0 && !isFile(data)) passed += 1;
    if (type !== "test:fail") continue;
    const deeper = inside.get(data.file) ?? [];
    if (data.nesting > 0) inside.set(data.file, [...deeper, data.name]);
    else {
      failed.push({
        file: relative(process.cwd(), data.file), name: data.name, whole: isFile(data), inside: deeper,
      });
      inside.set(data.file, []);
    }
  }
  const at = process.env[CASES_ENV];
  if (!at || failed.length === 0) return;
  try {
    writeFileSync(at, [{ passed, failed: failed.length }, ...failed].map((one) => JSON.stringify(one)).join("\n"));
  } catch (error) {
    yield `# the failing cases could not be recorded at ${at}: ${error.message}\n`;
  }
}

const wellFormed = (one) => typeof one?.file === "string" && typeof one?.name === "string"
  && typeof one?.whole === "boolean" && Array.isArray(one?.inside);

/** Null unless the record is whole and says so: a torn write leaves a header claiming two failures
 *  above one case, and attributing the survivor would let the other through unread. */
export const casesFrom = (at) => {
  let lines;
  try {
    lines = jsonLines(at);
  } catch {
    return null;
  }
  const [counted, ...cases] = lines;
  if (typeof counted?.passed !== "number" || counted.failed !== cases.length) return null;
  return cases.length > 0 && cases.every(wellFormed) ? { counted, cases } : null;
};

const METACHARACTER = /[.*+?^${}()|[\]\\]/gu;

// Anchored and escaped, so it selects that case and no case whose name merely contains it.
export const patternFor = (name) => `^${name.replace(METACHARACTER, "\\$&")}$`;

export const argvFor = (one) => [process.execPath, "--test", "--test-concurrency=1",
  `--test-reporter=${HUMAN_REPORTER}`, "--test-reporter-destination=stdout",
  ...(one.whole ? [] : [`--test-name-pattern=${patternFor(one.name)}`]), one.file];

/** One run per case and one only: a tree failure retried into green is the one thing this may not
 *  do. Its own room below the gate's, so what a re-run leaves cannot fail the step it is judging;
 *  both record variables emptied, or one case's re-run overwrites the whole step's per-file seconds. */
const reran = (one, { root, scratch }) => {
  const room = mkdtempSync(join(scratch, "isolation-"));
  const argv = argvFor(one);
  const at = Date.now();
  const { status, error } = spawnSync(argv[0], argv.slice(1),
    { cwd: root, stdio: "inherit", env: { ...process.env, TMPDIR: room, GATE_FILE_TIMES: "", [CASES_ENV]: "" } });
  return { reproduced: Boolean(error) || status !== 0, took: Math.round((Date.now() - at) / 1000) };
};

/** What the previous attribution of this step named, under the digest it named it at. A run that
 *  read no digest classifies nothing: a stand-in would manufacture the identical-content evidence. */
const previously = (at, digest) => {
  if (!digest) return () => false;
  let held;
  try {
    held = jsonLines(at);
  } catch {
    return () => false;
  }
  const keys = new Set(held.filter((one) => one.digest === digest).map(named));
  return (one) => keys.has(named(one));
};

// After every attribution, an empty one included: a reproduced case between two ends their run.
const remember = (at, digest, cases) => {
  try {
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, cases.map((one) =>
      JSON.stringify({ digest: digest ?? null, file: one.file, name: one.name })).join("\n"));
  } catch {
    /* A note and not a verdict: a run that could not write it has still attributed every case. */
  }
};

export const attribute = (step, { root, scratch, cases, record, say }) => {
  const found = casesFrom(cases);
  if (!found) return null;
  say(`\n=== isolation: ${step.label} — ${found.cases.length} failing case(s), `
    + `each re-run once, alone, at this head ===`);
  const seen = previously(record, step.digest);
  const judged = found.cases.map((one) => ({ one, repeat: seen(one), ...reran(one, { root, scratch }) }));
  const quiet = judged.filter((each) => !each.reproduced).map((each) => each.one);
  remember(record, step.digest, quiet);
  return { counted: found.counted, judged, quiet, tree: judged.filter((each) => each.reproduced) };
};

const REPEAT = `named by the previous attribution of this step at this digest, so it is a `
  + `suite-interaction finding: the same case failing in the suite twice at one content and passing `
  + `alone twice is a claim about how the suite runs. It does not refuse. What a refusal would need `
  + `is a ruling that such a case is the tree's, which is filed as ISS-925`;

const WHAT_IT_IS_NOT = `Not reproduced alone means the case was not shown to be this tree's. It does `
  + `not say why: a starved process and an interaction between cases both answer this way, and one `
  + `re-run cannot read which of them it was.`;

const shape = (each) => {
  const how = each.reproduced ? "reproduced alone  " : "not reproduced    ";
  const inside = each.one.inside.length > 0
    ? `\n    selected the enclosing test, the failure(s) inside it being: ${each.one.inside.join("; ")}`
    : "";
  const repeat = !each.reproduced && each.repeat ? `\n    ${REPEAT}` : "";
  return `  ${how} ${each.took}s  ${each.one.file}\n    ${each.one.name}${inside}${repeat}`;
};

export const attributionLines = ({ counted, judged, tree }) => [
  ...judged.map(shape),
  `${counted.failed} case(s) failed in the suite beside ${counted.passed} that passed, and each of `
  + `the ${judged.length} was re-run once, alone, at this head.`,
  ...(tree.length < judged.length ? [WHAT_IT_IS_NOT] : []),
];
