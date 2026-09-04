#!/usr/bin/env node
/* One link on PATH is one copy for the machine, so a call arriving through it chooses its copy here
   by working directory, with argv[1] set to the real path a main-module guard compares against. The
   imports are node builtins and the chooser: a graph reaching what this survives survives nothing. */
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { copyToRun } from "./tools/plugin-copy.mjs";

const [entry, ...rest] = process.argv.slice(2);
const chosen = copyToRun({ entry });
const target = join(chosen.dir, entry);

const fallback = chosen.installed
  ? `The installed copy is ${join(chosen.installed.dir, entry)}: run \`node\` on that path with the`
    + " same arguments until the checkout loads again."
  : "No install record on this machine names a copy to fall back to.";

try {
  process.argv = [process.argv[0], realpathSync(target), ...rest];
  await import(pathToFileURL(target));
} catch (error) {
  console.error(error?.stack ?? String(error));
  if (chosen.kind !== "checkout") process.exit(1);
  console.error(`\n${target} is this checkout's own copy and it failed to load, which is a fault in`
    + ` the checkout and not in what you typed. ${fallback}`);
  process.exit(1);
}
