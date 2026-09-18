/* The project's knowledge store as a client. `forge knowledge` is one caller and the project brief another, so it lives beside the tracker's other clients rather than inside either verb. docs/cli/knowledge.md. */
import { fail, keepOnFailure } from "../../resolve/settings.mjs";
import { pairOf } from "../../resolve/flags.mjs";
import { refuseCredential, scoped, write } from "../rest.mjs";

export const SLUG_WIDTH = 28;
export const KIND_WIDTH = 10;

/* Nothing is carried over to a create, so a create says which fields it is refusing to guess: the tracker labels a kindless entry `guide`, which mislabels a reference rather than under-labelling it, and no later reader can tell that from a deliberate one. */
const NO_KIND = "a new entry needs --kind: forge_knowledge labels one that names no kind `guide`, "
  + "and a reference filed as a guide reads as somebody's choice. `forge knowledge -h` prints the set.";

/* The tracker's whole phrase and not `not found`: a scope refusal naming a project that is not found would send the write down the create branch, over the row it could not read. */
const ABSENT = /knowledge entry not found/iu;

/* The one slug `forge knowledge write` refuses; here because this is the store's home. docs/cli/the-brief.md. */
export const BRIEF_SLUG = "project-brief";

export const entryAt = async (slug) => {
  const answer = await scoped("forge_knowledge", { action: "get", slug }, true);
  if (!answer?.refused) return answer;
  if (ABSENT.test(answer.refused)) return null;
  return fail(`the store could not be read for ${slug}, and a write here would replace what it `
    + `holds without carrying any of it: ${answer.refused}`);
};

/** The same read without the refusal, for a reader that prints rather than writes: an absent entry and a store that would not answer are two different sentences, and only the first is an absence. */
export const softEntryAt = async (slug) => {
  const answer = await scoped("forge_knowledge", { action: "get", slug }, true);
  if (!answer?.refused) return { entry: answer };
  return ABSENT.test(answer.refused) ? { entry: null } : { refused: answer.refused };
};

export const entryLine = (row) =>
  `${(row.slug ?? "").padEnd(SLUG_WIDTH)} ${(row.kind ?? "").padEnd(KIND_WIDTH)} `
  + `${(row.injection ?? "").padEnd(10)} ${(row.confidence ?? "").padEnd(10)} `
  + `${(row.updatedAt ?? "").slice(0, 10)}  ${row.title ?? ""}`;

/* Overlaid on what is stored rather than replacing it: a correction adds `correctedBy` and keeps what was there. */
export const metaFrom = (pairs) => {
  const out = {};
  for (const pair of pairs) {
    const { key, value } = pairOf(pair, "--meta");
    out[key] = value;
  }
  return out;
};

/* A field the tracker holds is compared through this rather than by identity: the store round-trips metadata through json, which does not promise the key order it was handed. */
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
};

export const same = (one, two) => JSON.stringify(stable(one)) === JSON.stringify(stable(two));

/* The tracker's upsert replaces the whole row, so a field the caller did not name is carried from what is stored rather than left to a default that would silently relabel the entry, and what was carried is said, because a write that keeps a value nobody typed is still a write about it.
   A stored null is left out: no field carried here is nullable in the store and the schema takes none, so sending one would turn a keep into a refusal. */
const carried = (given, stored) => {
  const kept = [];
  const out = {};
  for (const [field, value] of Object.entries(given)) {
    if (value !== undefined) {
      out[field] = value;
      continue;
    }
    if (stored?.[field] === undefined || stored?.[field] === null) continue;
    /* And nothing from an empty one: `metadata {}` named in the carry line is a field the reader has to check to find that nothing was kept in it. */
    if (typeof stored[field] === "object" && !Object.keys(stored[field]).length) continue;
    out[field] = stored[field];
    kept.push(`${field} ${typeof stored[field] === "object" ? JSON.stringify(stored[field]) : stored[field]}`);
  }
  return { payload: out, kept };
};

/** One home for the write, spent by the `knowledge` verb and by the project verb's brief: the not-found reading, the carry, the credential seat and the read-back are the store's rules, not a caller's. */
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
