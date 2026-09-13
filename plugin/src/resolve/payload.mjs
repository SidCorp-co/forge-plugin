/* One home for where a payload comes from. A terminal sends no EOF, and neither does a harness's
   stdin with nothing on it: two consults waited 17 and 13 minutes on one (ISS-65). What is bounded
   is silence — before the first byte and between any two — because a producer that writes one byte
   and stops is the same wait. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FLAG_WORD, typedArgv } from "./flags.mjs";
import { fail } from "./settings.mjs";

const NAMED = "Write it to a file and name it, or pipe it in.";
/* A read that failed after a chunk is a truncated payload, so it is refused rather than returned. */
/* A payload is the command and an intent is an aside, so the one nothing proceeds without waits. */
export const INTENT_MS = 2_000;
export const PAYLOAD_MS = 10_000;
const SILENT = Symbol("silent");

export const stdinText = async (stream = process.stdin, ms = INTENT_MS) => {
  if (stream.isTTY) return null;
  const chunks = [];
  let armed = null;
  let ended = null;
  let arm = () => {};
  const silent = new Promise((done) => {
    arm = () => {
      clearTimeout(armed);
      armed = setTimeout(done, ms, SILENT);
    };
    arm();
    stream.on("data", arm);
  });
  const stop = () => {
    /* EOF with no chunk would hold the process alive for a deadline nothing needs, and a listener
       left on a stream two calls share re-arms a timer nobody is waiting on. */
    clearTimeout(armed);
    stream.off("data", arm);
  };
  const reading = (async () => {
    try {
      for await (const chunk of stream) chunks.push(chunk);
    } catch (error) {
      ended = error;
    } finally {
      stop();
    }
    return "";
  })();
  if (await Promise.race([silent, reading]) === SILENT) {
    stop();
    stream.destroy();
    if (!chunks.length) return null;
    fail(`stdin went silent for ${ms / 1000}s after ${Buffer.concat(chunks).length} byte(s). Whatever `
      + `is feeding it did not finish, and a payload read in half is worse than none: ${NAMED}`);
  }
  await reading;
  if (ended) fail(`stdin could not be read: ${ended.message}. Nothing was used of what came before it.`);
  return Buffer.concat(chunks).toString("utf8");
};

const fromStdin = async () => {
  const text = await stdinText(process.stdin, PAYLOAD_MS);
  if (text === null) {
    fail(`\`-\` reads the payload from stdin, and nothing fed it inside ${PAYLOAD_MS / 1000}s: it is `
      + `a terminal, or a pipe nobody is writing to. ${NAMED}`);
  }
  if (!text.trim()) fail(`\`-\` read nothing from stdin. ${NAMED}`);
  return text;
};

/* A path opening with two dashes is a flag, not a file — docs/cli/the-usage-row.md (ISS-240). */
export const notABody = (path) =>
  `\`${path}\` is a flag, not a body: this slot takes a file, \`@file\`, or \`-\` for stdin. A file `
  + `whose own name opens that way is passed as \`./${path}\`.`;

/* `fs` names a file nobody meant to open (ISS-842); a path meant and missing still reaches it,
   against the reader's own directory, which is not always this process's. */
const SEPARATED = /[\\/]/u;
export const bodyItself = (path, cwd = process.cwd()) => {
  const named = path.startsWith("@") ? path.slice(1) : path;
  return named.includes("\n")
    || (/\s/u.test(named) && !SEPARATED.test(named) && !existsSync(resolve(cwd, named)));
};

const QUOTED = 60;
const shown = (path) => {
  const cut = [...path.split("\n", 1)[0]].slice(0, QUOTED).join("");
  return cut === path ? cut : `${cut}…`;
};

/* The slot is the one occurrence no flag word owns, else the only one there is: nothing prints
   where two could be it, a wrong replacement being worse than none (ISS-842). */
const formsFor = (path, piped) => {
  const typedIn = typedArgv();
  if (!typedIn) return null;
  const argv = process.argv.slice(2);
  const held = argv.flatMap((one, index) =>
    (one === path && !FLAG_WORD.test(argv[index - 1] ?? "") ? [index] : []));
  const only = argv.indexOf(path) === argv.lastIndexOf(path);
  const at = held.length === 1 ? held[0] : (held.length === 0 && only ? argv.indexOf(path) : -1);
  if (at < 0) return null;
  const call = (fill) => ["forge", ...typedIn.with(at, fill)].join(" ");
  const forms = [call("body.md"), ...(piped ? [`echo "<the body>" | ${call("-")}`] : [])];
  return `\n\nDo this, with the body you have in hand:\n  ${forms.join("\n  ")}`;
};

/** `piped` false where the caller's gate refuses a pipe, so no printed form is one it turns away. */
export const notAPath = (path, piped = true) =>
  `\`${shown(path)}\` is the body itself, not a path to one: this slot takes ${piped
    ? "a file, `@file`, or `-` for stdin"
    : "a file, and the consult behind it is shown that path itself, never an `@file` and never a pipe"}.`
  + `${formsFor(path, piped) ?? ` ${piped ? NAMED : "Write it to a file and name it."}`}`;

export const bodyFrom = async (path, refusal = null) => {
  if (path.startsWith("--")) fail(refusal ?? notABody(path));
  if (path === "-") return fromStdin();
  if (bodyItself(path)) fail(notAPath(path));
  return readFileSync(path.startsWith("@") ? path.slice(1) : path, "utf8");
};
