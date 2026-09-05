/* The project's knowledge store — what a run learned of this codebase, read by the next one before
   the code is. Entries are the tracker's and nothing here writes a file. docs/cli/knowledge.md. */
import { fail, keepOnFailure } from "../resolve/settings.mjs";
import { bodyFrom } from "../resolve/payload.mjs";
import { enumAt, refuseCredential, scoped, write } from "../tracker/rpc.mjs";
import { flags, pullRepeated, wantsHelp } from "../resolve/flags.mjs";
import { didYouMean, unknownFlag } from "../suggest.mjs";

const SLUG_WIDTH = 28;
const KIND_WIDTH = 10;
const HITS = 10;
const MAX_HITS = 50;

export const USAGE = [
  "Usage: forge knowledge <list|get|write|search|delete> [args]",
  "The project's knowledge store: what a run learned of this codebase. Entries live in the",
  "tracker, never in the checkout, and the tracker embeds each body for the search below.",
  "",
  "  list [--kind K] [--injection I]        one line per entry, newest first; no bodies",
  "  get <slug>                             the entry's fields, then its body as markdown",
  "  write <slug> <file.md|@file|-> --kind K [--title T] [--injection I] [--confidence C]",
  "                                         [--meta k=v]...  upsert by slug, read back after",
  "  search <query> [--limit n]             the store by meaning, nearest first",
  "  delete <slug>                          remove it, and say whether there was one",
  "",
  "The values --kind, --injection and --confidence take are the tracker's own: `forge schema forge_knowledge`",
  "prints them, and one outside the set is refused with the set before anything is sent.",
  "",
  "An entry says what is, and cites where it was read: a path, a commit, an issue key. A rule two",
  "runs each half-followed is an entry only with the two places that show it, named in the body.",
  "The one-home rule holds here as it holds for a document — an entry restating a rules file is a",
  "second copy, and the reader who finds the overlap is the one who refuses it.",
].join("\n");

/* Nothing is carried over to a create, so a create says which fields it is refusing to guess: the
   tracker labels a kindless entry `guide`, which mislabels a reference rather than under-labelling
   it, and no later reader can tell that from a deliberate one. */
const NO_KIND = "a new entry needs --kind: forge_knowledge labels one that names no kind `guide`, "
  + "and a reference filed as a guide reads as somebody's choice. `forge schema forge_knowledge` "
  + "prints the set.";

const asked = (verb, argv, usage) => {
  const said = unknownFlag(verb, argv, { usage });
  if (said) fail(said);
};

/* The tool's own enum and never a copy, read off the declaration this endpoint answered with — which
   is cached per endpoint, so the refusal carries what re-reads it. A schema declaring no enum
   refuses nothing: silence is not an empty set. */
const checked = async (value, field) => {
  if (value === undefined) return undefined;
  const allowed = await enumAt("forge_knowledge", [field, "enum"]);
  if (allowed.length && !allowed.includes(value)) {
    fail(`${didYouMean(field, value, allowed)} That set is the tool declaration this machine has `
      + `cached; \`forge doctor\` re-reads it after the tracker grows a value.`);
  }
  return value;
};

/* The tracker's whole phrase, probed live, not `not found`: a scope refusal naming a project that is
   not found would send the write down the create branch, over the row it could not read. */
const ABSENT = /knowledge entry not found/iu;

/* The one slug this verb refuses; here because this is the store's home. docs/cli/the-brief.md. */
export const BRIEF_SLUG = "project-brief";

export const entryAt = async (slug) => {
  const answer = await scoped("forge_knowledge", { action: "get", slug }, true);
  if (!answer?.refused) return answer;
  if (ABSENT.test(answer.refused)) return null;
  return fail(`the store could not be read for ${slug}, and a write here would replace what it `
    + `holds without carrying any of it: ${answer.refused}`);
};

/** The same read without the refusal, for a reader that prints rather than writes: an absent entry
 *  and a store that would not answer are two different sentences, and only the first is an absence. */
export const softEntryAt = async (slug) => {
  const answer = await scoped("forge_knowledge", { action: "get", slug }, true);
  if (!answer?.refused) return { entry: answer };
  return ABSENT.test(answer.refused) ? { entry: null } : { refused: answer.refused };
};

const slugsHere = async () => {
  const page = await scoped("forge_knowledge", { action: "list" });
  return (page?.rows ?? []).map((row) => row.slug);
};

const noSuchEntry = async (slug) =>
  fail(didYouMean("entry", slug, await slugsHere(),
    "`forge knowledge list` prints what this project's store holds."));

