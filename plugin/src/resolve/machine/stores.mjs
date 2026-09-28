/* Every value a harness service needs that is this MACHINE's rather than a project's: the store that
   holds it, the flag that writes it, whether it is a credential, and — for the two tools that had a
   file before this plugin did — which field of which file answers where this one does not. One table,
   a store declared beside it being the third file a new machine has to fill. docs/cli/settings.md. */
import { dirname, join } from "node:path";

import { configDir, configPath, configSource, readJson, userConfig } from "../config.mjs";
import { borrowing } from "./borrowed.mjs";
import { profileValues, unfollowedSaid } from "./profile.mjs";

/* The legacy file sits beside whichever `configPath()` answers for this call: this machine's own
   `~/.config/forge/config.json` under an ordinary run, or — under a borrowed run home — the file
   FORGE_BORROW_FROM names, read at the moment of use and never copied, so a run reaches a key this
   project's own store never held without a home of its own ever holding a copy of it (ISS-2840).
   Unborrowed, this is the same path `configDir("vi-natural")` always was. */
const viPath = () => {
  const borrow = borrowing(configPath());
  return borrow
    ? join(dirname(dirname(borrow.path)), "vi-natural", "config.json")
    : join(configDir("vi-natural"), "config.json");
};

const PROFILE = {
  read: profileValues,
  fields: { url: "ANTHROPIC_BASE_URL", key: "ANTHROPIC_AUTH_TOKEN" },
};

/* `legacy` marks a file this project's own store supersedes, so a value answered from it is one
   `forge doctor` can single out with the route that moves it — unlike `PROFILE`, an external shim's
   own file that is never migrated off. */
const VI_FILE = {
  legacy: true,
  /* One call to `viPath()`, not two: a second borrow read between them could hand `path` and
     `values` two different layouts, naming one file while answering from another. */
  read: () => {
    const path = viPath();
    return { path, values: readJson(path) };
  },
  fields: { url: "base_url", key: "api_key", model: "model" },
};

/* The flag is on the row, two of these stores being spelled differently on a command line than in a
   file; `gates` false is a value the verb runs without. */
export const STORES = [
  {
    store: "codex",
    label: "codex",
    behind: PROFILE,
    keys: [
      { key: "url", flag: "codex-url", asks: "endpoint" },
      { key: "key", flag: "codex-key", asks: "key", secret: true },
    ],
  },
  {
    store: "vi",
    label: "vi-natural",
    behind: VI_FILE,
    keys: [
      { key: "url", flag: "vi-url", asks: "endpoint" },
      { key: "key", flag: "vi-key", asks: "key", secret: true },
      { key: "model", flag: "vi-model", asks: "id" },
    ],
  },
  {
    store: "chatgpt",
    label: "chatgpt",
    behind: null,
    keys: [
      { key: "url", flag: "chatgpt-url", asks: "endpoint" },
      { key: "key", flag: "chatgpt-key", asks: "key", secret: true },
      { key: "prefix", flag: "chatgpt-prefix", asks: "framing", gates: false, said: "framing",
        without: "which `forge chatgpt image` is refused without" },
    ],
  },
  /* The provider that bills a Claude token, and the only thing `forge stats surface` takes a token
     count from; no gateway file stands behind it, a gateway's own count being another provider's. */
  {
    store: "anthropic",
    label: "anthropic",
    behind: null,
    keys: [
      { key: "key", flag: "anthropic-key", asks: "key", secret: true },
      { key: "url", flag: "anthropic-url", asks: "endpoint", gates: false, said: "endpoint",
        without: "which reads Anthropic's own origin where it is unset" },
    ],
  },
];

const storeOf = (name) => STORES.find((one) => one.store === name) ?? null;

const saved = (value) => (typeof value === "string" && value.trim() ? value : null);

/** One key's value and the file that answered for it: the plugin's own configuration first, the
 *  tool's own file where that key is unset. A precedence rule with no report of which layer won is
 *  a broken undo, which is why `from` travels with every value (BR-08). `legacy` rides along only
 *  where the fallback file is one this project's own store supersedes, so a reader can single it
 *  out without also flagging the codex profile, which is never migrated off. */
