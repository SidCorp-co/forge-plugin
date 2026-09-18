/* `forge knowledge` — the verb over the project's knowledge store: what a run learned of this
   codebase, read by the next one before the code is. Entries are the tracker's and nothing here
   writes a file. The store's own client is src/tracker/knowledge/store.mjs, which the project
   brief writes through as well. docs/cli/knowledge.md. */
import { fail, keepOnFailure } from "../resolve/settings.mjs";
import { bodyFrom } from "../resolve/payload.mjs";
import { declaredFor, declaredValue, refuseCredential, scoped, write } from "../tracker/rest.mjs";
import { BRIEF_SLUG, KIND_WIDTH, SLUG_WIDTH, entryAt, entryLine, metaFrom, upsertEntry, wroteLines }
  from "../tracker/knowledge/store.mjs";
import { flags, helpAskedOf, pullRepeated } from "../resolve/flags.mjs";
import { didYouMean } from "../suggest.mjs";

const HITS = 10;
const MAX_HITS = 50;

/* Derived, never copied: this help is the authority on what the store takes, so the sets come off the declaration the refusal cites and a value the tracker grows is added in one place. */
const setOf = (field) => declaredFor("forge_knowledge", field).join(" | ");

export const USAGE = [
  "Usage: forge knowledge <list|get|write|search|delete> [args]",
  "The project's knowledge store: what a run learned of this codebase. Entries live in the",
  "tracker, never in the checkout, and the tracker embeds each body for the search below.",
  "",
  "  list [--kind K] [--injection I]        one line per entry, newest first; no bodies",
  "  get <slug>                             the entry's fields, then its body as markdown",
  "  write <slug> <file.md|@file|-> --kind K [--title T] [--injection I] [--confidence C]",
  "                                         [--meta k=v]...  upsert by slug, read back after",
  "  search <query> [--limit n]             the records this project holds, by meaning, nearest first;",
  "                                         n rows at most, and the count says whether more may be held",
  "  delete <slug>                          remove it, and say whether there was one",
  "",
  `  --kind          ${setOf("kind")}`,
  `  --injection     ${setOf("injection")}`,
  `  --confidence    ${setOf("confidence")}`,
  "These are the tracker's own values, and one outside a set is refused with the set before anything",
  "is sent.",
  "",
  "An entry says what is, and cites where it was read: a path, a commit, an issue key. A rule two",
  "runs each half-followed is an entry only with the two places that show it, named in the body.",
  "The one-home rule holds here as it holds for a document — an entry restating a rules file is a",
  "second copy, and the reader who finds the overlap is the one who refuses it.",
].join("\n");

/* The route refuses a value outside the set without naming the set, so the check stands here and
   the set is the table's, whose own comment says what a refusal citing it owes its reader. */
const checked = (value, field) => {
  if (value === undefined) return undefined;
  const near = declaredValue("forge_knowledge", field, value);
  if (near) {
    fail(`${near} That set is this CLI's own declaration of what the `
      + `store takes, in \`plugin/src/tracker/routes.mjs\`, and the tracker names no set when it `
      + `refuses one: a value the tracker has grown since is added there.`);
  }
  return value;
};

const slugsHere = async () => {
  const page = await scoped("forge_knowledge", { action: "list" });
  return (page?.rows ?? []).map((row) => row.slug);
};

const noSuchEntry = async (slug) =>
  fail(didYouMean("entry", slug, await slugsHere(),
    "`forge knowledge list` prints what this project's store holds."));

const LIST_USAGE = "Usage: forge knowledge list [--kind K] [--injection I]";

/* An empty store printed as nothing reads as a call that failed, and until the first reading writes
   to it that is the answer every run gets — so the empty case says which verb fills it. */
