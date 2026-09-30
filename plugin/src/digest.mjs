/* The sixteen-hex-digit name a stamp, a plan-scope entry, a shown-ledger credit, a decision id and a linted file's content are all keyed by, so a key one release wrote is the key the next one reads. Sixteen digits is 64 bits: two inputs sharing a name read as one, which every reader accepts as the price of a short key. It imports nothing but `node:crypto`, so a hook's path pays for no module of the reader it is spent by. */
import { createHash } from "node:crypto";

/** Bytes are hashed as they are, since decoding them first would give two files one name; anything else as its string. */
export const digestOf = (text) =>
  createHash("sha1").update(text instanceof Uint8Array ? text : String(text)).digest("hex").slice(0, 16);
