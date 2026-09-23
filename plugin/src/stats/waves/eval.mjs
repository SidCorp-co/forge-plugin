/* `forge stats eval --waves` — the last ten folded dispatch waves against the ten before them, in the
   envelope the run eval answers in, with the plugin copy each wave's dispatcher ran as what separates
   the windows. What it counts and what no record lets it: docs/cli/stats-the-waves.md. */
import { wavesRead } from "./profile.mjs";
import { medianOrZero } from "../figures.mjs";
import { checkoutFrom } from "../runs.mjs";
import { comparedWindows, shiftBetween, shiftLine, tallied, twoWindows } from "../windows.mjs";
import { fail } from "../../resolve/settings.mjs";
import { flags, wantsHelp } from "../../resolve/flags.mjs";

export const WAVE_WINDOW = 10;
const RUN_ONLY = ["--against", "--since-release"];

export const WAVES_EVAL_USAGE = [
  "Usage: forge stats eval --waves [--checkout <dir>] [--size 10] [--json]",
  "The last ten folded dispatch waves against the ten before them, oldest first by fold: median",
  "minutes and calls per wave, and each window's hand-backs, replaced runs and dispositions taken",
  "without a run, with the plugin copy each wave's dispatcher ran named where the windows differ.",
  "No reading is held for waves, so neither run anchor applies.",
  "",
  "  --checkout <dir>   as for runs",
  "  --size n           waves per window; ten unless you say otherwise",
  "  --json             the comparison alone, one object",
].join("\n");

const sized = (raw) => {
  if (raw === undefined) return WAVE_WINDOW;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) fail(`stats eval --waves: --size takes an integer of 1 or more, not \`${raw}\`.`);
  return value;
};

const sum = (values) => values.reduce((many, one) => many + one, 0);

/** One window's figures off its rows, kept whole so a reader never has to recount the rows. */
export const windowOfWaves = (rows) => ({
  waves: rows.length,
  headlines: rows.map((one) => one.headline),
  summaries: rows.map((one) => one.summary),
  medianMinutes: medianOrZero(rows.map((one) => one.minutes)),
  medianCalls: medianOrZero(rows.map((one) => one.calls)),
  handBacks: sum(rows.map((one) => one.handBacks)),
  handBacksCut: rows.filter((one) => one.handBacksCut.length).length,
  replaced: sum(rows.map((one) => one.replaced.length)),
  dispositions: sum(rows.map((one) => sum(Object.values(one.dispositions)))),
  tallies: tallied(rows, [["copy", (one) => one.copy]]),
});

/** The comparison over waves already profiled, or the shortfall where two windows cannot be filled. */
export const evalWaves = (waves, size = WAVE_WINDOW) => {
  const folded = waves.filter((one) => one.state === "folded").sort((a, b) => a.to.localeCompare(b.to));
  if (folded.length < size * 2) return { size, total: folded.length, needs: size * 2 };
  const { now, before } = twoWindows(folded, size);
  return comparedWindows({
    size,
    total: folded.length,
    now: windowOfWaves(now),
    before: windowOfWaves(before),
    separates: (here, there) => shiftBetween(here.tallies, there.tallies)
      .filter((one) => one.values.some((value) => value.now !== value.before)),
  });
};

const handBacksSaid = (one) => (one.handBacksCut
  ? `at least ${one.handBacks} (${one.handBacksCut} wave(s) with history cut)`
  : String(one.handBacks));

const FIGURES = [
  ["median minutes", (one) => String(one.medianMinutes)],
  ["median calls", (one) => String(one.medianCalls)],
  ["hand-backs", handBacksSaid],
  ["replaced runs", (one) => String(one.replaced)],
  ["disposed without a run", (one) => String(one.dispositions)],
];

export const evalWavesLines = (held) => [
  `The last ${held.size} folded wave(s) against the ${held.size} before them, of ${held.total} folded.`,
  "",
  ...FIGURES.map(([name, of]) => `  ${name.padEnd(24)} ${of(held.before).padStart(8)} → ${of(held.now)}`),
  "",
  ...(held.shifts.length ? ["What separates them, before → now:", ...held.shifts.map((one) => shiftLine(one))]
    : ["Both windows ran the same plugin copies."]),
];

/** Refused before any reading: both run anchors name a reading held for runs, and none is held for waves. */
export const runAnchorRefused = (argv) => {
  const asked = RUN_ONLY.filter((flag) => argv.includes(flag));
  if (!asked.length) return;
  fail(`stats eval: --waves compares waves read now, and ${asked.join(" and ")} anchor${asked.length > 1 ? "" : "s"} `
    + "a reading held for runs, which no wave has. Run the wave comparison alone:\n  forge stats eval --waves");
};

export const printWavesEval = async (argv) => {
  if (wantsHelp(argv)) return console.log(WAVES_EVAL_USAGE);
  runAnchorRefused(argv);
  const { checkout, size, json } = flags(argv, "stats eval --waves", ["--json"], { usage: WAVES_EVAL_USAGE });
  const window = sized(size);
  const directory = checkoutFrom(checkout, "stats eval --waves");
  const held = evalWaves((await wavesRead(directory)).waves, window);
  if (json) return console.log(JSON.stringify(held, null, 2));
  if (held.needs) {
    return console.log(`${held.total} folded wave(s) held for this project; a comparison of ${window} against `
      + `${window} needs ${held.needs}.`);
  }
  for (const line of evalWavesLines(held)) console.log(line);
  return null;
};