const list = async (argv) => {
  const given = flags(argv, "knowledge list", [], { usage: LIST_USAGE });
  const kindFilter = checked(given.kind, "kind");
  const injectionFilter = checked(given.injection, "injection");
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

const GET_USAGE = "Usage: forge knowledge get <slug>";

/* The body as markdown and not escaped inside json, for the reason `guide` prints its own that way:
   every `\n` of a body a reader is meant to read tokenizes worse than the character. */
const get = async ([slug, ...rest]) => {
  if (!slug) fail(`${GET_USAGE}\n${USAGE}`);
  flags(rest, "knowledge get", [], { usage: GET_USAGE });
  const entry = await entryAt(slug);
  if (!entry) await noSuchEntry(slug);
  for (const field of FIELDS) console.log(`${field}: ${entry[field] ?? ""}`);
  if (Object.keys(entry.metadata ?? {}).length) {
    console.log(`metadata: ${JSON.stringify(entry.metadata)}`);
  }
  console.log(`title: ${entry.title ?? ""}\n`);
  console.log(entry.body ?? "");
};

const WRITE_USAGE = "Usage: forge knowledge write <slug> <file.md|@file|-> --kind K [--title T] "
  + "[--injection I] [--confidence C] [--meta k=v]...";

const written = async (argv) => {
  const { values: pairs, rest } = pullRepeated(argv, "--meta", "knowledge write", { usage: WRITE_USAGE });
  const [slug, path, ...flagArgv] = rest;
  if (!slug || !path) fail(`${WRITE_USAGE}\n${USAGE}`);
  if (slug === BRIEF_SLUG) {
    fail(`${BRIEF_SLUG} is the configuration report's: a write here would replace the body and keep `
      + `the digests of the body it replaced, so the next run reads a brief nothing says has moved.\n`
      + `  forge doctor --refresh ${path}`);
  }
  const given = flags(flagArgv, "knowledge write", [], { usage: WRITE_USAGE });
  const kind = checked(given.kind, "kind");
  const injection = checked(given.injection, "injection");
  const confidence = checked(given.confidence, "confidence");
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

const SEARCH_USAGE = "Usage: forge knowledge search <query> [--limit n]";

/* A reading the ask cut and one that exhausted the store print the same rows and the same count, so
   this line is what tells them apart. The bound is the caller's to apply: docs/cli/alike.md. */
const countLine = (query, shown, asked) =>
  `\n${shown} hit(s) for \`${query}\`, ${shown < asked
    ? `fewer than the ${asked} asked for, so the limit cut nothing from this answer`
    : "the whole of what was asked for, so the limit may have cut more"}.`;

const search = async ([query, ...rest]) => {
  if (!query) fail(`${SEARCH_USAGE}\n${USAGE}`);
  const { limit } = flags(rest, "knowledge search", [], { usage: SEARCH_USAGE });
  const asked = limitFrom(limit);
  const answer = await scoped("forge_memory.search", { query, topK: asked });
  const hits = (answer?.hits ?? []).slice(0, asked);
  for (const hit of hits) {
    const opens = String(hit.text ?? "").split("\n").find((one) => one.trim()) ?? "";
    console.log(`${(hit.score ?? 0).toFixed(2)}  ${String(hit.source ?? "").padEnd(KIND_WIDTH)} `
      + `${String(hit.sourceRef ?? "").padEnd(SLUG_WIDTH)} ${opens.slice(0, 90)}`);
  }
  console.log(countLine(query, hits.length, asked));
};

const DELETE_USAGE = "Usage: forge knowledge delete <slug>";

/* The tracker's delete is idempotent and says which it was, so the caller hears that rather than a
   success that reads the same whether an entry was there or not. */
const remove = async ([slug, ...rest]) => {
  if (!slug) fail(`${DELETE_USAGE}\n${USAGE}`);
  flags(rest, "knowledge delete", [], { usage: DELETE_USAGE });
  await refuseCredential({ slug }, "The slug this delete was about to send");
  const answer = await write("forge_knowledge", { action: "delete", slug });
  console.log(answer?.deleted
    ? `deleted  ${slug}`
    : `no entry named ${slug} was in the store, so nothing was deleted.`);
};

const SUBS = { list, get, write: written, search, delete: remove };

/* The one string each action's own refusal already spells, so neither can move without the other. */
export const SAYS = {
  list: LIST_USAGE, get: GET_USAGE, write: WRITE_USAGE, search: SEARCH_USAGE, delete: DELETE_USAGE,
};

export const knowledge = async ([sub, ...rest]) => {
  const help = helpAskedOf([sub, ...rest], Object.keys(SUBS));
  if (help || !sub) return console.log(SAYS[help?.subject] ?? USAGE);
  if (!Object.hasOwn(SUBS, sub)) {
    fail(`${didYouMean("knowledge action", sub, Object.keys(SUBS))}\n\n${USAGE}`);
  }
  await SUBS[sub](rest);
};

knowledge.answersHelp = true;
