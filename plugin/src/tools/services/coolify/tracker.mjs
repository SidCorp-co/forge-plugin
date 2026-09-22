/* The tracker route's own surface: what each of its six subcommands takes, the one call it makes
   through the transport every other capability goes through, and the reading that turns a deploy the
   tracker held back into a refusal rather than a deploy that was sent. docs/cli/coolify.md. */
import { fail } from "../../../resolve/settings.mjs";
import { flags } from "../../../resolve/flags.mjs";
import { documentIdOf } from "../../../tracker/issues.mjs";
import { callTool } from "../../../tracker/rest.mjs";
import { rowFor } from "../../../tracker/routes.mjs";
import { renderObject, renderTable } from "./shape.mjs";
import { TRACKER_SCOPE, consentRefusal } from "./chosen-route.mjs";

export const TRACKER_USAGE = [
  "Usage: forge coolify <login|accounts|list|targets|status|rollback-images|deploy|cancel> [args]",
  "The Coolify bindings of the project this CLI already names, on the credential it already holds.",
  "There is no instance to save, no token to save and no file for this checkout to carry.",
  "",
  "  login            save a Coolify instance and its token, which the other route uses",
  "  accounts         what resolved, and from where",
  "  list             the bindings this project has: their stages, targets and health",
  "  targets          each target of one binding, against what the platform itself lists",
  "  status           the latest delivery per target",
  "  rollback-images  what a target could be rolled back to",
  "  deploy           dispatch every target of one binding, one build each",
  "  cancel           stop a deployment that is still queued or building",
  "",
  "  applications, logs, runtime-logs and rollback are refused here, each saying what reaches it.",
  "  The saved instance and the commands that are its own: `forge doctor --coolify-route instance`.",
  "  A write needs --yes; --dry-run prints the request and sends nothing; --json and --table",
  "  choose the shape.",
].join("\n");

const LIST_USAGE = [
  "Usage: forge coolify list",
  "The Coolify integrations this project is bound to: each one's stages, its targets and its health.",
  "An empty answer is the tracker's own word for a project nothing deploys.",
].join("\n");

const TARGETS_USAGE = [
  "Usage: forge coolify targets [--integration I]",
  "Each target of one binding, resolved against what the platform lists.",
  "",
  "  --integration I  which binding, where the project has more than one",
].join("\n");

const STATUS_USAGE = [
  "Usage: forge coolify status [--integration I]",
  "The latest delivery per target: which deployment it was, what it says, and whether the breaker is open.",
  "",
  "  --integration I  narrow to one binding rather than every one",
].join("\n");

const IMAGES_USAGE = [
  "Usage: forge coolify rollback-images [--integration I] [--resource R]",
  "What a target could be rolled back to. An empty listing is a refusal and not an empty shelf:",
  "it also means the platform could not be reached.",
  "",
  "  --integration I  which binding, where the project has more than one",
  "  --resource R     which target, where the binding holds more than one",
].join("\n");

const DEPLOY_USAGE = [
  "Usage: forge coolify deploy [--issue ISS-45] [--integration I] [--run R] [--yes]",
  "Dispatch every target of the resolved binding, one platform build per target.",
  "",
  "  --issue ISS-45   track the deploy against that issue's own pipeline run; without it a",
  "                   binding carrying the live stage is only dispatched at the release stage",
  "  --integration I  dispatch that binding alone",
  "  --run R          an open pipeline run to dispatch under, instead of an issue",
  "  --yes            carry it out; without it this is refused",
  "  --dry-run        print the request that would be sent, and send nothing",
].join("\n");

const CANCEL_USAGE = [
  "Usage: forge coolify cancel [--integration I] [--deployment D] [--yes]",
  "Stop a deployment that is still queued or building.",
  "",
  "  --integration I  which binding, where the project has more than one",
  "  --deployment D   which deployment; without it the binding's most recent delivery",
  "  --yes            carry it out; without it this is refused",
  "  --dry-run        print the request that would be sent, and send nothing",
].join("\n");

export const TRACKER_SAYS = {
  list: LIST_USAGE,
  targets: TARGETS_USAGE,
  status: STATUS_USAGE,
  "rollback-images": IMAGES_USAGE,
  deploy: DEPLOY_USAGE,
  cancel: CANCEL_USAGE,
};

