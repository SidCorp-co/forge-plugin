/* The credentials that are this machine's and a harness verb's, gating nothing: every other verb works with none of them saved, so each absence is a note. Rows out rather than printed lines, in the shape the project's rows already come in, because importing `line` from `doctor.mjs` would be a cycle. docs/cli/doctor.md. */
import { defaultEffort, disagreement, effortVia, rungFor, rungLadder } from "../../../codex/codex-plan.mjs";
import { configPath } from "../../../resolve/config.mjs";
import { logBytes, logPath } from "../../../codex/codex-log.mjs";
import { consultCount } from "../../../codex/log/asked.mjs";
import { gateway, machineRows, modelBehind } from "../../../resolve/machine/stores.mjs";
import { CONFIGURABLE, absentSaid, cloudflareAccounts, configureSaid, unconfiguredTool } from "../tool-config.mjs";
import { accountCredentials } from "../../../resolve/settings.mjs";
import { coolifyTarget, pinSaid, pinned } from "../coolify/config.mjs";
import { INSTANCE, ROUTE_KEY, ROUTE_MODES, TRACKER, coolifyRoute, onTracker } from "../coolify/chosen-route.mjs";
import { masked } from "../masked.mjs";

const cloudflareRow = (full) => {
  const { accounts, from } = cloudflareAccounts();
  const held = accounts.map((account) => `${account.name} ${masked(account.apiToken, full)}`);
  return { level: "ok", detail: `${held.join(", ")}  ← ${from}` };
};

/* The model, the level and the channel on one row: given the model alone a reader cannot tell a
   ladder from one slot frozen at a rung. */
const codexRow = () => {
  const { values } = gateway();
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

/* Off the files and never off the instance: a request would report a network fault as a missing
   credential. Which is why the tracker route's half below is asked for softly and printed as what
   the tracker said — no credential of this machine's is in play on that route, so nothing a call
   answers there can be read back as a key this file failed to find. */
const instanceRow = (full, origin) => {
  const { url, token, from } = coolifyTarget();
  return `the saved instance  ${origin}  ${url} ${masked(token, full)}  ← ${from}  pinned ${pinSaid(pinned())}`;
};

const boundSaid = (answer) => {
  if (answer?.refused) return `the tracker did not answer for them: ${answer.refused.split("\n")[0]}`;
  const bound = answer?.integrations ?? [];
  if (!bound.length) {
    return "this project is bound to nothing — an empty answer is the tracker's own word for a"
      + " project nothing deploys";
  }
  return bound.map((one) => `${(one.stages ?? []).join("+") || "no stage"} → `
    + `${(one.targets ?? []).map((two) => two.label).join(", ") || "no target"}`).join("; ");
};

/** The bindings read, started by the caller beside its other tracker reads so its round trip rides
 *  with theirs, and null where it is not asked: off the tracker route, or where this machine holds no
 *  endpoint or credential — `settings()` exits the process on either absence, and a report whose
 *  whole point is every finding at once may not stop on a key another row is already about. */
export const startBindings = () => {
  if (!onTracker()) return null;
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) return null;
  return import("../../../tracker/rest.mjs").then(({ callTool }) => callTool("forge_coolify.list", {}, true));
};

const trackerRow = async (origin, bindings) => `the tracker's own bindings  ${origin}  ${bindings
  ? boundSaid(await bindings)
  : "their listing was not asked for: this machine holds no tracker endpoint or credential"
    + " — `forge doctor --token <pat> --url <endpoint>`"}`;

/* A value the key does not take is named as every keyed choice's is, and the row goes on to say
   what the route it fell back to answered, that being what the verb does meanwhile. The sentence is
   imported where it is needed: `keys.mjs` reaches this file back through `doctor-keys.mjs`, so a
   static import would read that file's tables before they exist. */
const coolifyRow = async (full, bindings) => {
  const chosen = coolifyRoute();
  const origin = chosen.unknown === undefined ? `← ${chosen.from}`
    : `← \`${ROUTE_KEY}\`: ${(await import("./keys.mjs")).held(chosen, ROUTE_MODES)}`
      + ` — \`forge doctor --coolify-route ${TRACKER}|${INSTANCE}\`;`;
  const detail = chosen.value === TRACKER ? await trackerRow(origin, bindings) : instanceRow(full, origin);
  return { level: chosen.unknown === undefined ? "ok" : "miss", detail };
};

/* The account a call would take, as `forge google auth status` describes it, and the file it was read from.
   Imported here rather than at the top: describing an account reads the service's scope table, and
   a report on a machine that saved no Google account never reaches this row. */
const googleRow = async () => {
  const { doctorSaid } = await import("../google/auth/status.mjs");
  return { level: "ok", detail: `${doctorSaid()}  ← ${configPath()}` };
};

const SAVED = {
  cloudflare: cloudflareRow,
  coolify: coolifyRow,
  google: googleRow,
  codex: codexRow,
};

/* Worth a line only when it is what withheld the verb: configured, it says nothing the rows below do. */
const toolRow = async (verb, full, bindings) => {
  if (unconfiguredTool(verb)) {
    return { label: verb, level: "note",
      detail: `${absentSaid(verb)} — ${configureSaid(verb)}, so \`forge ${verb}\` is in no help` };
  }
  return SAVED[verb] ? { label: verb, ...(await SAVED[verb](full, bindings)) } : null;
};

/** One key said in one line, carrying the `from` the reader answered with rather than a file the
 *  caller composed: why that provenance travels at all is `resolve/machine/stores.mjs`'s
 *  (AC-01-3-1). Exported because the write that saves a key reports it in this same shape. */
export const keySaid = (row, full) => (row.value
  ? `${row.secret ? masked(row.value, full) : row.value}  ← ${row.from}`
    + (row.legacy ? `, held only there — the owner runs \`${row.route}\` once, from a shell that does`
      + " not borrow, to move it into the store a run's borrow reads"
      : "")
  : `no ${row.asks} — \`forge doctor --${row.flag} <${row.asks}>\`${row.without ? `, ${row.without}` : ""}`);

export const keyLabel = (row) => `${row.label} ${row.said ?? row.key}`;

const keyRow = (row, full, required) => ({
  label: keyLabel(row),
  level: row.value ? (row.legacy ? "note" : "ok") : (required.includes(row.store) ? "miss" : "note"),
  detail: keySaid(row, full),
});

/** `required` names the stores this checkout cannot work without: an absence there is a fault.
 *  `bindings` is what `startBindings` returned, awaited here and never sent from here. */
export const harnessLines = async (full, required = [], bindings = null) => [
  ...(await Promise.all(CONFIGURABLE.map((verb) => toolRow(verb, full, bindings)))).filter(Boolean),
  ...machineRows().map((row) => keyRow(row, full, required)),
];
