/* The credentials that are this machine's and a harness verb's, gating nothing: every other verb works with none of them saved, so each absence is a note. Rows out rather than printed lines, in the shape the project's rows already come in, because importing `line` from `doctor.mjs` would be a cycle. docs/cli/doctor.md. */
import { CHATGPT_KEYS, chatgptSettings } from "../../resolve/settings.mjs";
import { modelBehind, profile } from "../../codex/codex-api.mjs";
import { consults, logEntries, logPath } from "../../codex/codex-log.mjs";
import { cloudflareAccounts } from "./cloudflare.mjs";
import { masked } from "./masked.mjs";

const cloudflareRow = (full) => {
  const { accounts, from } = cloudflareAccounts();
  if (!accounts.length) {
    return { level: "note", detail: "no account — `forge cloudflare login --name n --account-id a --token t`" };
  }
  const held = accounts.map((account) => `${account.name} ${masked(account.apiToken, full)}`);
  return { level: "ok", detail: `${held.join(", ")}  ← ${from}` };
};

const codexRow = () => {
  const { problem, values } = profile();
  if (problem) return { level: "note", detail: `${problem} — \`forge codex\` cannot consult` };
  const model = modelBehind(values);
  if (!model) return { level: "note", detail: "the profile maps that model slot to nothing" };
  return { level: "ok", detail: `${model}  ${consults(logEntries()).length} consult(s) logged at ${logPath()}` };
};

const chatgptRow = (full) => {
  const held = chatgptSettings();
  /* The endpoint whole and the key masked: one is a host somebody has to check against the backend they meant, the other a credential no report needs the value of. */
  const shown = { url: (value) => value, key: (value) => masked(value, full) };
  /* Off the settings this row already holds and not `missing`'s membership, which holds the very row objects `CHATGPT_KEYS` declares: the same answer through a coupling a `chatgptSettings` that ever copied its rows would break in silence. */
  const parts = CHATGPT_KEYS.map((row) => (!held[row.key]
    ? `no ${row.asks} — \`forge doctor --${row.flag} <${row.asks}>\``
    : shown[row.key](held[row.key])));
  return { level: held.missing.length ? "note" : "ok", detail: parts.join("  ") };
};

export const harnessLines = (full) => [
  { label: "cloudflare", ...cloudflareRow(full) },
  { label: "codex", ...codexRow() },
  { label: "chatgpt", ...chatgptRow(full) },
];
