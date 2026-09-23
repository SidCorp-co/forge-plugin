/* Every value a harness service needs that is this MACHINE's rather than a project's: the store that
   holds it, the flag that writes it, whether it is a credential, and — for the two tools that had a
   file before this plugin did — which field of which file answers where this one does not. One table,
   a store declared beside it being the third file a new machine has to fill. docs/cli/settings.md. */
import { join } from "node:path";

import { configDir, configPath, readJson, userConfig } from "../config.mjs";
import { profileValues } from "./profile.mjs";

const viPath = () => join(configDir("vi-natural"), "config.json");

const PROFILE = {
  read: profileValues,
  fields: { url: "ANTHROPIC_BASE_URL", key: "ANTHROPIC_AUTH_TOKEN" },
};

const VI_FILE = {
  read: () => ({ path: viPath(), values: readJson(viPath()) }),
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
];

const storeOf = (name) => STORES.find((one) => one.store === name) ?? null;

const saved = (value) => (typeof value === "string" && value.trim() ? value : null);

/** One key's value and the file that answered for it: the plugin's own configuration first, the
 *  tool's own file where that key is unset. A precedence rule with no report of which layer won is
 *  a broken undo, which is why `from` travels with every value (BR-08). */
export const machineValue = (name, key) => {
  const held = saved(userConfig()[name]?.[key]);
  if (held) return { value: held, from: configPath() };
  const behind = storeOf(name)?.behind;
  const field = behind?.fields[key];
  if (!field) return { value: null, from: null };
  const { path, values } = behind.read();
  const fallen = saved(values?.[field]);
  return fallen ? { value: fallen, from: path } : { value: null, from: null };
};

const gating = (row) => row.keys.filter((one) => one.gates !== false);

export const storeHeld = (name) =>
  gating(storeOf(name)).every((one) => machineValue(name, one.key).value);

export const storeMissing = (name) =>
  gating(storeOf(name)).filter((one) => !machineValue(name, one.key).value);

export const machineRows = () => STORES.flatMap((row) =>
  row.keys.map((one) => ({ ...one, store: row.store, label: row.label, ...machineValue(row.store, one.key) })));

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

export const modelBehind = (values, slot = modelSlot()) =>
  values?.[`ANTHROPIC_DEFAULT_${slot.toUpperCase()}_MODEL`] ?? null;

const ROUTE = "`forge doctor --codex-url <endpoint> --codex-key <key>`";

/** The gateway a consult is sent to, in the shape the request already takes it — the profile's pairs
 *  with the plugin's own configuration written over the two it answers for, so the model slots
 *  beside them still resolve — and the file that answered for each of the two. */
export const gateway = () => {
  const url = machineValue("codex", "url");
  const key = machineValue("codex", "key");
  const { path, values } = profileValues();
  const absent = [!url.value && "no gateway endpoint", !key.value && "no credential for it"].filter(Boolean);
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
      ? `${absent.join(" and ")} — ${ROUTE}, or ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN in ${path}`
      : null,
  };
};
