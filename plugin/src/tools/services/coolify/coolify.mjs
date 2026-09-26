/* The verb itself: which of the two ways to the platform answers, the two built-ins that are the
   saved instance's credential rather than a call, and — on the instance route — the one order the
   pieces run in: resolve the operation, read its arguments against that operation's own
   declaration, put both past the guard, and only then send. docs/cli/coolify.md. */
import { configPath, saveNested } from "../../../resolve/config.mjs";
import { fail } from "../../../resolve/settings.mjs";
import { flags, helpAskedOf } from "../../../resolve/flags.mjs";
import { didYouMean } from "../../../suggest.mjs";
import { masked } from "../masked.mjs";
import { NO_TARGET, PIN_WAYS, configured, coolifyTarget, pinned } from "./config.mjs";
import { PIN_USAGE, pin } from "./pin.mjs";
import { holes, pinOnly, resolveCommand, servedNames } from "./routes.mjs";
import { ask, session, struck } from "./client.mjs";
import { active, applicationIds, check, environmentIds, filterList, label, makeScope } from "./scope.mjs";
import { hiddenNames, normalize, pickColumns, redact, renderObject, renderTable, secretsIn, striking, summarize } from "./shape.mjs";
import { readArgs } from "./args.mjs";
import {
  BOTH_KIND, HELD_BACK_KIND, INSTANCE_SCOPE, ROUTELESS_KIND, SERVED_KIND, TAKEN_HERE, TO_INSTANCE,
  TRACKER, consentRefusal, coolifyRoute, trackerName,
} from "./chosen-route.mjs";
import { noRouteRefusal } from "../../../tracker/declared/no-route.mjs";

export const USAGE = [
  "Usage: forge coolify <login|accounts|whoami|pin|app|deploy|deployment|project|resource> [args]",
  "A pinned project's deployments, on the instance `login` saved locally. Every resource command",
  "runs inside the project `pin` recorded for this checkout and refuses anything outside it.",
  "",
  "  login       save the instance and its token, or forget them",
  "  accounts    what resolved, and from where",
  "  whoami      the instance, the team, and what this directory is pinned to",
  "  pin         pin this checkout to a project, by an application's name or the project's",
  "  app         list, get, logs, env list, env create, env update, restart, start, stop",
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
  "Usage: forge coolify app <list|get|logs|env list|env create|env update|restart|start|stop> [uuid] [args]",
  "Applications of the pinned project. A uuid outside it is refused before anything is sent.",
  "",
  "  --key K        which environment variable, on `env create` and `env update`",
  "  --value V      what to set it to; masked in what --dry-run prints unless --reveal",
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
  pin: PIN_USAGE,
  app: APP_USAGE,
  deploy: DEPLOY_USAGE,
  deployment: DEPLOYMENT_USAGE,
  project: PROJECT_USAGE,
  resource: RESOURCE_USAGE,
};

const noPin = (from) =>
  `coolify: no project is pinned for ${from}, and there is no unscoped mode.\n`
  + "  every resource command runs inside the project this machine's record of the checkout pins\n"
  + `  pin one:\n${PIN_WAYS.join("\n")}`;

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
  const { at, spec, record } = pinned();
  console.log(`instance  ${target.url}`);
  console.log(`token     ${masked(target.token, full)}  ← ${target.from}`);
  console.log(at ? `pinned    ${spec.project_uuid.join(", ")}  ← ${at}`
    : `pinned    nothing${record ? ` in ${record}` : ", this directory belonging to no checkout"}`);
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
  const recorded = pinned();
  const scope = makeScope(held, recorded);
  if (!active(scope)) {
    console.log(`scope     none — every resource command refuses here\n${noPin(process.cwd())}`);
    return;
  }
  const ids = [...(await environmentIds(scope))].sort((one, two) => Number(one) - Number(two));
  console.log(`scope     project ${label(scope)}, environment ids ${ids.join(", ") || "(none)"}  ← ${recorded.at}`);
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

