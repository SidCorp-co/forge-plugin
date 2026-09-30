/* A short name for a text or a file's bytes, where a key has to be stable and a collision costs a cache miss rather than a wrong answer. It imports nothing but `node:crypto`, so a hook's path pays for no module of the reader it is spent by. */
import { createHash } from "node:crypto";

/** Bytes are hashed as they are, since decoding them first would give two files one name; anything else as its string. */
export const digestOf = (text) =>
  createHash("sha1").update(text instanceof Uint8Array ? text : String(text)).digest("hex").slice(0, 16);
