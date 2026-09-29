/* Which of the two ways to the deployment platform answers, and what every name typed after the verb
   is on each. One reader for the switch and one table for the names: a route a second reader could
   decide is a precedence rule with no undo, and a name in two tables is a fall-through to a
   credential the caller did not choose. A hook loads this file, so it imports nothing that loads
   more than a table. docs/cli/coolify.md. */
import { configPath, userConfig } from "../../../resolve/config.mjs";
import { chosen } from "../../../resolve/settings.mjs";
import { NO_ROUTE_KEYS } from "../../../tracker/declared/no-route.mjs";

/* Every subcommand of `forge coolify`, one row each, on both routes. A usage row, a help ask, a
   refusal's list and the verb's row in `forge -h` are all read off these, so a name added here is
   offered everywhere at once and a name typed anywhere else is a second copy that goes stale. */
const DRY_RUN = "  --dry-run        print the request that would be sent, and send nothing";
const YES = "  --yes            carry it out; without it this is refused";

/** Shared by both routes, being about the instance credential itself rather than a platform call. */
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

/** Shared by both routes as `login` is, and summarised alike on each. */
const ACCOUNTS = { name: "accounts", line: "what resolved, and from where", usage: ACCOUNTS_USAGE };

/* `writes` is not a field here: whether a subcommand acts is its route-table row's, which is also
   what decides whether a transient answer is sent again, and a second statement of it here is how a
   write comes to go out without consent. `takes` maps each flag to the argument the row sends. */
export const TRACKER_ROWS = [
  { name: "list", key: "forge_coolify.list", takes: {},
    line: "the bindings this project has: their stages, targets and health",
    usage: [
      "Usage: forge coolify list",
      "The Coolify integrations this project is bound to: each one's stages, its targets and its health.",
      "An empty answer is the tracker's own word for a project nothing deploys.",
    ] },
  { name: "targets", key: "forge_coolify.targets", takes: { integration: "integrationId" },
    line: "each target of one binding, against what the platform itself lists",
    usage: [
      "Usage: forge coolify targets [--integration I]",
      "Each target of one binding, resolved against what the platform lists.",
      "",
      "  --integration I  which binding, where the project has more than one",
    ] },
  { name: "status", key: "forge_coolify.status", takes: { integration: "integrationId" },
    line: "the latest delivery per target",
    usage: [
      "Usage: forge coolify status [--integration I]",
      "The latest delivery per target: which deployment it was, what it says, and whether the breaker is open.",
      "",
      "  --integration I  narrow to one binding rather than every one",
    ] },
  { name: "rollback-images", key: "forge_coolify.rollback_images",
    takes: { integration: "integrationId", resource: "resourceUuid" },
    line: "what a target could be rolled back to",
    usage: [
      "Usage: forge coolify rollback-images [--integration I] [--resource R]",
      "What a target could be rolled back to. An empty listing is a refusal and not an empty shelf:",
      "it also means the platform could not be reached.",
      "",
      "  --integration I  which binding, where the project has more than one",
      "  --resource R     which target, where the binding holds more than one",
    ] },
  { name: "deploy", key: "forge_coolify.deploy",
    takes: { issue: "issueId", integration: "integrationId", run: "pipelineRunId" },
    line: "dispatch every target of one binding, one build each",
    usage: [
      "Usage: forge coolify deploy [--issue ISS-45] [--integration I] [--run R] [--yes]",
      "Dispatch every target of the resolved binding, one platform build per target.",
      "",
      "  --issue ISS-45   track the deploy against that issue's own pipeline run; without it a",
      "                   binding carrying the live stage is only dispatched at the release stage",
      "  --integration I  dispatch that binding alone",
      "  --run R          an open pipeline run to dispatch under, instead of an issue",
      YES,
      DRY_RUN,
    ] },
  { name: "cancel", key: "forge_coolify.cancel",
    takes: { integration: "integrationId", deployment: "deploymentUuid" },
    line: "stop a deployment that is still queued or building",
    usage: [
      "Usage: forge coolify cancel [--integration I] [--deployment D] [--yes]",
      "Stop a deployment that is still queued or building.",
      "",
      "  --integration I  which binding, where the project has more than one",
      "  --deployment D   which deployment; without it the binding's most recent delivery",
      YES,
      DRY_RUN,
    ] },
].map((row) => ({ ...row, usage: row.usage.join("\n") }));