const emit = (answer, { group, dropped, unplaced, held, token, secrets }) => {
  if (answer === null) return;
  /* An answer can quote the request back, so what the caller wrote is struck out of it beside our
     own credential, and by the same walk: a value re-escaped into a rendered line is past striking
     once the line exists. The structural rule still runs first, being what hides what we never sent. */
  const data = striking(held.reveal ? normalize(answer) : redact(normalize(answer)), [token, ...secrets]);
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
  const held = session(target, { dryRun: Boolean(switches["dry-run"]), reveal: Boolean(switches.reveal) });
  const scope = makeScope(held, pinned());
  if (!active(scope)) fail(noPin(process.cwd()));
  const { path, query, body, values } = readArgs(found.entry, found.rest);
  const secrets = switches.reveal ? [] : secretsIn(body);
  refuseLooseSelectors(found.entry, values);
  await check(scope, found.entry.scope, values);
  if (found.entry.method !== "GET" && !switches.yes && !switches["dry-run"]) {
    fail(consentRefusal(found.name, INSTANCE_SCOPE));
  }
  const answer = await ask(held, found.entry.method, path, { query, body, secrets, cache: found.entry.method === "GET" });
  const cut = await filterList(scope, found.entry.returns, answer, { mustFilter: pinOnly(found.entry) });
  emit(cut.kept, { group: found.group, dropped: cut.dropped, unplaced: cut.unplaced, held: switches, token: target.token, secrets });
};

const BUILTIN = { login: saveTarget, accounts: showTarget, whoami, pin };

/* Whether the other route has this name at all, asked of that route's own index and its own
   built-ins rather than of a list kept here. A word neither route serves is not the other route's,
   and telling a caller to switch credentials for one costs a command and answers nothing. */
const onInstance = (name) => Object.hasOwn(BUILTIN, name) || resolveCommand([name]).kind !== "group";

/* Both refusals end here, so the one thing a caller can do about either is on both of them. */
const said = (lines) => fail(`${lines.join("\n")}\n  the saved instance and its own commands: ${TO_INSTANCE}`);

/* Refused before anything is sent, with the sentence the kind `chosen-route.mjs` put the name in
   earns. Each returns, though `fail` does not come back: a reader should not have to know that to
   see that one sentence is printed and not three. */
const refuseOffTracker = (found) => {
  if (found.kind === ROUTELESS_KIND) return said([noRouteRefusal(found.key)]);
  if (found.kind === HELD_BACK_KIND) {
    return said([`coolify: the tracker serves \`${found.name}\` and this CLI does not offer it, `
      + `because ${found.why}.`,
    `  ${found.instead}`]);
  }
  if (!onInstance(found.name)) {
    fail(`coolify: ${didYouMean("command", found.name, TAKEN_HERE)}`);
  }
  return said([`coolify: \`${found.name}\` is a command of the saved instance, which is not the `
    + "route answering here.",
  `  what this route takes: ${TAKEN_HERE.join(", ")}`]);
};

const overTracker = async ([sub, ...rest]) => {
  const { TRACKER_SAYS, TRACKER_USAGE, runTracker } = await import("./tracker.mjs");
  const help = helpAskedOf([sub, ...rest], TAKEN_HERE);
  if (help?.subject) {
    console.log(TRACKER_SAYS[help.subject] ?? SAYS[help.subject] ?? TRACKER_USAGE);
    process.exit(0);
  }
  if (sub === undefined) {
    console.error(TRACKER_USAGE);
    process.exit(1);
  }
  const found = trackerName(sub);
  if (found.kind === BOTH_KIND) return BUILTIN[sub](rest);
  if (found.kind !== SERVED_KIND) refuseOffTracker(found);
  await runTracker(found.name, found.key, rest);
};

export const coolify = async (argv) => {
  if (coolifyRoute().mode === TRACKER) return overTracker(argv);
  const [sub, ...rest] = argv;
  const help = helpAskedOf(argv, Object.keys(SAYS));
  if (help?.subject) {
    console.log(SAYS[help.subject] ?? USAGE);
    process.exit(0);
  }
  if (sub === undefined) {
    console.error(USAGE);
    process.exit(1);
  }
  if (Object.hasOwn(BUILTIN, sub)) return BUILTIN[sub](rest);
  await routed(argv);
};
