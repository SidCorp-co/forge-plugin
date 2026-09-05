#!/usr/bin/env node
/* Thin like `gate.mjs`, and the switch is read in the body so its config reader is not frozen too. */
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { moduleToRun } from "../src/tools/plugin-copy.mjs";

const held = await moduleToRun(
  join("src", "hooks", "link-cli.mjs"),
  "linkCli",
  fileURLToPath(new URL("../src/hooks/link-cli.mjs", import.meta.url)),
);

await held.linkCli(process.argv[2]);
