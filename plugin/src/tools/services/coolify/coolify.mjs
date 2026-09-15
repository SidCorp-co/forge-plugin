/* The verb itself: its usage texts, the two built-ins that need no instance behind them, and the
   one order the pieces run in — resolve the operation, read its arguments against that operation's
   own declaration, put both past the guard, and only then send. docs/cli/coolify.md. */
import { configPath, saveNested } from "../../../resolve/config.mjs";
import { fail } from "../../../resolve/settings.mjs";
import { flags, helpAskedOf } from "../../../resolve/flags.mjs";
import { didYouMean } from "../../../suggest.mjs";
import { masked } from "../masked.mjs";
import { NO_TARGET, SCOPE_FILE, coolifyTarget, pinned } from "./config.mjs";
import { holes, pinOnly, resolveCommand, servedNames } from "./routes.mjs";
import { ask, session, struck } from "./client.mjs";
import { active, applicationIds, check, environmentIds, filterList, label, makeScope } from "./scope.mjs";
import { hiddenNames, normalize, pickColumns, redact, renderObject, renderTable, summarize } from "./shape.mjs";
import { readArgs } from "./args.mjs";

export const USAGE = [
  "Usage: forge coolify <login|accounts|whoami|app|deploy|deployment|project|resource> [args]",
  "A pinned project's deployments, on the instance `login` saved locally. Every resource command",
  "runs inside the project `.coolify.json` names and refuses anything outside it.",
  "",
  "  login       save the instance and its token, or forget them",
  "  accounts    what resolved, and from where",
  "  whoami      the instance, the team, and what this directory is pinned to",
  "  app         list, get, logs, env list, restart, start, stop",
  "  deploy      deploy one application, service or database by uuid",
  "  deployment  list, get, list-by-app, cancel",
  "  project     list, get, env list",
  "  resource    everything the pin holds, in one listing",
  "",
  "  apps, logs, env, restart, start, stop, deployments, projects, ps are short for the above.",
  "  --dry-run prints the request and sends nothing; a write needs --yes; --reveal unmasks a",
  "  secret; --full prints a whole object; --json and --table choose the shape.",
].join("\n");

const LOGIN_USAGE = [
  "Usage: forge coolify login --url U --token T | --forget",
  "Save the instance and its API token locally, at 0600, or drop them.",
  "",
  "  --url U        the instance, with or without its /api/v1 tail",
  "  --token T      an API token made under Keys & Tokens",
  "  --forget       drop what is saved",
].join("\n");

const ACCOUNTS_USAGE = [
  "Usage: forge coolify accounts [--full]",
  "What resolved and from where; the token is masked unless you ask.",
  "",
  "  --full         the ends of the token rather than its length alone",
].join("\n");

const WHOAMI_USAGE = "Usage: forge coolify whoami\nThe instance, its version, the team, and what this directory is pinned to.";

const APP_USAGE = [
  "Usage: forge coolify app <list|get|logs|env list|restart|start|stop> [uuid] [args]",
  "Applications of the pinned project. A uuid outside it is refused before anything is sent.",
  "",
  "  --lines n      how many log lines `logs` asks for",
  "  --full         every field of one application rather than the summary",
  "  --reveal       print a masked value as it stands",
  "  --yes          carry out a write; without it a write is refused",
  "  --dry-run      print the request that would be sent, and send nothing",
].join("\n");

const DEPLOY_USAGE = [
  "Usage: forge coolify deploy --uuid U [--force] [--yes]",
  "Deploy one application, service or database of the pinned project.",
  "",
  "  --uuid U       what to deploy; refused where it sits outside the pin",
  "  --force        rebuild rather than reuse the cache",
  "  --yes          carry it out; without it this is refused",
  "  --dry-run      print the request that would be sent, and send nothing",
].join("\n");

const DEPLOYMENT_USAGE = [
  "Usage: forge coolify deployment <list|get|list-by-app|cancel> [uuid]",
  "Deployments of the pinned project's applications.",
  "",
  "  --take n       how many `list-by-app` returns",
  "  --skip n       how many it passes over first",
  "  --full         every field of one deployment, its logs among them",
  "  --yes          carry out a cancel; without it the cancel is refused",
].join("\n");

