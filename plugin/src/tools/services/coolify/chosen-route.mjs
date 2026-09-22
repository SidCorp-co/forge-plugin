/* Which of the two ways to the deployment platform answers, and what every name typed after the verb
   is on the tracker's. One reader for the switch and one table for the names: a route a second
   reader could decide is a precedence rule with no undo, and a name in two tables is a fall-through
   to a credential the caller did not choose. docs/cli/coolify.md. */
import { configPath, userConfig } from "../../../resolve/config.mjs";

export const TRACKER = "tracker";
export const INSTANCE = "instance";
export const ROUTE_MODES = [TRACKER, INSTANCE];

export const ROUTE_KEY = "coolifyRoute";
export const TO_INSTANCE = `forge doctor --coolify-route ${INSTANCE}`;

const DEFAULTED = "the plugin's default, this machine having chosen neither";

/** Which way answers and what said so. The tracker's where nothing did, that being the one this
 *  machine needs no credential of its own for. A value outside the two reads as nothing said, the
 *  write being what refuses one before it is stored. */
export const coolifyRoute = () => {
  const held = userConfig()[ROUTE_KEY];
  return ROUTE_MODES.includes(held)
    ? { mode: held, from: configPath() }
    : { mode: TRACKER, from: DEFAULTED };
};

export const onTracker = () => coolifyRoute().mode === TRACKER;

/* The name typed and the capability behind it. Nine of the tracker tool's ten actions are here —
   six with a row in the route table and three the transport refuses off its own no-route table,
   which is where a capability REST does not serve is answered, so this file states no second
   version of that. */
export const TRACKER_SERVED = {
  list: "forge_coolify.list",
  targets: "forge_coolify.targets",
  status: "forge_coolify.status",
  "rollback-images": "forge_coolify.rollback_images",
  deploy: "forge_coolify.deploy",
  cancel: "forge_coolify.cancel",
};

export const ROUTELESS = {
  applications: "forge_coolify.applications",
  logs: "forge_coolify.logs",
  "runtime-logs": "forge_coolify.runtime_logs",
};

/* The tenth action, and the one name here held back by a judgement rather than by a missing route.
   The tracker serves it, and its answer is chosen from a listing whose own read does not answer for
   a healthy binding — so serving it would ask a caller for an image tag nothing here can list, and
   the route refuses a tag the platform does not list by name. */
export const HELD_BACK = {
  rollback: {
    why: "it names an image tag, and the listing that tag has to be chosen from does not answer",
    instead: "forge coolify rollback-images, to read whether that listing has started answering",
  },
};

/** Shared by both ways, being about the instance credential itself rather than about a platform
 *  call: one saves it, one says what resolved. */
export const BOTH_WAYS = ["login", "accounts"];

/** What the tracker's way answers to, which is what its usage row offers, what a help ask resolves
 *  against and what a refusal lists. One list, because a usage row built apart from the refusal's is
 *  how a verb comes to offer a name it turns away. */
export const TAKEN_HERE = [...BOTH_WAYS, ...Object.keys(TRACKER_SERVED)];

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
