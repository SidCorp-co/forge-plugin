#!/usr/bin/env node
/* Thin because everything it imports is frozen with it until the session restarts. docs/HOOKS.md. */
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { moduleToRun } from "../src/tools/plugin-copy.mjs";

const held = await moduleToRun(
  join("hooks", "_hook.mjs"),
  "dispatch",
  fileURLToPath(new URL("./_hook.mjs", import.meta.url)),
);

await held.dispatch(process.argv.slice(2));
