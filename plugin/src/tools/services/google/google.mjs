/* The verb: `forge google <service> <resource...> <method>` over the carried Discovery surface, and
   beside it `schema`, `auth`, `discovery` and the `+` helpers, which a leading `+` keeps from ever
   colliding with a method Google adds. docs/cli/google.md. */
import { didYouMean } from "../../../suggest.mjs";
import { helpAskedOf } from "../../../resolve/flags.mjs";
import { AUTH_USAGE, auth } from "./auth/login.mjs";
import { DISCOVERY_USAGE, discovery } from "./discovery/refresh.mjs";
import { invoke } from "./invocation.mjs";
import { DISCOVERY, VALIDATION, refuse, say } from "./exits.mjs";
import { CALL_SWITCHES, CALL_VALUES, parseFlags, requestOf } from "./request.mjs";
import { COMMON, SERVED, SERVED_SERVICES, carriedIndex, resolveTyped } from "./surface.mjs";
import { DRIVE_HELPERS } from "./helpers/drive.mjs";
import { SHEETS_HELPERS } from "./helpers/sheets.mjs";
import { MAIL_HELPERS } from "./helpers/mail.mjs";
import { CALENDAR_HELPERS } from "./helpers/calendar.mjs";

const HELPERS = { ...DRIVE_HELPERS, ...SHEETS_HELPERS, ...MAIL_HELPERS, ...CALENDAR_HELPERS };

export const USAGE = [
  "Usage: forge google <service> <resource...> <method> | schema | auth | discovery | +<helper>",
  `Google Workspace through carried Discovery documents: ${SERVED_SERVICES.join(", ")}. JSON on stdout.`,
  "",
  "  --params JSON    query and path parameters, checked against the method",
  "  --json JSON      the request body",
  "  --upload FILE    a multipart upload, where the method takes one",
  "  --output FILE    where a download or an export writes its bytes",
  "  --page-all       every page, one JSON line each; --page-limit n (10), --page-delay ms (100)",
  "  --dry-run        print the request, credential masked, and send nothing",
  "  --yes            carry out a delete, trash, permission change, overwrite, mail send or invitation",
  "  --account N      which saved account answers; --as user@domain whose data a service account acts on",
  "",
  "  schema <service.resource.method>   a method's parameters, from the carried document",
  "  auth <add|login|set|remove|status> the accounts that answer: `forge google auth -h`",
  "  discovery [--write]                what a fresh fetch of the documents moved",
  "  +upload +download +find +read +append +send +reply +triage +agenda +schedule +meet",
  "",
  "Exit codes: 1 API error, 2 auth, 3 validation, 4 discovery, 5 internal.",
].join("\n");

const HELPER_SAYS = {
  "+upload": "+upload <file> [--parent ID] [--name N]",
  "+download": "+download <id> [--output F] [--mime M]  (a Google-native file is exported to M)",
  "+find": "+find <text> [--page-all]  (files whose name contains the text, not trashed)",
  "+read": "+read <spreadsheet> <range>",
  "+append": "+append <spreadsheet> <range> --values '[[\"a\",\"b\"]]'",
  "+send": "+send --to A --subject S --body B [--attach F] --yes",
  "+reply": "+reply <message-id> --body B --yes",
  "+triage": "+triage [--max n]  (unread mail: sender, subject, date)",
  "+agenda": "+agenda [--today|--week]  (in the account's Calendar time zone)",
  "+schedule": "+schedule --title T --start S --end E [--attendee a@x,b@y] [--meet] [--description D]",
  "+meet": "+meet  (a new Meet space and its link)",
};

const servedBy = (service) => SERVED.filter((id) => id.startsWith(`${service}.`)).map((id) => id.split(".").slice(1).join(" "));

export const SAYS = { ...Object.fromEntries(SERVED_SERVICES.map((service) => [service,
  `Usage: forge google ${service} <resource...> <method> [<path args>] [flags]\nServed: ${servedBy(service).join(", ")}.\n`
  + `\`forge google schema ${service}.<resource>.<method>\` prints one method's parameters.`])),
auth: AUTH_USAGE, discovery: DISCOVERY_USAGE, schema: "Usage: forge google schema <service.resource.method>",
  ...Object.fromEntries(Object.entries(HELPER_SAYS).map(([name, line]) => [name, `Usage: forge google ${line}\n  --account N, --as user@domain, --dry-run and --yes as on every call`])) };

const schema = (argv) => {
  const [id, ...rest] = argv;
  if (!id || rest.length) refuse(VALIDATION, `google schema takes one method id: forge google schema ${SERVED[0]}`);
  const service = id.split(".")[0];
  const entry = carriedIndex(service)?.methods?.[id];
  if (!entry) refuse(DISCOVERY, `google schema: ${didYouMean("method", id, Object.keys(carriedIndex(service)?.methods ?? {}).concat(SERVED))}`);
  say(JSON.stringify({ id, served: SERVED.includes(id), http: entry.http, path: entry.path, parameters: entry.params ?? {},
    body: entry.body ?? null, returns: entry.returns ?? null, upload: Boolean(entry.upload), download: Boolean(entry.download),
    scopes: entry.scopes ?? [], about: entry.about ?? null, common: COMMON }, null, 2));
};

const typed = async (argv) => {
  const method = resolveTyped(argv);
  const { flags, positionals } = parseFlags(method.rest, { values: CALL_VALUES, switches: CALL_SWITCHES, verb: `google ${method.id}` });
  const request = requestOf(method, flags, positionals);
  const answer = await invoke(method, request, { account: flags.account, as: flags.as, yes: Boolean(flags.yes),
    dryRun: Boolean(flags["dry-run"]), argv });
  if (answer !== null) say(JSON.stringify(answer, null, 2));
};

const helper = (name, rest) => {
  if (!Object.hasOwn(HELPERS, name)) refuse(VALIDATION, `google: ${didYouMean("helper", name, Object.keys(HELPERS))}`);
  return HELPERS[name](rest);
};

export const google = async (argv) => {
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

google.answersHelp = true;