export const machineValue = (name, key) => {
  const held = saved(userConfig()[name]?.[key]);
  if (held) return { value: held, from: configSource(`${name}.${key}`) };
  const behind = storeOf(name)?.behind;
  const field = behind?.fields[key];
  if (!field) return { value: null, from: null };
  const { path, values, from } = behind.read();
  const fallen = saved(values?.[field]);
  return fallen
    ? { value: fallen, from: from?.[field] ?? path, ...(behind.legacy ? { legacy: true } : {}) }
    : { value: null, from: null };
};

/** The one call that moves a store's keys off whatever file answered for them and into this
 *  machine's own configuration, spelled once so `doctor-keys.mjs`'s write route and a legacy-sourced
 *  row's note never drift apart (ISS-2840). */
export const storeRoute = (store) =>
  `forge doctor ${store.keys.map((row) => `--${row.flag} <${row.asks}>`).join(" ")}`;

const gating = (row) => row.keys.filter((one) => one.gates !== false);

export const storeHeld = (name) =>
  gating(storeOf(name)).every((one) => machineValue(name, one.key).value);

export const storeMissing = (name) =>
  gating(storeOf(name)).filter((one) => !machineValue(name, one.key).value);

export const machineRows = () => STORES.flatMap((row) =>
  row.keys.map((one) => ({
    ...one, store: row.store, label: row.label, route: storeRoute(row), ...machineValue(row.store, one.key),
  })));

export const SECRET_FLAGS = STORES.flatMap((row) =>
  row.keys.filter((one) => one.secret).map((one) => `--${one.flag}`));

const CHATGPT = storeOf("chatgpt");

export const CHATGPT_KEYS = gating(CHATGPT);
export const CHATGPT_PREFIX = CHATGPT.keys.find((one) => one.key === "prefix");

export const chatgptSettings = () => {
  const held = Object.fromEntries(CHATGPT.keys.map((one) => [one.key, machineValue("chatgpt", one.key)]));
  return {
    url: held.url.value,
    key: held.key.value,
    prefix: held.prefix.value,
    from: held.prefix.from ?? held.url.from ?? held.key.from,
    missing: storeMissing("chatgpt"),
  };
};

/* The rung table sits in front of the slot and the profile decides which model the slot is, which is
   the whole reason this is a second opinion and not an echo. It is the one gateway value that stays
   the shim's: that same name is what Claude Code reads to spawn a subagent. */
export const modelSlot = () => userConfig().codex?.model || "fable";

/* The profile's key for a slot, spelled once: the lookup builds it and the list of slots parses it. */
const [SLOT_HEAD, SLOT_TAIL] = ["ANTHROPIC_DEFAULT_", "_MODEL"];
const SLOT_KEY = new RegExp(`^${SLOT_HEAD}([A-Z0-9_]+)${SLOT_TAIL}$`, "u");

export const modelBehind = (values, slot = modelSlot()) =>
  values?.[`${SLOT_HEAD}${slot.toUpperCase()}${SLOT_TAIL}`] ?? null;

/** The slots a profile holds, by the name a person types: `haiku` for `ANTHROPIC_DEFAULT_HAIKU_MODEL`. */
export const slotsIn = (values) => Object.keys(values ?? {})
  .map((key) => SLOT_KEY.exec(key)?.[1]?.toLowerCase())
  .filter(Boolean)
  .sort();

const ROUTE = "`forge doctor --codex-url <endpoint> --codex-key <key>`";

/** The gateway a consult is sent to, in the shape the request already takes it — the profile's pairs
 *  with the plugin's own configuration written over the two it answers for, so the model slots
 *  beside them still resolve — and the file that answered for each of the two. */
export const gateway = () => {
  const url = machineValue("codex", "url");
  const key = machineValue("codex", "key");
  const { path, values, unfollowed } = profileValues();
  const absent = [!url.value && "no gateway endpoint", !key.value && "no credential for it"].filter(Boolean);
  const skipped = unfollowed.length ? `; it sources what this reader did not follow: ${unfollowedSaid(unfollowed, path)}` : "";
  return {
    url,
    key,
    path,
    values: {
      ...(values ?? {}),
      ...(url.value ? { ANTHROPIC_BASE_URL: url.value } : {}),
      ...(key.value ? { ANTHROPIC_AUTH_TOKEN: key.value } : {}),
    },
    problem: absent.length
      ? `${absent.join(" and ")} — ${ROUTE}, or ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN in ${path}${skipped}`
      : null,
  };
};
