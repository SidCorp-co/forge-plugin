/* One home for where a payload comes from. A terminal sends no EOF, and neither does a harness's
   stdin with nothing on it: two consults waited 17 and 13 minutes on one (ISS-65). What is bounded
   is silence — before the first byte and between any two — because a producer that writes one byte
   and stops is the same wait. */
import { readFileSync } from "node:fs";

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

/* A path opening with two dashes is a flag, not a file — docs/cli/did-you-mean.md (ISS-240). */
export const notABody = (path) =>
  `\`${path}\` is a flag, not a body: this slot takes a file, \`@file\`, or \`-\` for stdin. A file `
  + `whose own name opens that way is passed as \`./${path}\`.`;

export const bodyFrom = async (path, refusal = null) => {
  if (path.startsWith("--")) fail(refusal ?? notABody(path));
  return path === "-" ? fromStdin() : readFileSync(path.startsWith("@") ? path.slice(1) : path, "utf8");
};
