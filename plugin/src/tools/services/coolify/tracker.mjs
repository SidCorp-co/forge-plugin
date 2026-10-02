/* The tracker route's own surface: what each of its six subcommands takes, the one call it makes
   through the transport every other capability goes through, and the reading that turns a deploy the
   tracker held back into a refusal rather than a deploy that was sent. docs/cli/coolify.md. */
import { fail, keepOnFailure } from "../../../resolve/settings.mjs";
import { flags } from "../../../resolve/flags.mjs";
import { documentIdOf } from "../../../tracker/issues.mjs";
import { callTool } from "../../../tracker/rest.mjs";
import { rowFor } from "../../../tracker/routes.mjs";
import { keysOf, rendered, wrapper } from "./shape.mjs";
import {
  REFUSED_HERE, TAKEN_HERE, TO_INSTANCE, TRACKER_BOTH, TRACKER_ROWS, TRACKER_SCOPE, consentRefusal, listed, summaryLines,
  trackerRouteLines,
} from "./chosen-route.mjs";

export const TRACKER_USAGE = [
  `Usage: forge coolify <${TAKEN_HERE.join("|")}> [args]`,
  "The Coolify bindings of the project this CLI already names, on the credential it already holds.",
  "There is no instance to save, no token to save and no file for this checkout to carry.",
  "",
  ...summaryLines([...TRACKER_BOTH, ...TRACKER_ROWS]),
  "",
  `  ${listed(REFUSED_HERE)} are refused here, each saying what reaches it.`,
  `  The saved instance and the commands that are its own: \`${TO_INSTANCE}\`.`,
  "  A write needs --yes; --dry-run prints the request and sends nothing; --json and --table",
  "  choose the shape.",
].join("\n");

const ROWS = Object.fromEntries(TRACKER_ROWS.map((row) => [row.name, row]));

export const TRACKER_SAYS = Object.fromEntries(TRACKER_ROWS.map((row) => [row.name, row.usage]));

/* An issue is named the way every other verb takes one and turned into the identifier the route
   wants here, because the route takes a uuid and nobody types one. */
const argued = async (name, given) => {
  const held = {};
  for (const [flag, field] of Object.entries(ROWS[name].takes)) {
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

/* The one listing the answer carries, where it carries exactly one: a table of the row the caller
   asked about beats a table of the envelope it arrived in. */
const LISTING = ["integrations", "targets", "deliveries", "images"];

const bodyOf = (answer) => {
  const named = wrapper(answer, LISTING);
  return named ? answer[named] : answer;
};

const SWITCHES = ["--yes", "--dry-run", "--json", "--table"];

const answer = async (name, argv, route) => {
  const { key, usage } = ROWS[name];
  const given = flags(argv, `coolify ${name}`, SWITCHES, { usage });
  const args = await argued(name, given);
  if (rowFor(key, args).writes && !given.yes && !given["dry-run"]) {
    fail(consentRefusal(name, TRACKER_SCOPE));
  }
  if (given["dry-run"]) {
    preview(key, args);
    return;
  }
  const answered = await callTool(key, args);
  if (name === "deploy" && answered?.dispatched === false) fail(dispatchRefusal(answered));
  const asTable = given.table || (process.stdout.isTTY && !given.json);
  const body = bodyOf(answered);
  /* The instance route's column preference is that platform's own field names, and none of them is
     on a row the tracker serves: a listing narrowed by it comes back one column wide. So the columns
     here are the ones the rows actually carry, in the order the tracker wrote them. */
  console.log(rendered(body, asTable, keysOf));
  if (Array.isArray(body) && !body.length) {
    console.error([`coolify ${name}: the tracker route answered with nothing.`, ...route].join("\n"));
  }
};

/** One subcommand of the tracker route, end to end. Its row's `key` is its row in the transport's own
 *  table, so the request, the retry decision and the refusal are all that table's. Whatever refuses
 *  it — a flag only the saved instance's row takes, the tracker's own answer, the consent check —
 *  ends with the route that answered, and an empty listing says the same beside it: printed bare it
 *  reads as an application that is gone. The lines are dropped once the call is over, so a later
 *  refusal in the same process does not inherit them. */
export const runTracker = async (name, argv) => {
  const route = trackerRouteLines();
  const drop = keepOnFailure(route.join("\n"));
  try {
    await answer(name, argv, route);
  } finally {
    drop();
  }
};