/** The two built-ins the tracker route answers too, each summarised as that route reads it. */
export const TRACKER_BOTH = [
  { name: "login", line: "save a Coolify instance and its token, which the other route uses", usage: LOGIN_USAGE },
  ACCOUNTS,
];

export const PIN_USAGE = [
  "Usage: forge coolify pin [--app A | --project P [--environment E]] [--yes] [--dry-run]",
  "Pin this checkout to a project of the saved instance, looked up by name, in this machine's",
  "record of the project. With neither --app nor --project, lists the projects this token can see.",
  "",
  "  --app A          an application's name or uuid; pins its project and its environment",
  "  --project P      a project's name or uuid",
  "  --environment E  narrow a --project pin to one of that project's environments",
  "  --yes            replace a different pin already recorded; without it that is refused",
  "  --dry-run        print the pin and the file it would go to, and write nothing",
].join("\n");

export const INSTANCE_ROWS = [
  { name: "login", line: "save the instance and its token, or forget them", usage: LOGIN_USAGE },
  ACCOUNTS,
  { name: "whoami", line: "the instance, the team, and what this directory is pinned to",
    usage: "Usage: forge coolify whoami\nThe instance, its version, the team, and what this directory is pinned to." },
  { name: "pin", line: "pin this checkout to a project, by an application's name or the project's", usage: PIN_USAGE },
  { name: "app", line: "list, get, logs, env list, env create, env update, restart, start, stop",
    usage: [
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
    ].join("\n") },
  { name: "deploy", line: "deploy one application, service or database by uuid",
    usage: [
      "Usage: forge coolify deploy --uuid U [--force] [--yes]",
      "Deploy one application, service or database of the pinned project.",
      "",
      "  --uuid U       what to deploy; refused where it sits outside the pin",
      "  --force        rebuild rather than reuse the cache",
      "  --yes          carry it out; without it this is refused",
      "  --dry-run      print the request that would be sent, and send nothing",
    ].join("\n") },
  { name: "deployment", line: "list, get, list-by-app, cancel",
    usage: [
      "Usage: forge coolify deployment <list|get|list-by-app|cancel> [uuid]",
      "Deployments of the pinned project's applications.",
      "",
      "  --take n       how many `list-by-app` returns",
      "  --skip n       how many it passes over first",
      "  --full         every field of one deployment, its logs among them",
      "  --yes          carry out a cancel; without it the cancel is refused",
    ].join("\n") },
  { name: "project", line: "list, get, env list",
    usage: "Usage: forge coolify project <list|get|env list> [uuid]\nThe pinned projects themselves, and their environments." },
  { name: "resource", line: "everything the pin holds, in one listing",
    usage: "Usage: forge coolify resource list\nEverything the pin holds — applications, databases and services — in one listing." },
];

/** A route's summary block: each name padded to the longest beside it, so the column is the rows'. */
export const summaryLines = (rows) => {
  const width = Math.max(...rows.map((row) => row.name.length)) + 2;
  return rows.map((row) => `  ${row.name.padEnd(width)}${row.line}`);
};