export const entryLine = (row) =>
  `${(row.slug ?? "").padEnd(SLUG_WIDTH)} ${(row.kind ?? "").padEnd(KIND_WIDTH)} `
  + `${(row.injection ?? "").padEnd(10)} ${(row.confidence ?? "").padEnd(10)} `
  + `${(row.updatedAt ?? "").slice(0, 10)}  ${row.title ?? ""}`;

/* An empty store printed as nothing reads as a call that failed, and until the first reading writes
   to it that is the answer every run gets — so the empty case says which verb fills it. */
const list = async (argv) => {
  asked("knowledge list", argv, USAGE);
  const given = flags(argv, "knowledge list");
  const kindFilter = await checked(given.kind, "kind");
  const injectionFilter = await checked(given.injection, "injection");
  const filtered = Boolean(kindFilter || injectionFilter);
  const page = await scoped("forge_knowledge", {
    action: "list",
    ...(kindFilter ? { kindFilter } : {}),
    ...(injectionFilter ? { injectionFilter } : {}),
  });
  const rows = page?.rows ?? [];
  for (const row of rows) console.log(entryLine(row));
  console.log(`\n${rows.length} entr${rows.length === 1 ? "y" : "ies"}`);
  if (!rows.length && !filtered) {
    console.log("Nothing has been written to this project's store yet: forge knowledge write "
      + "<slug> <file.md> --kind K");
  }
};

const FIELDS = ["slug", "kind", "injection", "confidence", "authoredBy", "updatedAt"];

/* The body as markdown and not escaped inside json, for the reason `guide` prints its own that way:
   every `\n` of a body a reader is meant to read tokenizes worse than the character. */
const get = async ([slug, ...rest]) => {
  if (!slug) fail(`Usage: forge knowledge get <slug>\n${USAGE}`);
  asked("knowledge get", rest, USAGE);
  const entry = await entryAt(slug);
  if (!entry) await noSuchEntry(slug);
  for (const field of FIELDS) console.log(`${field}: ${entry[field] ?? ""}`);
  if (Object.keys(entry.metadata ?? {}).length) {
    console.log(`metadata: ${JSON.stringify(entry.metadata)}`);
  }
  console.log(`title: ${entry.title ?? ""}\n`);
  console.log(entry.body ?? "");
};

/* `k=v`, splitting on the first `=` only, so a value carrying one survives. Overlaid on what is
   stored rather than replacing it: a correction adds `correctedBy` and keeps what was there. */
