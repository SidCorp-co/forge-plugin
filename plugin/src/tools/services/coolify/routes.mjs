/* Which Coolify operations this verb serves, resolved against the index beside this file — the
   Python plugin's generated one, copied byte for byte. Each operation carries the `scope` list
   tying its own arguments to the pinned project, so an operation added to `SERVED` arrives
   guarded rather than arriving and then being guarded. docs/cli/coolify.md. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { once } from "../../../resolve/config.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const index = once(() => JSON.parse(readFileSync(join(HERE, "routes.json"), "utf8")));

/* The deploy path only; the groups the generator withheld are not in the index to withhold. */
export const SERVED = [
  "app list",
  "app get",
  "app logs",
  "app env list",
  "app env create",
  "app env update",
  "app restart",
  "app start",
  "app stop",
  "deploy",
  "deployment list",
  "deployment get",
  "deployment list-by-app",
  "deployment cancel",
  "project list",
  "project get",
  "project env list",
  "resource list",
];

export const ALIASES = {
  apps: "app list",
  logs: "app logs",
  env: "app env list",
  restart: "app restart",
  start: "app start",
  stop: "app stop",
  deployments: "deployment list",
  projects: "project list",
  ps: "resource list",
};

/* Coolify names a resource by uuid, and `tag` is its one selector that is not one — a tag spans
   projects. An integer like `pull_request_id` selects inside a resource a guarded uuid named. */
const selects = (name) => name === "uuid" || name.endsWith("_uuid") || name === "tag";

const declaredNames = (entry) => [
  ...(entry.params ?? []).map((one) => one.name),
  ...(entry.body?.props ?? []).map((one) => one.name),
];

export const unguarded = (entry) => {
  const guarded = new Set((entry.scope ?? []).map((one) => one.param));
  return declaredNames(entry).filter((name) => selects(name) && !guarded.has(name));
};

/* Two ways to be tied to the pin: it only reads and answers with a list the pin cuts down, or its
   selectors are guarded first. The method is half the test — one that acts has already acted by
   the time there is anything to filter, which `deploy --tag` would be given a `returns`. */
export const filtered = (entry) => entry.method === "GET" && Boolean(entry.returns);

export const holes = (entry) => (filtered(entry) ? [] : unguarded(entry));

export const reachable = (entry) => {
  const selectors = declaredNames(entry).filter(selects);
  return filtered(entry) || selectors.length === 0 || selectors.length > unguarded(entry).length;
};

/* No guard of its own, so the pin's one hold on it is the filter over what comes back. */
export const pinOnly = (entry) => !(entry.scope ?? []).length;

const entryAt = (group, command) => index().groups?.[group]?.commands?.[command];

export const servedNames = () =>
  SERVED.filter((name) => {
    const [group, ...rest] = name.split(" ");
    const entry = entryAt(group, rest.join(" "));
    return entry ? reachable(entry) : false;
  });

const LENGTHS = [3, 2, 1, 0];

const matched = (group, rest) => {
  const commands = index().groups[group]?.commands ?? {};
  for (const length of LENGTHS) {
    const candidate = rest.slice(0, length).join(" ");
    if (Object.hasOwn(commands, candidate)) return { command: candidate, rest: rest.slice(length) };
  }
  return null;
};

export const resolveCommand = (argv) => {
  const [head, ...tail] = argv;
  if (head === undefined) return { unknown: null };
  const aliased = Object.hasOwn(ALIASES, head) ? ALIASES[head] : null;
  const [group, ...rest] = aliased ? [...aliased.split(" "), ...tail] : argv;
  if (!Object.hasOwn(index().groups, group)) return { unknown: head, kind: "group" };
  const found = matched(group, rest);
  if (!found) return { unknown: `${group} ${rest[0] ?? ""}`.trim(), kind: "command" };
  const name = `${group} ${found.command}`.trim();
  if (!servedNames().includes(name)) return { unknown: name, kind: "unserved" };
  return { name, group, entry: { ...entryAt(group, found.command), name }, rest: found.rest };
};