/** `a, b and c`: how a usage row names a set in prose. */
export const listed = (names) =>
  (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

export const TRACKER = "tracker";
export const INSTANCE = "instance";
export const ROUTE_MODES = [TRACKER, INSTANCE];

export const ROUTE_KEY = "coolifyRoute";
export const TO_INSTANCE = `forge doctor --coolify-route ${INSTANCE}`;
export const TO_TRACKER = `forge doctor --coolify-route ${TRACKER}`;

const DEFAULTED = "the plugin's default, this machine having chosen neither";

/** Which way answers and what said so, in the shape every keyed choice comes in. The tracker's where
 *  nothing did, that being the one this machine needs no credential of its own for; a value outside
 *  the two answers the same and is carried as `unknown`, which is what `forge doctor` names. */
export const coolifyRoute = () =>
  chosen(userConfig()[ROUTE_KEY], ROUTE_MODES, TRACKER, { source: configPath(), absent: DEFAULTED });

export const onTracker = () => coolifyRoute().value === TRACKER;

/* The name typed and the capability behind it, off the rows. Nine of the tracker tool's ten actions
   are named here — six served and three the transport refuses off its own no-route table, which is
   where a capability REST does not serve is answered, so the typed name of each is read off that
   table's key rather than listed a second time. */
export const TRACKER_SERVED = Object.fromEntries(TRACKER_ROWS.map((row) => [row.name, row.key]));

const TOOL = "forge_coolify.";

export const ROUTELESS = Object.fromEntries(NO_ROUTE_KEYS.filter((key) => key.startsWith(TOOL))
  .map((key) => [key.slice(TOOL.length).replaceAll("_", "-"), key]));

/* The tenth action, and the one name here held back by a judgement rather than by a missing route.
   The tracker serves it, and its answer is chosen from a listing whose own read does not answer for
   a healthy binding — so serving it would ask a caller for an image tag nothing here can list, and
   the route refuses a tag the platform does not list by name. */
const HELD_BACK = {
  rollback: {
    why: "it names an image tag, and the listing that tag has to be chosen from does not answer",
    instead: "forge coolify rollback-images, to read whether that listing has started answering",
  },
};

/** The names both ways answer, off the rows above. */
const BOTH_WAYS = TRACKER_BOTH.map((row) => row.name);

/** What the tracker's way answers to, which is what its usage row offers, what a help ask resolves
 *  against and what a refusal lists. One list, because a usage row built apart from the refusal's is
 *  how a verb comes to offer a name it turns away. */
export const TAKEN_HERE = [...BOTH_WAYS, ...Object.keys(TRACKER_SERVED)];

/** What the tracker's way turns away by name, in the order a usage row lists them. */
export const REFUSED_HERE = [...Object.keys(ROUTELESS), ...Object.keys(HELD_BACK)];

/** What the saved instance's way answers to, for the same three readers on that route. */
export const INSTANCE_NAMES = INSTANCE_ROWS.map((row) => row.name);

/* A write nobody asked for is refused in one sentence, built here, naming the route that would have
   taken it: the same words composed in each route's own file leave a caller who reads the refusal
   unable to tell which of the two deployment scopes `--yes` reaches. */
export const TRACKER_SCOPE = "this project's own binding on the tracker";
export const INSTANCE_SCOPE = "the saved instance, inside the project this checkout pins";

export const consentRefusal = (name, scope) =>
  `coolify ${name}: a write is refused without --yes, and it would go to ${scope}.\n`
  + `  see it first: forge coolify ${name} --dry-run`;

export const SERVED_KIND = "served";
export const ROUTELESS_KIND = "routeless";
export const HELD_BACK_KIND = "held-back";
export const BOTH_KIND = "both";
const ELSEWHERE_KIND = "elsewhere";

/** What one name is on the tracker route. Every name lands in exactly one kind, which is what lets a
 *  refusal be specific: an action the tracker has on no route this CLI declares is a different thing
 *  from one held back on a judgement, and both are different from a command that only ever belonged
 *  to the saved instance. */
export const trackerName = (name) => {
  if (BOTH_WAYS.includes(name)) return { kind: BOTH_KIND, name };
  if (Object.hasOwn(TRACKER_SERVED, name)) return { kind: SERVED_KIND, name, key: TRACKER_SERVED[name] };
  if (Object.hasOwn(ROUTELESS, name)) return { kind: ROUTELESS_KIND, name, key: ROUTELESS[name] };
  if (Object.hasOwn(HELD_BACK, name)) return { kind: HELD_BACK_KIND, name, ...HELD_BACK[name] };
  return { kind: ELSEWHERE_KIND, name };
};
