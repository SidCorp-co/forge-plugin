/* The credentials that are this machine's and a harness verb's, gating nothing: every other verb
   works with none of them saved, so each absence is a note. Rows out rather than printed lines,
   because importing `line` from `doctor.mjs` would be a cycle. docs/cli/doctor.md. */
import { userConfig } from "../resolve/config.mjs";
import { modelBehind, profile } from "../codex/codex-api.mjs";
import { consults, logEntries, logPath } from "../codex/codex-log.mjs";
import { cloudflareAccounts } from "./cloudflare.mjs";

export const masked = (token, full) => {
  const bare = token.replace(/^Bearer /u, "");
  if (!full) return `set (${bare.length} chars)`;
  return bare.length <= 12 ? "set" : `${bare.slice(0, 6)}…${bare.slice(-4)} (${bare.length} chars)`;
};

const cloudflareRow = (full) => {
  const { accounts, from } = cloudflareAccounts();
  if (!accounts.length) {
    return { ok: false, detail: "no account — `forge cloudflare login --name n --account-id a --token t`" };
  }
  const held = accounts.map((account) => `${account.name} ${masked(account.apiToken, full)}`);
  return { ok: true, detail: `${held.join(", ")}  ← ${from}` };
};

const codexRow = () => {
  const { problem, values } = profile();
  if (problem) return { ok: false, detail: `${problem} — \`forge codex\` cannot consult` };
  const model = modelBehind(values);
  if (!model) return { ok: false, detail: "the profile maps that model slot to nothing" };
  return { ok: true, detail: `${model}  ${consults(logEntries()).length} consult(s) logged at ${logPath()}` };
};

/* The endpoint whole and the key masked: one is a host somebody has to check against the backend
   they meant, the other a credential no report needs the value of. */
const chatgptRow = (full) => {
  const held = userConfig().chatgpt ?? {};
  const url = held.url ? held.url : "no endpoint — `forge doctor --chatgpt-url <endpoint>`";
  const key = held.key ? masked(held.key, full) : "no key — `forge doctor --chatgpt-key <key>`";
  return { ok: Boolean(held.url && held.key), detail: `${url}  ${key}` };
};

export const harnessLines = (full) => [
  { label: "cloudflare", ...cloudflareRow(full) },
  { label: "codex", ...codexRow() },
  { label: "chatgpt", ...chatgptRow(full) },
];
