/* A run home that borrows this machine's credentials by reference rather than holding a copy. A run
   that must write nothing into the machine's own logs points XDG_CONFIG_HOME at a home of its own,
   and that home is all or nothing: without a reference to borrow through, the one way it reached
   live data was a copy of the token in world-traversable scratch, which four runs of one day made
   and a run dying mid-way would leave behind (ISS-2612). The reference names a file and never a
   value, so the machine's file stays the one source a credential has. docs/cli/settings.md. */
import { readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export const BORROW_VAR = "FORGE_BORROW_FROM";

/* Which keys a run home may borrow, and which of them are secret: the one declaration of both, beside
   the table of this machine's harness keys, which a test holds this list to. `secret` is what a
   workspace's ending searches its scratch for, so an endpoint is borrowed and never searched for — a
   url turns up in every log that ever named it. Google's tokens are left out: a refresh rewrites
   them, and a write this home refuses there would break the run rather than protect anything. */
export const BORROWED = [
  { key: "url" },
  { key: "token", secret: true },
  { key: "codex.url" },
  { key: "codex.key", secret: true },
  { key: "vi.url" },
  { key: "vi.key", secret: true },
  { key: "chatgpt.url" },
  { key: "chatgpt.key", secret: true },
  { key: "anthropic.url" },
  { key: "anthropic.key", secret: true },
  { key: "coolify.url" },
  { key: "coolify.apiToken", secret: true },
  { key: "cloudflare.accounts", secret: true },
];

const partsOf = (key) => key.split(".");

export const valueAt = (values, key) => partsOf(key)
  .reduce((held, part) => (held && typeof held === "object" ? held[part] : undefined), values);

/* A copy along the path and never an edit of the object handed in, which is the run home's memo. */
const settled = (values, parts, value) => {
  const [head, ...rest] = parts;
  const held = values && typeof values === "object" && !Array.isArray(values) ? values : {};
  const next = rest.length ? settled(held[head], rest, value) : value;
  const copy = { ...held };
  if (next === undefined) delete copy[head];
  else copy[head] = next;
  return copy;
};

export const isBorrowed = (key) => BORROWED.some((row) => key === row.key || key.startsWith(`${row.key}.`));

/* The printed route out of every refusal below: the variable unset, which is the home reading its own
   file again, or a path naming the machine's config, which is what `start` prints. */
const UNSET = `unset ${BORROW_VAR}, or set it to the absolute path of this machine's own forge config.json`;

const refused = (message) => {
  console.error(message);
  process.exit(1);
};

const sameFile = (one, other) => {
  const real = (path) => {
    try {
      return realpathSync(path);
    } catch {
      return resolve(path);
    }
  };
  return real(one) === real(other);
};

/* Refused rather than read as no credential: a borrow that answered nothing sent a run to the
   no-endpoint refusal, which names the run home's file and not the reference that failed. */
const readBorrowed = (path, own) => {
  const said = `${BORROW_VAR}=${path}`;
  if (!isAbsolute(path)) refused(`${said} is not an absolute path, so which file it names turns on where this call stands. Nothing was read: ${UNSET}.`);
  if (sameFile(path, own)) {
    refused(`${said} names ${own}, the config this home already reads, so there is nothing to borrow. `
      + `A run borrows into a home of its own: point XDG_CONFIG_HOME at a directory under the run's scratch, or ${UNSET}.`);
  }
  let values;
  try {
    values = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    refused(`${said} names a file that does not read as a config (${error.code ?? error.message}), so no borrowed key `
      + `resolves. Nothing was read: ${UNSET}.`);
  }
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    refused(`${said} names a file holding no JSON object, so no borrowed key resolves. Nothing was read: ${UNSET}.`);
  }
  return values;
};

/** The file this home borrows from and what it holds now, read at every call so a value is the one it
 *  holds at the moment of use; null where the home borrows nothing. */
export const borrowing = (own) => {
  const path = process.env.FORGE_BORROW_FROM || null;
  return path ? { path, values: readBorrowed(path, own) } : null;
};

/** The run home's own values with every borrowed key replaced by the borrowed file's, or removed where
 *  that file holds none: a value the run home carries at a borrowed path is the very copy this ends. */
export const overlaid = (own, borrowed) => BORROWED
  .reduce((held, row) => settled(held, partsOf(row.key), valueAt(borrowed, row.key)), own);

/** Refuses a write naming any borrowed key before the file is touched. */
export const refuseBorrowedWrite = (values, borrowed, own) => {
  const named = BORROWED.filter((row) => valueAt(values, row.key) !== undefined).map((row) => row.key);
  if (!named.length) return;
  const home = dirname(dirname(borrowed));
  refused(`${named.map((key) => `\`${key}\``).join(" and ")} ${named.length > 1 ? "are" : "is"} borrowed from ${borrowed} `
    + `under ${BORROW_VAR}, so ${own} may not hold ${named.length > 1 ? "them" : "it"}: nothing was written. Write it `
    + `where it lives, from a shell that does not borrow: ${BORROW_VAR}= XDG_CONFIG_HOME=${home} and the same command.`);
};