const PROJECT_USAGE = "Usage: forge coolify project <list|get|env list> [uuid]\nThe pinned projects themselves, and their environments.";

const RESOURCE_USAGE = "Usage: forge coolify resource list\nEverything the pin holds — applications, databases and services — in one listing.";

export const SAYS = {
  login: LOGIN_USAGE,
  accounts: ACCOUNTS_USAGE,
  whoami: WHOAMI_USAGE,
  app: APP_USAGE,
  deploy: DEPLOY_USAGE,
  deployment: DEPLOYMENT_USAGE,
  project: PROJECT_USAGE,
  resource: RESOURCE_USAGE,
};

const noPin = (from) =>
  `coolify: no project is pinned for ${from}, and there is no unscoped mode.\n`
  + `  every resource command runs inside the project ${SCOPE_FILE} names, found by walking up from here\n`
  + `  write one: {"project_uuid": "<the project's uuid>"}`;

const SWITCHES = ["--dry-run", "--yes", "--full", "--reveal", "--json", "--table"];

/* The verb's own switches out of the way first, wherever they sit, so what is left is the operation's
   own arguments and a flag it does not declare can be refused by name rather than swallowed here. */
const pullSwitches = (argv) => {
  const held = {};
  const rest = argv.filter((one) => {
    if (!SWITCHES.includes(one)) return true;
    held[one.slice(2)] = true;
    return false;
  });
  return { held, rest };
};

const saveTarget = (argv) => {
  const { url, token, forget } = flags(argv, "coolify login", ["--forget"], { usage: LOGIN_USAGE, secret: ["--token"] });
  if (forget) {
    saveNested("coolify", { url: null, apiToken: null });
    console.log(`Dropped the Coolify instance and its token from ${configPath()}`);
    return;
  }
  if (!url || !token) fail("coolify login needs --url and --token, or --forget.");
  saveNested("coolify", { url, apiToken: token });
  console.log(`Saved ${url} to ${configPath()} (0600).`);
};

const showTarget = (argv) => {
  const { full } = flags(argv, "coolify accounts", ["--full"], { usage: ACCOUNTS_USAGE });
  const target = coolifyTarget();
  if (!target.url) {
    console.log(NO_TARGET);
    return;
  }
  const { at, spec } = pinned();
  console.log(`instance  ${target.url}`);
  console.log(`token     ${masked(target.token, full)}  ← ${target.from}`);
  console.log(at ? `pinned    ${(spec.project_uuid ?? []).join(", ") || "no project"}  ← ${at}` : `pinned    no ${SCOPE_FILE} on the way up from here`);
};

const configured = () => {
  const target = coolifyTarget();
  if (!target.url) fail(NO_TARGET);
  return target;
};

const whoami = async (argv) => {
  flags(argv, "coolify whoami", [], { usage: WHOAMI_USAGE });
  const held = session(configured(), {});
  const token = held.target.token;
  const version = await ask(held, "GET", "/version");
  const team = await ask(held, "GET", "/teams/current");
  say(token, `instance  ${held.target.url}`);
  say(token, `version   ${String(version).trim()}`);
  if (team && typeof team === "object") say(token, `team      ${team.name} (id ${team.id})`);
  const pin = pinned();
  const scope = makeScope(held, pin);
  if (!active(scope)) {
    console.log(`scope     none — every resource command refuses here\n${noPin(process.cwd())}`);
    return;
  }
  const ids = [...(await environmentIds(scope))].sort((one, two) => Number(one) - Number(two));
  console.log(`scope     project ${label(scope)}, environment ids ${ids.join(", ") || "(none)"}  ← ${pin.at}`);
  console.log(`apps      ${(await applicationIds(scope)).size} in scope`);
};

const refuseUnserved = (found) => {
  if (found.kind === "group") {
    fail(`coolify: ${didYouMean("group", found.unknown, [...new Set(servedNames().map((one) => one.split(" ")[0]))])}`);
  }
  if (found.kind === "unserved") {
    fail(`coolify: \`${found.unknown}\` is in the route index but is not one of the operations this verb serves.\n`
      + `  what it serves: ${servedNames().join(", ")}`);
  }
  fail(`coolify: ${didYouMean("command", found.unknown, servedNames())}`);
};

