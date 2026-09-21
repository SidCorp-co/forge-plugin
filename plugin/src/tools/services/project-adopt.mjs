/* The one command that takes a checkout's committed project file over, so a box moving to this
   machine's own record of a project spends one call rather than one per key. It copies and never
   moves: taking a tracked file out of a checkout is a commit, and this plugin does not commit in
   somebody's tree. docs/cli/the-project-file.md. */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { COMMITTED_FILE, committedFileHere, fail, projectFilePath } from "../../resolve/settings.mjs";
import { readJson } from "../../resolve/config.mjs";
import { asWritten, READS_IT } from "./project-file.mjs";

/* The bytes as the checkout holds them, not a re-serialization of the parse: whoever wrote that file
   by hand chose its shape, and the entry is the file they go on reading. */
const copied = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  const handle = openSync(path, "wx", 0o600);
  try {
    writeFileSync(handle, text);
  } finally {
    closeSync(handle);
  }
};

/** Every line the call prints, or a refusal. The entry is read back off the disk before a word of
 *  this is said: a copy that landed and does not parse is the one state a caller must not be told
 *  went through. */
export const adopt = () => {
  const path = projectFilePath();
  if (!path) {
    fail(`--adopt: this directory belongs to no checkout, so there is no project to adopt a `
      + `${COMMITTED_FILE} into. Run this from inside a checkout.`);
  }
  if (existsSync(path)) {
    fail(`--adopt: ${path} is this machine's record of this project already, and adopting would `
      + "write over it. Nothing was written — a key set since is held there and nowhere else. Read "
      + `what it holds: \`${READS_IT}\`, and set a key of it with \`forge doctor --set <key>=<value>\`.`);
  }
  const held = committedFileHere();
  if (!held) {
    fail(`--adopt: no ${COMMITTED_FILE} was found on the way up from here, so there is nothing to `
      + `take over. This project's configuration is written with \`forge doctor --set <key>=<value>\`, `
      + `which puts it in ${path}.`);
  }
  let text = null;
  try {
    text = readFileSync(held, "utf8");
  } catch (error) {
    fail(`--adopt: ${held} could not be read, so nothing was written: ${error.message}`);
  }
  try {
    copied(path, text);
  } catch (error) {
    fail(`--adopt: ${held} was read and ${path} could not be written, so nothing was adopted: `
      + `${error.message}`);
  }
  const back = readJson(path);
  if (!back || typeof back !== "object" || Array.isArray(back)) {
    fail(`--adopt: ${held} was copied to ${path} and that file does not read back as a table of this `
      + `project's keys, so nothing here can say what this machine now holds. Read it: \`${READS_IT}\``);
  }
  const keys = Object.keys(back);
  return [
    `Adopted ${held} into ${path} (mode 0600), which now reads back as:`,
    ...keys.map((key) => `  ${key}: ${asWritten(back[key])}  ← ${path}`),
    keys.length ? "" : "  (no keys — that file declared none)",
    `${held} is untouched and is read by nothing. Taking it out of the checkout is a commit and`,
    "is yours to make; leaving it costs nothing but the line this report prints about it.",
  ].filter((one) => one !== null);
};
