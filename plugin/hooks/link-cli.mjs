#!/usr/bin/env node
// Both CLIs on PATH, because the skills tell the agent to run them. No event, so no readEvent.
import { mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { hookOff } from "../src/hook-switch.mjs";

const root = process.argv[2];
if (!root || hookOff("link-cli")) process.exit(0);
const bin = join(homedir(), ".local", "bin");
try {
  mkdirSync(bin, { recursive: true });
} catch {
  process.exit(0);
}
for (const name of ["forge", "vi-natural"]) {
  const link = join(bin, name);
  try {
    unlinkSync(link);
  } catch {
    /* nothing there yet */
  }
  try {
    symlinkSync(join(root, "bin", name), link);
  } catch {
    /* a link we cannot write is not worth failing a session start over */
  }
}