/* A tag spans projects, and on an operation that acts there is no answer to cut down afterwards,
   so the pin can vouch for nothing it selects. The Python warns and sends anyway. */
const refuseLooseSelectors = (entry, values) => {
  const loose = holes(entry).filter((one) => values[one] !== undefined);
  if (!loose.length) return;
  const flag = `--${loose[0]}`;
  fail(`coolify ${entry.name}: ${flag} names resources the pin cannot be checked against, so it is refused.\n`
    + "  name what to act on with --uuid instead");
};

/* Everything this verb prints goes through here. `--reveal` unmasks what the platform calls a
   secret; it never unmasks OUR credential, and a log line or a `message` echoing the header back is
   how that would otherwise reach a transcript — and from a transcript a review or a comment. */
const say = (token, text, stream = console.log) => stream(struck(text, token));

const rendered = (shown, asTable) => {
  if (Array.isArray(shown)) {
    const rows = shown.filter((one) => one && typeof one === "object");
    if (!rows.length) return asTable ? "(none)" : "[]";
    if (asTable) return `${renderTable(rows, pickColumns(rows))}\n${rows.length} item(s)`;
    return JSON.stringify(shown, null, 2);
  }
  if (shown && typeof shown === "object") {
    return asTable ? renderObject(shown) : JSON.stringify(shown, null, 2);
  }
  return String(shown);
};

const emit = (answer, { group, dropped, unplaced, held, token }) => {
  if (answer === null) return;
  const data = held.reveal ? normalize(answer) : redact(normalize(answer));
  const asTable = held.table || (process.stdout.isTTY && !held.json);
  const shown = held.full ? data : summarize(data, group);
  const hidden = held.full ? [] : hiddenNames(data, shown);
  say(token, rendered(shown, asTable));
  if (hidden.length) {
    say(token, `${hidden.length} field(s) hidden by the summary — --full for: ${hidden.join(", ")}`, console.error);
  }
  if (dropped) console.error(`${dropped} item(s) outside the pinned scope filtered out`);
  if (unplaced) {
    console.error(`${unplaced} item(s) answered without the field that places them in a project, `
      + "and nothing but this filter holds this listing to the pin, so they are not shown");
  }
};

const routed = async (argv) => {
  const { held: switches, rest } = pullSwitches(argv);
  const found = resolveCommand(rest);
  if (found.unknown !== undefined) refuseUnserved(found);
  const target = configured();
  const pin = pinned();
  const held = session(target, { dryRun: Boolean(switches["dry-run"]) });
  const scope = makeScope(held, pin);
  if (!active(scope)) fail(noPin(process.cwd()));
  const { path, query, body, values } = readArgs(found.entry, found.rest);
  refuseLooseSelectors(found.entry, values);
  await check(scope, found.entry.scope, values);
  if (found.entry.method !== "GET" && !switches.yes && !switches["dry-run"]) {
    fail(`coolify ${found.name}: a write is refused without --yes.\n`
      + `  see it first: forge coolify ${found.name} --dry-run`);
  }
  const answer = await ask(held, found.entry.method, path, { query, body, cache: found.entry.method === "GET" });
  const cut = await filterList(scope, found.entry.returns, answer, { mustFilter: pinOnly(found.entry) });
  emit(cut.kept, { group: found.group, dropped: cut.dropped, unplaced: cut.unplaced, held: switches, token: target.token });
};

const BUILTIN = { login: saveTarget, accounts: showTarget, whoami };

export const coolify = async ([sub, ...rest]) => {
  const help = helpAskedOf([sub, ...rest], Object.keys(SAYS));
  if (help?.subject) {
    console.log(SAYS[help.subject] ?? USAGE);
    process.exit(0);
  }
  if (sub === undefined) {
    console.error(USAGE);
    process.exit(1);
  }
  if (Object.hasOwn(BUILTIN, sub)) return BUILTIN[sub](rest);
  await routed([sub, ...rest]);
};
