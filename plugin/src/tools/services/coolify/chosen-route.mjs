/* Which of the two ways to the deployment platform answers, and what every name typed after the verb
   is on the tracker's. One reader for the switch and one table for the names: a route a second
   reader could decide is a precedence rule with no undo, and a name in two tables is a fall-through
   to a credential the caller did not choose. docs/cli/coolify.md. */
import { configPath, userConfig } from "../../../resolve/config.mjs";
import { chosen } from "../../../resolve/settings.mjs";
import { NO_ROUTE_KEYS } from "../../../tracker/declared/no-route.mjs";
import { INSTANCE_ROWS, TRACKER_BOTH, TRACKER_ROWS } from "./subcommands.mjs";

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

/** Shared by both ways, being about the instance credential itself rather than about a platform
 *  call: one saves it, one says what resolved. */
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
