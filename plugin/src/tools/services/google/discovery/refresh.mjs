/* `forge google discovery`: fetch every carried service's Discovery document, say method by method
   what moved against the index carried here, and write the new index only when asked. A served method
   a fresh document drops refuses the whole write by name, because a served method that silently went
   is a command that changed meaning between two releases. docs/cli/google.md. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CARRIED, SERVED, SERVICES, carriedIndex } from "../surface.mjs";
import { DISCOVERY, refuse, say } from "../exits.mjs";
import { endpointed, jsonOf, reach } from "../wire.mjs";
import { deriveIndex, moved, serialize } from "./derive.mjs";
import { parseFlags } from "../request.mjs";

export const DISCOVERY_USAGE = [
  "Usage: forge google discovery [--write] [--dir DIR]",
  "Fetch each carried service's Discovery document and print, one JSON line a service, which methods",
  "it added, removed and changed against the carried index. Nothing is written without --write.",
  "",
  "  --write      replace the carried index with what was fetched",
  "  --dir DIR    compare against, and write to, DIR rather than the index this plugin carries",
].join("\n");

const fetched = async (service) => {
  const url = endpointed(SERVICES[service].discovery);
  const answer = await reach("GET", url, { headers: { Accept: "application/json" } });
  const document = jsonOf(answer);
  if (!answer.ok || !document?.resources) {
    refuse(DISCOVERY, `google discovery: ${url} answered ${answer.status} without a Discovery document.\n`
      + "  nothing was written; run it again once the document answers");
  }
  return deriveIndex(document, { service, discovery: SERVICES[service].discovery });
};

export const discovery = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ["--dir"], switches: ["--write"], verb: "google discovery" });
  if (positionals.length) refuse(DISCOVERY, `google discovery takes no argument, not \`${positionals[0]}\`.\n${DISCOVERY_USAGE}`);
  const dir = flags.dir ?? CARRIED;
  const fresh = {};
  for (const service of Object.keys(SERVICES)) fresh[service] = await fetched(service);
  const lines = Object.entries(fresh).map(([service, index]) => ({
    service,
    revision: { carried: carriedIndex(service, dir)?.revision ?? null, fetched: index.revision },
    ...moved(carriedIndex(service, dir), index),
  }));
  for (const line of lines) say(JSON.stringify(line));
  const dropped = SERVED.filter((id) => !fresh[id.split(".")[0]].methods[id]);
  if (dropped.length) {
    refuse(DISCOVERY, `google discovery: the fetched documents drop ${dropped.length} served method(s): ${dropped.join(", ")}.\n`
      + "  nothing was written; take each out of SERVED in surface.mjs first, which is the decision to stop serving it");
  }
  if (!flags.write) return;
  mkdirSync(dir, { recursive: true });
  for (const [service, index] of Object.entries(fresh)) writeFileSync(join(dir, `${service}.json`), serialize(index));
  say(JSON.stringify({ written: Object.keys(fresh).map((service) => join(dir, `${service}.json`)) }));
};
