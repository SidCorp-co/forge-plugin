/* What the pinned project lets this checkout see or touch. A uuid typo restarts somebody else's
   service, so a target outside the pin is refused here, before its request is built, and a listing
   is cut to the pin's own environments. There is no unscoped mode. docs/cli/coolify.md. */
import { look } from "./client.mjs";
import { wrapper } from "./shape.mjs";
import { fail } from "../../../resolve/settings.mjs";

const objects = (value) => (Array.isArray(value) ? value.filter((one) => one && typeof one === "object") : []);

const asList = (value) => {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(asList);
  return String(value).split(",").map((one) => one.trim()).filter(Boolean);
};

/* Some instances answer the environments route with nothing useful, so the project's own embedded
   list is the fallback — and both callers take this one reading, so they cannot disagree. */
const environmentsOf = async (held, projectUuid) => {
  const listed = objects(await look(held, `/projects/${projectUuid}/environments`));
  if (listed.length) return listed;
  const project = await look(held, `/projects/${projectUuid}`);
  return objects(project?.environments);
};

const wanted = (spec, environment) => {
  const names = spec.environment ?? [];
  if (!names.length) return true;
  return names.some((one) => String(environment.name) === one || String(environment.uuid) === one);
};

export const makeScope = (held, pin) => ({
  held,
  pin,
  projects: pin.spec.project_uuid ?? [],
  envIds: null,
  appIds: null,
  checked: new Map(),
});

export const active = (scope) => scope.projects.length > 0;

export const label = (scope) => scope.projects.join(", ");

export const environmentIds = async (scope) => {
  if (scope.envIds) return scope.envIds;
  const found = new Set();
  for (const project of scope.projects) {
    for (const environment of await environmentsOf(scope.held, project)) {
      if (environment.id !== undefined && environment.id !== null && wanted(scope.pin.spec, environment)) {
        found.add(environment.id);
      }
    }
  }
  scope.envIds = found;
  return found;
};

/* A pin that resolves to nothing fails closed. The Python warns here and carries on, which turns a
   mistyped project uuid — the very typo this guard exists for — into a call against the whole team. */
const mustResolve = (scope, allowed, what) => {
  if (allowed.size) return;
  fail(
    `coolify: the pinned project${scope.projects.length === 1 ? "" : "s"} (${label(scope)}) `
    + `resolved to no ${what}, so nothing can be checked against the pin.\n`
    + `  this checkout's scope comes from ${scope.pin.at}\n`
    + "  check that uuid against `forge coolify project list`, and that any environment it names exists",
  );
};

export const applicationIds = async (scope) => {
  if (scope.appIds) return scope.appIds;
  const ids = await environmentIds(scope);
  const apps = objects(await look(scope.held, "/applications"));
  scope.appIds = new Set(apps.filter((one) => ids.has(one.environment_id)).map((one) => one.id));
  return scope.appIds;
};

/* An object with no such field says nothing about itself. Where a guard already placed the target
   that is only a shape and it is kept; where this filter is the pin's only hold it is a row nothing
   checked, so it goes — counted apart, because "could not be placed" is not "somebody else's". */
const keepByField = (items, field, allowed, strict) => {
  const kept = [];
  let dropped = 0;
  let unplaced = 0;
  for (const one of items) {
    if (!one || typeof one !== "object" || !(field in one)) {
      if (strict) unplaced += 1;
      else kept.push(one);
    } else if (allowed.has(one[field])) kept.push(one);
    else dropped += 1;
  }
  return { kept, dropped, unplaced };
};

const keepByUuid = (items, allowed) => {
  const kept = items.filter((one) => one && typeof one === "object" && allowed.includes(one.uuid));
  return { kept, dropped: items.length - kept.length };
};

/* Keyed on what the endpoint returns, never on which group asked: `project list` and `project env
   list` are one group and entirely different objects. A deployment names its application by id. */
const cutDown = async (scope, returns, rows, strict) => {
  if (returns === "projects") return keepByUuid(rows, scope.projects);
  if (returns === "environments") {
    const ids = await environmentIds(scope);
    mustResolve(scope, ids, "environments");
    return keepByField(rows, "id", ids, strict);
  }
  if (returns === "deployments") {
    const ids = await applicationIds(scope);
    mustResolve(scope, ids, "applications");
    return keepByField(rows, "application_id", ids, strict);
  }
  const ids = await environmentIds(scope);
  mustResolve(scope, ids, "environments");
  return keepByField(rows, "environment_id", ids, strict);
};

