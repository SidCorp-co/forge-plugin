/* Watching one case go red, twice. The standard this repository proves a rule by is satisfied by one
   observation, and one observation cannot tell a case that fails from a case that failed that time. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resultsFrom } from "./gates/reporters/counted.mjs";
import { argvFor, CASES_ENV } from "./gates/reporters/isolation.mjs";
import { gateTmp } from "./gates/stamp-room.mjs";

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SELF), "..");
const REPORTER = fileURLToPath(new URL("./gates/reporters/counted.mjs", import.meta.url));

const USAGE = `Usage: node tools/red.mjs <test file> <case name>

Watch one case go red, twice: alone, and in the whole of the file it lives in. A case whose outcome
turns on what ran before it fails one way and passes the other, and from inside either reading a
case that fails is indistinguishable from a case that failed that time — so a red watched once says
nothing about the source it was watched against.

What is compared is that one case's own result in each reading, never the run's exit status: a case
can pass in a file where a sibling fails, which leaves the run red and the case green.

Take both readings against the source the fix is not in yet. Exit 0 where the two are red, 1 where
they are green or disagree, 2 where one of them is not a reading at all.`;

const WHOLE = "the whole of its file";
const ALONE = "that case alone";

const refuse = (text) => {
  process.stdout.write(`\n${text}\n`);
  process.exit(2);
};

/* The record goes in ahead of the file, which `argvFor` leaves last: the gate's re-run of a case and
   this reading of one are built by the same call, so they are the same reading. */
const withRecord = (argv, at) => [...argv.slice(0, -1),
  `--test-reporter=${REPORTER}`, `--test-reporter-destination=${at}`, argv.at(-1)];

/* A runner that inherits a test context of its own skips every file it is handed and reports
   nothing, and nothing is what a reading of a case that never ran looks like. */
const childEnv = (room) => {
  const env = { ...process.env, TMPDIR: room, GATE_FILE_TIMES: "", [CASES_ENV]: "" };
  delete env.NODE_TEST_CONTEXT;
  return env;
};

const taken = (one, room, at) => {
  const argv = withRecord(argvFor(one), at);
  spawnSync(argv[0], argv.slice(1), { cwd: ROOT, stdio: "inherit", env: childEnv(room) });
  return resultsFrom(at);
};

const roster = (rows) => (rows.length === 0
  ? "  — that reading reached no top-level case at all"
  : rows.map((one) => `  ${one.outcome.padEnd(5)} ${one.name}`).join("\n"));

const NOT_A_RESULT = { skip: "was skipped", todo: "is marked todo",
  cancelled: "ended without the run naming any kind of failure for it, which is a case cancelled "
    + "rather than a case judged" };

const targetIn = (rows, name, where, shown) => {
  if (rows === null) {
    refuse(`Reading ${where}, the run left no roster that answers for itself: it ended without `
      + `node's count of the file's top-level cases, or reached fewer of them than that count. A `
      + `record that may be short of a case cannot say this name is carried once, so nothing in it `
      + `is a reading of \`${name}\`.`);
  }
  const found = rows.filter((one) => one.name === name);
  if (found.length === 0) {
    refuse(`Reading ${where}, no top-level case of ${shown} is named:\n  ${name}\n\n`
      + `A selector matching nothing runs green and exits zero, which reads exactly like a case that `
      + `passed, so it is refused here rather than read. What that reading did reach:\n${roster(rows)}`);
  }
  if (found.length > 1) {
    refuse(`${found.length} top-level cases of ${shown} are named:\n  ${name}\n\n`
      + `Which of them the watched one is has no answer, so neither reading is taken. Name them apart, `
      + `or watch a name one case alone carries.`);
  }
  const { outcome } = found[0];
  if (outcome in NOT_A_RESULT) {
    refuse(`Reading ${where}, the case ${NOT_A_RESULT[outcome]}, so it produced nothing to judge. A `
      + `case that did not run is neither a red nor a green, and standing one in for either is what `
      + `this command is here to refuse.`);
  }
  return outcome;
};

const TWICE = `The red is this case's own. A case that fails both ways fails for the source rather `
  + `than for what ran before it, which is the only reading that says anything about the rule it is `
  + `written for.`;

const NEITHER = `Nothing was watched. A case that passes is not a case that fails without the rule `
  + `it holds. Take this reading against the source the fix is not in yet, or reshape the case until `
  + `it fails there.`;

const APART = `This case's outcome is decided by what ran before it, so neither reading says anything `
  + `about the source. One pair of readings cannot say which it was — an interaction between cases, `
  + `or a different share of the machine — and does not need to: reshape the case until the two `
  + `readings agree, then watch it again.`;

const shape = (name, alone, whole) => `\n\`${name}\`\n`
  + `  alone        ${alone}\n  in its file  ${whole}\n`;

const [file, name, ...rest] = process.argv.slice(2);
if (file === "-h" || file === "--help") {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}
if (!file || !name || rest.length > 0) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(2);
}

const at = resolve(process.cwd(), file);
if (!existsSync(at)) refuse(`No file stands at ${at}, so there is no case there to watch.`);
const rel = relative(ROOT, at);
const shown = rel && !rel.startsWith("..") ? rel : at;

const room = gateTmp();
const reading = (one, label, where, tag) => {
  process.stdout.write(`\n=== reading ${label} of 2: ${where} ===\n`);
  return taken(one, mkdtempSync(join(room, `${tag}-`)), join(room, `${tag}.jsonl`));
};

process.stdout.write(`\nWatching \`${name}\` in ${shown}, twice.\n`);
const inFile = targetIn(reading({ file: at, whole: true }, 1, WHOLE, "whole"), name, WHOLE, shown);
const alone = targetIn(reading({ file: at, whole: false, name }, 2, ALONE, "alone"), name, ALONE, shown);

process.stdout.write(shape(name, alone, inFile));
if (alone === "fail" && inFile === "fail") {
  process.stdout.write(`\n${TWICE}\n`);
  process.exit(0);
}
process.stdout.write(`\n${alone === inFile ? NEITHER : APART}\n`);
process.exit(1);
