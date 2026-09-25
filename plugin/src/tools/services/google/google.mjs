/* The verb: `forge google <service> <resource...> <method>` over the carried Discovery surface, and
   beside it `schema`, `auth`, `discovery` and the `+` helpers, which a leading `+` keeps from ever
   colliding with a method Google adds. docs/cli/google.md. */
import { didYouMean } from "../../../suggest.mjs";
import { HELP_WORDS, helpAskedOf } from "../../../resolve/help-word.mjs";
import { AUTH_USAGE, auth } from "./auth/login.mjs";
import { DISCOVERY_USAGE, discovery } from "./discovery/refresh.mjs";
import { invoke } from "./invocation.mjs";
import { INTERNAL, VALIDATION, refuse, say, struck } from "./exits.mjs";
import { CALL_SWITCHES, CALL_VALUES, parseFlags, requestOf } from "./request.mjs";
import { SERVED_SERVICES } from "./surface.mjs";
import { levelText, methodText, resolveTyped, schema, treeOf } from "./tree.mjs";
import { DRIVE_HELPERS } from "./helpers/drive.mjs";
import { SHEETS_HELPERS } from "./helpers/sheets.mjs";
import { MAIL_HELPERS } from "./helpers/mail.mjs";
import { CALENDAR_HELPERS } from "./helpers/calendar.mjs";

const HELPERS = { ...DRIVE_HELPERS, ...SHEETS_HELPERS, ...MAIL_HELPERS, ...CALENDAR_HELPERS };

export const USAGE = [
  "Usage: forge google <service> <resource...> <method> | schema | auth | discovery | +<helper>",
  `Google Workspace through carried Discovery documents: every method of ${SERVED_SERVICES.join(", ")} is served. JSON on stdout.`,
  "",
  "  --params JSON    query and path parameters, checked against the method",
  "  --json JSON      the request body",
  "  --upload FILE    a multipart upload, where the method takes one",
  "  --output FILE    where a download or an export writes its bytes",
  "  --page-all       every page, one JSON line each; --page-limit n (10), --page-delay ms (100)",
  "  --dry-run        print the request, credential masked, and send nothing",
  "  --yes            carry out a write that deletes, trashes, removes or clears, overwrites, changes who has",
  "                   access or where mail goes, sends mail, invites, or has a shape no rule classifies",
  "  --account N      which saved account answers; --as user@domain whose data a service account acts on",
  "",
  "  <service> [<resource>...] -h       a level's resources and methods, with the --yes each owes",
  "  schema <id>                        a method's parameters, or a level's subtree, as JSON",
  "  auth <add|login|set|remove|status> the accounts that answer: `forge google auth -h`",
  "  discovery [--write]                what a fresh fetch of the documents moved",
  "  +upload +download +find +read +append +addtab +copytab +send +reply +triage +agenda +schedule +meet",
  "",
  "Exit codes: 1 API error, 2 auth, 3 validation, 4 discovery, 5 internal.",
].join("\n");

const HELPER_SAYS = {
  "+upload": "+upload <file> [--parent ID] [--name N]",
  "+download": "+download <id> [--output F] [--mime M]  (a Google-native file is exported to M)",
  "+find": "+find <text> [--page-all]  (files whose name contains the text, not trashed)",
  "+read": "+read <spreadsheet> <range>",
  "+append": "+append <spreadsheet> <range> --values '[[\"a\",\"b\"]]'",
  "+addtab": "+addtab <spreadsheet> <title> [--rows n] [--cols n]  (a new tab)",
  "+copytab": "+copytab <spreadsheet> <sheetId> --to <spreadsheet>  (a tab copied into another spreadsheet)",
  "+send": "+send --to A --subject S --body B [--attach F] --yes",
  "+reply": "+reply <message-id> --body B --yes",
  "+triage": "+triage [--max n]  (unread mail: sender, subject, date)",
  "+agenda": "+agenda [--today|--week]  (in the account's Calendar time zone)",
  "+schedule": "+schedule --title T --start S --end E [--attendee a@x,b@y] [--meet] [--description D]",
  "+meet": "+meet  (a new Meet space and its link)",
};

export const SAYS = { auth: AUTH_USAGE, discovery: DISCOVERY_USAGE,
  schema: "Usage: forge google schema <service[.resource...][.method]>",
  ...Object.fromEntries(Object.entries(HELPER_SAYS).map(([name, line]) => [name, `Usage: forge google ${line}\n  --account N, --as user@domain, --dry-run and --yes as on every call`])) };

/* A service's listing is read off its tree only when asked for, so a call that never asks grows no tree. */
for (const service of SERVED_SERVICES) {
  Object.defineProperty(SAYS, service, { enumerable: true, get: () => levelText(treeOf(service)) });
}

const asksHelp = (words) => words.some((word) => HELP_WORDS.includes(word));

/* A walk that stopped at a level answers with that level: on stdout where help was asked, refused where a method was. */
const atLevel = ({ level, rest }) => {
  if (asksHelp(rest.slice(0, 1))) return say(levelText(level));
  return refuse(VALIDATION, `google: ${level.id} is a level, not a method; name one of its resources or methods.\n${levelText(level)}`);
};

const typed = async (argv) => {
  const method = resolveTyped(argv);
  if (method.level) return atLevel(method);
  if (asksHelp(method.rest)) return say(methodText(method));
  const { flags, positionals } = parseFlags(method.rest, { values: CALL_VALUES, switches: CALL_SWITCHES, verb: `google ${method.id}` });
  const request = requestOf(method, flags, positionals);
  const answer = await invoke(method, request, { account: flags.account, as: flags.as, yes: Boolean(flags.yes),
    dryRun: Boolean(flags["dry-run"]), argv });
  if (answer !== null) say(JSON.stringify(answer, null, 2));
  return null;
};

const helper = (name, rest) => {
  if (!Object.hasOwn(HELPERS, name)) refuse(VALIDATION, `google: ${didYouMean("helper", name, Object.keys(HELPERS))}`);
  return HELPERS[name](rest);
};

/* Anything thrown past the refusals above is this verb's own fault, so it exits by that class and
   through the same strike as every other line. */
const guarded = async (run) => {
  try {
    return await run();
  } catch (error) {
    return refuse(INTERNAL, `google: an internal error stopped the call: ${struck(error?.message ?? String(error))}\n`
      + "  nothing past this point was sent; `forge feedback` files it against this plugin");
  }
};

const dispatch = async (argv) => {
  const help = helpAskedOf(argv, Object.keys(SAYS));
  if (help) {
    console.log(SAYS[help.subject] ?? USAGE);
    return;
  }
  const [head, ...rest] = argv;
  if (head === undefined) refuse(VALIDATION, USAGE);
  if (head.startsWith("-")) {
    refuse(VALIDATION, `google: ${head} stands where a service, a helper or schema, auth or discovery goes; `
      + "a call's flags follow its method. `forge google -h` lists them.");
  }
  if (head === "auth") return auth(rest);
  if (head === "schema") return schema(rest);
  if (head === "discovery") return discovery(rest);
  if (head.startsWith("+")) return helper(head, rest);
  return typed(argv);
};

export const google = (argv) => guarded(() => dispatch(argv));

google.answersHelp = true;
