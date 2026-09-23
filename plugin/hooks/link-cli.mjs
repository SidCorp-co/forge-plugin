#!/usr/bin/env node
/* Thin like `gate.mjs`, and the switch is read in the body so its config reader is not frozen too. */
import { join } from "node:path";

import { moduleToRun, PLUGIN_ROOT } from "../src/tools/plugin-copy.mjs";

const held = await moduleToRun(
  join("src", "hooks", "link-cli.mjs"),
  "linkCli",
  join(PLUGIN_ROOT, "src", "hooks", "link-cli.mjs"),
);

await held.linkCli(process.argv[2]);