export const metaFrom = (pairs) => {
  const out = {};
  for (const pair of pairs) {
    const at = pair.indexOf("=");
    if (at < 1) fail(`--meta takes \`key=value\`, not \`${pair}\`.`);
    out[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return out;
};

/* A field the tracker holds is compared through this rather than by identity: the store round-trips
   metadata through json, which does not promise the key order it was handed. */
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
};

export const same = (one, two) => JSON.stringify(stable(one)) === JSON.stringify(stable(two));

/* The tracker's upsert replaces the whole row, so a field the caller did not name is carried from
   what is stored rather than left to a default that would silently relabel the entry. What was
   carried is said, because a write that keeps a value nobody typed is still a write about it. A
   stored null is left out and not carried: no field carried here is nullable in the store, and the
   schema takes none, so sending one would turn a keep into a refusal. */
const carried = (given, stored) => {
  const kept = [];
  const out = {};
  for (const [field, value] of Object.entries(given)) {
    if (value !== undefined) {
      out[field] = value;
      continue;
    }
    if (stored?.[field] === undefined || stored?.[field] === null) continue;
    /* And nothing is carried from an empty one: `metadata {}` named in the carry line is a field
       the reader has to check to find that nothing was kept in it. */
    if (typeof stored[field] === "object" && !Object.keys(stored[field]).length) continue;
    out[field] = stored[field];
    kept.push(`${field} ${typeof stored[field] === "object" ? JSON.stringify(stored[field]) : stored[field]}`);
  }
  return { payload: out, kept };
};

const WRITE_USAGE = "Usage: forge knowledge write <slug> <file.md|@file|-> --kind K [--title T] "
  + "[--injection I] [--confidence C] [--meta k=v]...";

/** One home for the write, spent by this verb and by the project verb's brief: the not-found
 *  reading, the carry, the credential seat and the read-back are the store's rules, not a caller's. */
export const upsertEntry = async ({ slug, body, meta = {}, ...given }) => {
  const stored = await entryAt(slug);
  if (!stored && !given.kind) fail(NO_KIND);
  if (!stored && !given.title) fail("a new entry needs --title; the tracker refuses an untitled one.");
  if (!body.trim()) fail("an empty body would store nothing; pass the entry itself.");
  const metadata = Object.keys(meta).length ? { ...(stored?.metadata ?? {}), ...meta } : undefined;
  const { payload, kept } = carried({ ...given, metadata }, stored);
  await refuseCredential({ slug, ...payload, body }, "The knowledge entry this write was about to send");
  const sent = { body, ...payload };
  await write("forge_knowledge", { action: "upsert", slug, ...sent });
  keepOnFailure(null);
  const back = await entryAt(slug);
  if (!back) fail(`forge_knowledge answered success but ${slug} is not in the store. Nothing was written.`);
  const dropped = Object.keys(sent).filter((field) => !same(sent[field], back[field]));
  if (dropped.length) {
    fail(`forge_knowledge answered success and ${slug} came back with ${dropped.join(", ")} not as `
      + `sent, so the entry now holds something no caller asked for. Read it: forge knowledge get ${slug}`);
  }
  return { back, kept, replaced: Boolean(stored) };
};

/** What a caller prints after a write, so two writers say the same thing about the same act. */
export const wroteLines = ({ back, kept, replaced }) => [
  `${replaced ? "replaced" : "created"}  ${entryLine(back)}`,
  ...(kept.length
    ? [`  carried from the stored entry, which this upsert would otherwise have replaced: ${kept.join(", ")}`]
    : []),
];

const written = async (argv) => {
  const { values: pairs, rest } = pullRepeated(argv, "--meta", "knowledge write");
  const [slug, path, ...flagArgv] = rest;
  if (!slug || !path) fail(`${WRITE_USAGE}\n${USAGE}`);
  if (slug === BRIEF_SLUG) {
    fail(`${BRIEF_SLUG} is the project verb's: a write here would replace the body and keep the `
      + `digests of the body it replaced, so the next run reads a brief nothing says has moved.\n`
      + `  forge project --refresh ${path}`);
  }
  asked("knowledge write", flagArgv, WRITE_USAGE);
  const given = flags(flagArgv, "knowledge write");
  const kind = await checked(given.kind, "kind");
  const injection = await checked(given.injection, "injection");
  const confidence = await checked(given.confidence, "confidence");
  const body = await bodyFrom(path);
  if (path === "-") keepOnFailure(`Your entry, so that nothing here loses it:\n\n${body}`);
  const wrote = await upsertEntry({
    slug, body, kind, title: given.title, injection, confidence, meta: metaFrom(pairs),
  });
  for (const said of wroteLines(wrote)) console.log(said);
};

const limitFrom = (raw) => {
  if (raw === undefined) return HITS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_HITS) {
    fail(`--limit takes an integer from 1 to ${MAX_HITS}, not \`${raw}\`.`);
  }
  return value;
};

const search = async ([query, ...rest]) => {
  if (!query) fail(`Usage: forge knowledge search <query> [--limit n]\n${USAGE}`);
  asked("knowledge search", rest, USAGE);
  const { limit } = flags(rest, "knowledge search");
  const answer = await scoped("forge_knowledge", { action: "search", query, topK: limitFrom(limit) });
  const hits = answer?.knowledge ?? [];
  for (const hit of hits) {
    console.log(`${(hit.score ?? 0).toFixed(2)}  ${(hit.slug ?? "").padEnd(SLUG_WIDTH)} `
      + `${(hit.kind ?? "").padEnd(KIND_WIDTH)} ${hit.title ?? ""}`);
  }
  console.log(`\n${hits.length} hit(s) for \`${query}\``);
};

/* The tracker's delete is idempotent and says which it was, so the caller hears that rather than a
   success that reads the same whether an entry was there or not. */
const remove = async ([slug, ...rest]) => {
  if (!slug) fail(`Usage: forge knowledge delete <slug>\n${USAGE}`);
  asked("knowledge delete", rest, USAGE);
  await refuseCredential({ slug }, "The slug this delete was about to send");
  const answer = await write("forge_knowledge", { action: "delete", slug });
  console.log(answer?.deleted
    ? `deleted  ${slug}`
    : `no entry named ${slug} was in the store, so nothing was deleted.`);
};

const SUBS = { list, get, write: written, search, delete: remove };

export const knowledge = async ([sub, ...rest]) => {
  if (wantsHelp([sub]) || !sub) return console.log(USAGE);
  if (!Object.hasOwn(SUBS, sub)) {
    fail(`${didYouMean("knowledge action", sub, Object.keys(SUBS))}\n\n${USAGE}`);
  }
  await SUBS[sub](rest);
};

knowledge.answersHelp = true;
