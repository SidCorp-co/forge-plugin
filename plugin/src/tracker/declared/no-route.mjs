/* What a call this CLI will not send is told, and the one table of the capabilities REST does not
   serve. Pure and reached from `routes.mjs` rather than kept in it: a refusal is not a route, and
   the table beside the rows was what pushed that file past the size one pass reads.
   docs/cli/one-transport.md. */
/* Every row's rather than a route's: `action` makes the key, `projectId` aims off the resolved slug. */
const STRUCTURAL = new Set(["action", "projectId"]);

/** The arguments a caller gave that the row's route does not send, and the values of one whose legal
 *  set the row declares that are outside it: one refusal, the hazard below being the same for both. */
export const undeclaredIn = (row, args) => [
  ...Object.keys(args ?? {}).filter((name) => !STRUCTURAL.has(name) && !(row?.sends ?? []).includes(name)),
  ...Object.entries(row?.honours ?? {})
    .map(([name, legal]) => [name, [].concat(args?.[name] ?? []).filter((one) => !legal.includes(one))])
    .filter(([, outside]) => outside.length).map(([name, outside]) => `${name}: ${outside.join(", ")}`),
];

/* A narrowing dropped on the way out is worse than a refusal: the caller reads a whole answer as
   though it were the narrow one it asked for, and pays for the difference without being told. */
export const droppedRefusal = (key, names, row) =>
  `${key} was given ${names.join(", ")}, which its route does not send, so nothing was sent at all: `
  + "an argument dropped in transit reads back as an answer to a question the tracker never heard. "
  + `This route takes ${(row?.sends ?? []).join(", ") || "no arguments"}${Object.entries(row?.honours ?? {})
    .map(([name, legal]) => `, and ${name} only ${legal.join(" or ")}`).join("")}, which the -h of the `
  + "verb that owns it names too.";

/** The capabilities this CLI declares and REST does not serve. Each names the route it wanted, so
 *  the gap is reportable as a route rather than as a verb that stopped working, and each names what
 *  still reaches the same thing. A name outside this table wanted no route and is told so. */
const NO_ROUTE = {
  "forge_knowledge.search": {
    wanted: "POST /api/projects/:id/knowledge/search",
    instead: "`forge knowledge list` and `forge knowledge get <slug>` are what still reach the store.",
  },
  /* The tracker's own deploy tool has these three actions and its REST API has no project-scoped
     path for any of them, established by probe rather than read off a document. Each names what
     reaches the same thing; the verb that asked is what adds how to get there, a fall-through
     having been the alternative and that sends the call to a credential nobody chose. */
  "forge_coolify.applications": {
    wanted: "GET /api/projects/:id/integrations/coolify/applications",
    instead: "`forge coolify targets` resolves every bound target against what the platform lists, "
      + "with its uuid, name, domain and repository; `forge coolify app list` lists every "
      + "application the saved instance holds.",
  },
  "forge_coolify.logs": {
    wanted: "GET /api/projects/:id/integrations/coolify/logs",
    instead: "`forge coolify deployment get <uuid> --full` answers with the build log on the saved "
      + "instance.",
  },
  "forge_coolify.runtime_logs": {
    wanted: "GET /api/projects/:id/integrations/coolify/runtime-logs",
    instead: "`forge coolify app logs <uuid>` answers with the running container's log on the saved "
      + "instance.",
  },
};

export const noRouteRefusal = (key) => {
  const held = NO_ROUTE[key];
  if (held) {
    return `${key} has no route on this tracker's REST API. It wanted \`${held.wanted}\`, which this `
      + "credential does not reach, so nothing was sent and there is no second endpoint anything "
      + `could have fallen back to.${held.instead ? `\n${held.instead}` : ""}`;
  }
  return `${key} is not a capability this CLI declares a route for, so nothing was sent.\n`
    + "`forge -h` lists every verb, and each route this CLI serves is some verb's own.";
};
