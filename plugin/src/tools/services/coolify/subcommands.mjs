/* Every subcommand of `forge coolify`, one row each, on both routes. A usage row, a help ask, a
   refusal's list and the verb's row in `forge -h` are all read off these, so a name added here is
   offered everywhere at once and a name typed anywhere else is a second copy that goes stale.
   Nothing is imported: a hook loads this through `chosen-route.mjs`. docs/cli/coolify.md. */

const DRY_RUN = "  --dry-run        print the request that would be sent, and send nothing";
const YES = "  --yes            carry it out; without it this is refused";

/** Shared by both routes, being about the instance credential itself rather than a platform call. */
export const LOGIN_USAGE = [
  "Usage: forge coolify login --url U --token T | --forget",
  "Save the instance and its API token locally, at 0600, or drop them.",
  "",
  "  --url U        the instance, with or without its /api/v1 tail",
  "  --token T      an API token made under Keys & Tokens",
  "  --forget       drop what is saved",
].join("\n");

export const ACCOUNTS_USAGE = [
  "Usage: forge coolify accounts [--full]",
  "What resolved and from where; the token is masked unless you ask.",
  "",
  "  --full         the ends of the token rather than its length alone",
].join("\n");

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
  { name: "accounts", line: "what resolved, and from where", usage: ACCOUNTS_USAGE },
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
  { name: "accounts", line: "what resolved, and from where", usage: ACCOUNTS_USAGE },
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
