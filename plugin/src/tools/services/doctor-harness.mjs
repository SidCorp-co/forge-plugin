/* The credentials that are this machine's and a harness verb's, gating nothing: every other verb works with none of them saved, so each absence is a note. Rows out rather than printed lines, in the shape the project's rows already come in, because importing `line` from `doctor.mjs` would be a cycle. docs/cli/doctor.md. */
import { CHATGPT_KEYS, CHATGPT_PREFIX, chatgptSettings } from "../../resolve/settings.mjs";
import { modelBehind, profile } from "../../codex/codex-api.mjs";
import { defaultEffort, disagreement, effortVia, rungFor, rungLadder } from "../../codex/codex-plan.mjs";
import { configPath } from "../../resolve/config.mjs";
import { logBytes, logPath } from "../../codex/codex-log.mjs";
import { consultCount } from "../../codex/log/asked.mjs";
import { cloudflareAccounts } from "./cloudflare.mjs";
import { SCOPE_FILE, coolifyTarget, pinned } from "./coolify/config.mjs";
import { masked } from "./masked.mjs";

const cloudflareRow = (full) => {
  const { accounts, from } = cloudflareAccounts();
  if (!accounts.length) {
    return { level: "note", detail: "no account — `forge cloudflare login --name n --account-id a --token t`" };
  }
  const held = accounts.map((account) => `${account.name} ${masked(account.apiToken, full)}`);
  return { level: "ok", detail: `${held.join(", ")}  ← ${from}` };
};

/* The model, the level and the channel on one row rather than four lines apart: which of the two
   channels the effort travels on is a fact about the model that resolved, and a reader given the model
   alone cannot tell a ladder from one slot frozen at a rung. */
const codexRow = () => {
  const { problem, values } = profile();
  if (problem) return { level: "note", detail: `${problem} — \`forge codex\` cannot consult` };
  const base = defaultEffort();
  const ladder = rungLadder();
  const model = rungFor(base, modelBehind(values));
  if (!model) {
    return { level: "note",
      detail: `no \`codex.rungs\` in ${configPath()} and the profile maps that model slot to nothing` };
  }
  const entry = Object.fromEntries(ladder)[base];
  const from = entry
    ? `\`codex.rungs.${base}\` in ${configPath()}`
    : `the profile's model slot${ladder.length ? `, \`codex.rungs\` naming no ${base} rung` : ""}`;
  const said = disagreement(base, model);
  return { level: said ? "note" : "ok",
    detail: `${model} at ${base} effort on the ${effortVia(model)}  ← ${from}`
      + `${said ? `, and that id states the ${said} rung` : ""}`
      + `  ${consultCount(logBytes())} consult(s) logged at ${logPath()}` };
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

/* Its own row rather than a third part of the one above, because the value is a sentence somebody wrote and the two beside it are a host and a credential: joined, the row a reader scans for an endpoint would run to whatever length a framing was given. */
const prefixRow = () => {
  const { prefix, from } = chatgptSettings();
  return prefix
    ? { level: "ok", detail: `${prefix}  ← ${from}` }
    : { level: "note",
      detail: `no ${CHATGPT_PREFIX.asks} — \`forge doctor --${CHATGPT_PREFIX.flag} <${CHATGPT_PREFIX.asks}>\`, `
        + "which `forge chatgpt image` is refused without" };
};

/* Read off the files and never off the instance: a doctor row that made a request would report a
   network fault as a missing credential, and the pin is a property of this directory either way. */
const coolifyRow = (full) => {
  const { url, token, from } = coolifyTarget();
  if (!url) {
    return { level: "note", detail: "no instance — `forge coolify login --url u --token t`" };
  }
  const { at, spec } = pinned();
  const projects = (spec.project_uuid ?? []).join(", ");
  const pin = projects ? `project ${projects}  ← ${at}` : `no project pinned — no ${SCOPE_FILE} on the way up from here`;
  return { level: "ok", detail: `${url} ${masked(token, full)}  ← ${from}  ${pin}` };
};

export const harnessLines = (full) => [
  { label: "cloudflare", ...cloudflareRow(full) },
  { label: "coolify", ...coolifyRow(full) },
  { label: "codex", ...codexRow() },
  { label: "chatgpt", ...chatgptRow(full) },
  { label: "chatgpt framing", ...prefixRow() },
];
