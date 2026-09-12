/* The keys `forge doctor` writes: a report is every finding at once, a write is one key. docs/cli/doctor.md. */
import { saveNested, saveConfig, userConfig } from "../resolve/config.mjs";
import { CHATGPT_KEYS, SHIP_MODES, fail } from "../resolve/settings.mjs";
import { didYouMean } from "../suggest.mjs";
import { VERB_NAMES } from "../resolve/visibility.mjs";

const SAVED = ["token", "url"];

const given = (asked, flags) => Object.fromEntries(
  flags.filter((flag) => asked[flag] !== undefined).map((flag) => [flag, asked[flag]]),
);

const install = (values) => {
  const written = saveConfig(values);
  console.log(`Saved ${Object.keys(values).join(" and ")} to ${written} (mode 0600).\n`);
};

const setChatgpt = (asked) => {
  const named = CHATGPT_KEYS.filter((row) => asked[row.flag] !== undefined);
  const written = saveNested("chatgpt", Object.fromEntries(named.map((row) => [row.key, asked[row.flag]])));
  console.log(`Saved chatgpt ${named.map((row) => row.key).join(" and ")} to ${written} (mode 0600).\n`);
};

const setVisibility = (verb, hide) => {
  if (!VERB_NAMES.includes(verb)) fail(didYouMean("verb", verb, VERB_NAMES));
  const withheld = new Set(userConfig().withheld ?? []);
  if (hide) withheld.add(verb);
  else withheld.delete(verb);
  saveConfig({ withheld: [...withheld] });
  console.log(`${verb} is now ${hide ? "withheld from" : "offered in"} the usage list.\n`);
};

/* Whose the option is, and why: `shipMode` in resolve/settings.mjs. */
const setShip = (mode) => {
  if (!SHIP_MODES.includes(mode)) fail(didYouMean("--ship mode", mode, SHIP_MODES));
  saveConfig({ ship: mode });
  console.log(mode === "ready"
    ? "A run on this machine now ends at a pushed branch and a landing checkpoint; the landing is another actor's.\n"
    : "A run on this machine now lands its own change, as it did before the option existed.\n");
};

/* Every flag that writes this machine's half, in the order the report spends them, and what each spends. The two-stores check that refuses a project flag beside one of these and the dispatch that makes the writes both read this table: they were two lists, and two releases in a row each added a key to one and to the other. A row owns the flags it writes together, because a pair saved in one call prints one line for it, and it guards its own value where its predecessor guarded on truthiness — an empty `--hide` wrote nothing before this table and writes nothing under it. */
export const MACHINE_WRITES = [
  { flags: ["hide"], write: (asked) => asked.hide && setVisibility(asked.hide, true) },
  { flags: ["show"], write: (asked) => asked.show && setVisibility(asked.show, false) },
  { flags: ["ship"], write: (asked) => asked.ship && setShip(asked.ship) },
  { flags: SAVED, write: (asked) => install(given(asked, SAVED)) },
  { flags: CHATGPT_KEYS.map((row) => row.flag), write: setChatgpt },
];

export const MACHINE_FLAGS = MACHINE_WRITES.flatMap((row) => row.flags);
