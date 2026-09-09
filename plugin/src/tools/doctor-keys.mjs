/* The keys `forge doctor` writes, and what each says once written. Beside doctor.mjs, which
   reports: a report is every finding at once and a write is one key per call. docs/cli/doctor.md. */
import { saveConfig, userConfig } from "../resolve/config.mjs";
import { RUNS_TAKES, SHIP_MODES, fail, parallelRuns } from "../resolve/settings.mjs";
import { didYouMean } from "../suggest.mjs";
import { VERB_NAMES } from "../resolve/visibility.mjs";

export const SAVED = ["token", "url"];

export const install = (values) => {
  const written = saveConfig(values);
  console.log(`Saved ${Object.keys(values).join(" and ")} to ${written} (mode 0600).\n`);
};

/* `forge chatgpt`'s two keys live under one name, and `saveConfig` merges the top level only — so
   writing the url from a bare object would drop the key beside it, and the pair is read first. */
export const CHATGPT_FLAGS = { "chatgpt-url": "url", "chatgpt-key": "key" };

export const setChatgpt = (asked) => {
  const named = Object.entries(CHATGPT_FLAGS).filter(([flag]) => asked[flag] !== undefined);
  const held = { ...(userConfig().chatgpt ?? {}) };
  for (const [flag, key] of named) held[key] = asked[flag];
  const written = saveConfig({ chatgpt: held });
  console.log(`Saved chatgpt ${named.map(([, key]) => key).join(" and ")} to ${written} (mode 0600).\n`);
};

export const setVisibility = (verb, hide) => {
  if (!VERB_NAMES.includes(verb)) fail(didYouMean("verb", verb, VERB_NAMES));
  const withheld = new Set(userConfig().withheld ?? []);
  if (hide) withheld.add(verb);
  else withheld.delete(verb);
  saveConfig({ withheld: [...withheld] });
  console.log(`${verb} is now ${hide ? "withheld from" : "offered in"} the usage list.\n`);
};

/* Whose the option is, and why: `shipMode` in resolve/settings.mjs. */
export const setShip = (mode) => {
  if (!SHIP_MODES.includes(mode)) fail(didYouMean("--ship mode", mode, SHIP_MODES));
  saveConfig({ ship: mode });
  console.log(mode === "ready"
    ? "A run on this machine now ends at a pushed branch and a landing checkpoint; the landing is another actor's.\n"
    : "A run on this machine now lands its own change, as it did before the option existed.\n");
};

// Apart from the write and before every other writer, or a refusal here follows a key another flag saved and the sentence about nothing being written is false.
export const runsGiven = (given) => {
  const held = Number(given);
  if (!Number.isInteger(held) || held < 1) {
    fail(`doctor: --runs is how many runs this machine carries at once and takes ${RUNS_TAKES}. `
      + `\`${given}\` is not one, and nothing was written.`);
  }
  return held;
};

// Read back off the file and never off the number handed in, because the file is what a gate reads.
export const setRuns = (held) => {
  saveConfig({ runs: held });
  const read = parallelRuns();
  console.log(`This machine now carries ${read.value} run(s) at once, read back from ${read.from}: a `
    + `gate that finds that many already running declines before it spends a step, and nothing else `
    + `changes.\n`);
};