/* `mustFilter` is for an operation the pin's only hold on is this filter — a listing with no guard
   of its own. There an answer this cannot place is not something to print anyway: it would be rows
   nothing has checked. Where a guard already placed the target, an unplaceable answer is just a
   shape, and passing it through hides nothing. */
export const filterList = async (scope, returns, items, { mustFilter = false } = {}) => {
  /* A dry run sent nothing, so there is no answer to place — which is not the same as an answer
     this cannot place, and refusing it would make `--dry-run` unusable on every listing. */
  if (!active(scope) || !returns || items === null) return { kept: items, dropped: 0 };
  /* A listing that came back wrapped beside a count is still a listing: passing the wrapper through
     untouched because it is not an array is how rows the pin excludes would leave unfiltered. */
  const inside = wrapper(items);
  if (inside) {
    const cut = await cutDown(scope, returns, items[inside], mustFilter);
    return { ...cut, kept: { ...items, [inside]: cut.kept } };
  }
  if (Array.isArray(items)) return cutDown(scope, returns, items, mustFilter);
  if (!mustFilter) return { kept: items, dropped: 0 };
  return fail(
    `coolify: this listing answered a shape the pin cannot be applied to, so it is not shown.\n`
    + `  nothing but this filter places a ${returns} listing inside the pinned project\n`
    + "  report it: the answer was neither a list nor a list wrapped beside a count",
  );
};

const LINK_FIELD = {
  app: "environment_id",
  service: "environment_id",
  db: "environment_id",
  any: "environment_id",
  deployment: "application_id",
};

const refuseUnless = (verdict, scope, uuid) => {
  if (verdict.allowed) return;
  const why = verdict.placed === false
    ? `${verdict.noun} ${uuid} answered without the field that would place it in a project, so the `
      + "pin cannot be checked against it"
    : `${verdict.noun} ${uuid} is outside the pinned project${scope.projects.length === 1 ? "" : "s"} `
      + `(${label(scope)})`;
  fail(
    `coolify: ${why}.\n  this checkout's scope comes from ${scope.pin.at}\n`
    + "  there is no override — work in that project's own checkout instead",
  );
};

const fetched = async (scope, collection, uuid, field) => {
  const found = await look(scope.held, `${collection}/${uuid}`).catch(() => null);
  if (!found || typeof found !== "object") return null;
  return { object: found, placed: field in found };
};

const checkUuid = async (scope, guard, uuid) => {
  const field = LINK_FIELD[guard.kind];
  const allowed = field === "application_id" ? await applicationIds(scope) : await environmentIds(scope);
  mustResolve(scope, allowed, field === "application_id" ? "applications" : "environments");
  if (scope.checked.has(uuid)) {
    refuseUnless(scope.checked.get(uuid), scope, uuid);
    return;
  }
  let seen = null;
  let noun = "resource";
  for (const collection of guard.lookup ?? []) {
    seen = await fetched(scope, collection, uuid, field);
    if (seen) {
      noun = collection.replace(/^\//u, "").replace(/s$/u, "");
      break;
    }
  }
  /* Nothing answered: the real request produces the authoritative 404 or 403. Something answered
     that cannot be placed is the other case, and authorising it would let a resource through on a
     lookup that established nothing about it. */
  const verdict = !seen
    ? { allowed: true, noun }
    : { allowed: seen.placed && allowed.has(seen.object[field]), placed: seen.placed, noun };
  scope.checked.set(uuid, verdict);
  refuseUnless(verdict, scope, uuid);
};

/** Refuse every target in `values` that falls outside the pin, before any request is built. */
export const check = async (scope, guards, values) => {
  if (!active(scope)) return;
  for (const guard of guards ?? []) {
    for (const uuid of asList(values[guard.param])) {
      if (guard.kind === "project") {
        refuseUnless({ allowed: scope.projects.includes(uuid), noun: "project" }, scope, uuid);
      }
      else await checkUuid(scope, guard, uuid);
    }
  }
};