/* Which flag carries which of the route's own argument names, per subcommand. The row's `sends` is
   what the transport refuses an undeclared argument against, so a flag added here that the row does
   not send refuses the call rather than being dropped in transit. */
const TAKES = {
  list: {},
  targets: { integration: "integrationId" },
  status: { integration: "integrationId" },
  "rollback-images": { integration: "integrationId", resource: "resourceUuid" },
  deploy: { issue: "issueId", integration: "integrationId", run: "pipelineRunId" },
  cancel: { integration: "integrationId", deployment: "deploymentUuid" },
};

const ACTS = ["deploy", "cancel"];

/* An issue is named the way every other verb takes one and turned into the identifier the route
   wants here, because the route takes a uuid and nobody types one. */
const argued = async (name, given) => {
  const held = {};
  for (const [flag, field] of Object.entries(TAKES[name])) {
    const value = given[flag];
    if (value === undefined) continue;
    held[field] = field === "issueId" ? await documentIdOf(value) : value;
  }
  return held;
};

const AIMED = "<projectId>";

/* Off the row that would make the request rather than off a second description of it: a preview
   built here would be the one thing no captured pair judges. */
const preview = (key, args) => {
  const { page } = rowFor(key, args).requests(args, AIMED);
  console.log(`${page.method ?? "GET"} /api${page.path}`);
  if (page.body) console.log(JSON.stringify(page.body, null, 2));
};

const CONFIRM = "the tracker's own confirm-prod-deploy route, which this CLI declares no request"
  + " for: release it from the project's own integrations screen";

/* The tracker answers a held deploy with a 200 whose body says nothing went. Printed as an answer it
   reads as a deploy that happened, which is the one reading that gets a person to stop watching. */
const dispatchRefusal = (answer) => {
  const held = answer?.pendingHumanConfirm
    ? `a production binding holds it until somebody confirms — ${CONFIRM}`
    : `the tracker gave the reason \`${answer?.reason ?? "none"}\``;
  return `coolify deploy: nothing was dispatched, and ${held}.\n`
    + `  bindings dispatched: ${(answer?.integrationIds ?? []).join(", ") || "none"}\n`
    + "  what this project is bound to: forge coolify list";
};

const COLUMN_CAP = 8;

/* The instance route's column preference is that platform's own field names, and none of them is on
   a row the tracker serves: a listing narrowed by it comes back one column wide. So the columns here
   are the ones the rows actually carry, in the order the tracker wrote them. */
const columnsOf = (rows) => [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, COLUMN_CAP);

const shown = (answer, asTable) => {
  const rows = Array.isArray(answer) ? answer : null;
  if (rows) {
    const held = rows.filter((one) => one && typeof one === "object");
    if (!held.length) return asTable ? "(none)" : "[]";
    return asTable ? `${renderTable(held, columnsOf(held))}\n${held.length} item(s)` : JSON.stringify(answer, null, 2);
  }
  if (answer && typeof answer === "object") {
    return asTable ? renderObject(answer) : JSON.stringify(answer, null, 2);
  }
  return String(answer);
};

/* The one listing the answer carries, where it carries exactly one: a table of the row the caller
   asked about beats a table of the envelope it arrived in. */
const LISTING = ["integrations", "targets", "deliveries", "images"];

const bodyOf = (answer) => {
  const named = LISTING.find((one) => Array.isArray(answer?.[one]));
  return named ? answer[named] : answer;
};

const SWITCHES = ["--yes", "--dry-run", "--json", "--table"];

/** One subcommand of the tracker route, end to end. `key` is its row in the transport's own table,
 *  so the request, the retry decision and the refusal are all that table's. */
export const runTracker = async (name, key, argv) => {
  const usage = TRACKER_SAYS[name];
  const given = flags(argv, `coolify ${name}`, SWITCHES, { usage });
  const args = await argued(name, given);
  if (ACTS.includes(name) && !given.yes && !given["dry-run"]) {
    fail(consentRefusal(name, TRACKER_SCOPE));
  }
  if (given["dry-run"]) {
    preview(key, args);
    return;
  }
  const answer = await callTool(key, args);
  if (name === "deploy" && answer?.dispatched === false) fail(dispatchRefusal(answer));
  const asTable = given.table || (process.stdout.isTTY && !given.json);
  console.log(shown(bodyOf(answer), asTable));
};
