/* The keys `forge doctor` writes: a report is every finding at once, a write is one key. docs/cli/doctor.md. */
import { saveConfig, userConfig } from "../resolve/config.mjs";
import { SHIP_MODES, fail } from "../resolve/settings.mjs";
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
