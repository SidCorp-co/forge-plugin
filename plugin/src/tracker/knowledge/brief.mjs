/* The project's brief and the sources under it: the one knowledge entry a run reads instead of learning the repository by hand, and the narrow writes that keep it true. Its prose is a run's — no program reads a repository's dangers out of its README — and what the CLI owns is whether the files it was read from moved. docs/cli/the-brief.md. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { accountCredentials, checkoutRoot, fail, keepOnFailure, slugIfAny }
  from "../../resolve/settings.mjs";

import { didYouMean } from "../../suggest.mjs";
import { bodyFrom } from "../../resolve/payload.mjs";
import { citedIn } from "../../checks/cited-paths.mjs";
import { CODE_SPAN_PATTERN } from "../../markdown.mjs";
import { SOURCE_MARK, WHY, goalLine, goalsIn, servesIn, servesRefusal } from "../../goals.mjs";
import { BRIEF_SLUG, metaFrom, same, softEntryAt, upsertEntry, wroteLines } from "./store.mjs";

const BRIEF_KIND = "overview";
/* Not a flag: a brief nobody injects is one a run still has to ask for, the call it exists to remove. */
const BRIEF_INJECTION = "always";
const DIGESTS = "digests";
const DIGEST_WIDTH = 16;
const SPANNED = new RegExp(CODE_SPAN_PATTERN, "gu");

/** Which lines read each source, 1-based. Only the tail after a line's mark is a source: the body
 *  maps the tree too, and hashing every path it cites would call the brief stale on any release
 *  that touched a module. One walk answers all three questions asked of it — what to hash, what a
 *  confirm has just vouched for, and which lines keep a shared source stale after a line is
 *  rewritten — because a digest is keyed by path and a caller acts on lines. */
const namersOf = (body) => {
  const found = new Map();
  for (const [index, line] of String(body ?? "").split("\n").entries()) {
    const at = line.lastIndexOf(SOURCE_MARK);
    if (at < 0) continue;
    for (const { path } of citedIn(line.slice(at + SOURCE_MARK.length))) {
      const held = found.get(path) ?? [];
      if (held.at(-1) !== index + 1) found.set(path, [...held, index + 1]);
    }
  }
  return found;
};

export const briefSources = (body) => [...namersOf(body).keys()].sort();

/** Every code span in a source position the path reader took nothing from. Not a judgement — a
 *  command's output is a source and is not a file — but a `Makefile` the writer meant is named in
 *  the same call rather than found untracked a release later. */
export const unhashable = (body) => {
  const found = new Set();
  for (const line of String(body ?? "").split("\n")) {
    const at = line.lastIndexOf(SOURCE_MARK);
    if (at < 0) continue;
    for (const [span] of line.slice(at).matchAll(SPANNED)) {
      if (!citedIn(span).length) found.add(span);
    }
  }
  return [...found].sort();
};

/* Against the project root: this is the project's own brief, read inside the checkout it pins. */
const hashOf = (path) => {
  try {
    return createHash("sha256").update(readFileSync(join(checkoutRoot(), path))).digest("hex")
      .slice(0, DIGEST_WIDTH);
  } catch {
    return null;
  }
};

/** Null rather than dropped: dropped, an unresolved source reaches no reader, and a brief naming
 *  only those would report as one naming none. */
export const digestsFor = (body) =>
  Object.fromEntries(briefSources(body).map((path) => [path, hashOf(path)]));

/** `gone`: named and no longer here. `moved`: here, and not the bytes the brief was read from. */
export const staleIn = (digests) => {
  const gone = [];
  const moved = [];
  for (const [path, hash] of Object.entries(digests ?? {})) {
    const now = hashOf(path);
    if (now === null) gone.push(path);
    else if (now !== hash) moved.push(path);
  }
  return { gone, moved };
};

const NONE_STORED = [
  "project brief: none stored, so Phase 0 has this project's files and nothing else",
  "  write one: forge doctor --refresh <brief.md> --title <one line> --meta written-by=ISS-nn",
];

const NO_SOURCES = "  no line of this brief names a source, so nothing was hashed and no later run "
  + "can be told which of them moved";

/** The margin `--line <n>` counts: every other view of this entry puts a different number of rows
 *  over the body, so a number read off one and spent here lands elsewhere. docs/cli/the-stale-line.md */
const numberedBody = (body) => {
  const lines = String(body ?? "").split("\n");
  const width = String(lines.length).length;
  return lines.map((line, at) => `${String(at + 1).padStart(width)}  ${line}`);
};

/** A read the store refused is never printed as an absence: a run that took it for one would write
 *  over a brief it never saw. */
export const briefLines = (read) => {
  if (!read) return [];
  if (read.refused) {
    return [`project brief: the store would not answer, so this is not an absence — ${read.refused}`];
  }
  if (!read.entry) return NONE_STORED;
  const digests = read.entry.metadata?.[DIGESTS] ?? {};
  const { gone, moved } = staleIn(digests);
  const out = [`project brief  ← the knowledge store, slug ${BRIEF_SLUG}, `
    + `written ${(read.entry.updatedAt ?? "").slice(0, 10)}`, goalLine(goalsIn(read.entry.body))];
  if (!Object.keys(digests).length) out.push(NO_SOURCES);
  if (moved.length) {
    out.push(`  stale: ${moved.join(", ")} — moved since the brief was read. Judge the lines naming `
      + "each against the file it names: where the prose still holds, forge doctor --confirm "
      + "<source>; where it does not, forge doctor --line <n> <text> --was <the line as it stands>");
  }
  if (gone.length) {
    out.push(`  gone: ${gone.join(", ")} — named as a source and not in this checkout`);
  }
  return [...out, "", ...numberedBody(read.entry.body)];
};

export const readBrief = async () => (slugIfAny() ? softEntryAt(BRIEF_SLUG) : null);

/** The refusal a body's own `Serves:` line earns, or null. The read of the brief is inside the guard because a body with no such line owes it none, and reading one is a tracker call: the two verbs that file spend this rather than each spelling that condition. */
export const servesOwed = async (text, what, asksTree = true) => {
  const values = servesIn(text);
  return values.length ? servesRefusal(values, await briefGoals(), what, asksTree) : null;
};

/** Not memoised: the store's answer is one project's, and `forge feedback` re-aims the scope. */
export const briefGoals = async () => {
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) return { goals: [], why: WHY.endpoint };
  const read = await readBrief();
  if (!read) return { goals: [], why: WHY.aimed };
  if (read.refused) return { goals: [], why: WHY.unread };
  return read.entry ? goalsIn(read.entry.body) : { goals: [], why: WHY.stored };
};

/** One call, so no hash is freshened without a body passing through the caller's hands — which is
 *  not proof it was corrected. docs/cli/the-brief.md states that edge. */
export const refreshBrief = async (path, { pairs, ...meta }) => {
  const body = await bodyFrom(path);
  if (path === "-") keepOnFailure(`Your brief, so that nothing here loses it:\n\n${body}`);
  const digests = digestsFor(body);
  const wrote = await upsertEntry({
    slug: BRIEF_SLUG,
    body,
    kind: BRIEF_KIND,
    title: meta.title,
    injection: BRIEF_INJECTION,
    confidence: meta.confidence,
    meta: { ...metaFrom(pairs), [DIGESTS]: digests },
  });
  const unread = unhashable(body);
  const named = Object.keys(digests);
  const missing = named.filter((path) => digests[path] === null);
  const hashed = named.filter((path) => digests[path] !== null);
  return [
    ...wroteLines(wrote),
    hashed.length
      ? `  digests: ${hashed.join(", ")}`
      : "  digests: none — no line of this brief names a source this checkout holds, so nothing "
        + "later can say one moved",
    ...(missing.length
      ? [`  named and not here: ${missing.join(", ")} — kept, and read back as gone until they appear`]
      : []),
    ...(unread.length
      ? [`  not hashed: ${unread.join(", ")} — named as a source and not read as a path, so nothing `
        + "later can say one moved"]
      : []),
  ];
};

/* The two narrow writes. Re-handing fifty lines to fix the one whose source moved is the shape that
   made two runs leave a stale brief alone rather than race a Phase 0 reading it. the-brief.md. */
const NO_BRIEF = "there is no brief stored, so no line of one can be confirmed or replaced.\n"
  + "  write one: forge doctor --refresh <brief.md> --title <one line> --meta written-by=ISS-nn";

/* Held against the same rule the whole-file write answers to: a store that would not answer is not
   a store with no brief, and a write on that reading would replace what this call never saw. */
const storedBrief = async () => {
  const read = await readBrief();
  if (read?.refused) {
    fail(`the store would not answer for ${BRIEF_SLUG}, and a write here would replace a brief this `
      + `call never read: ${read.refused}`);
  }
  if (!read?.entry) fail(NO_BRIEF);
  return read.entry;
};

const heldPart = (entry) => ({ body: entry?.body, digests: entry?.metadata?.[DIGESTS] });

/** No conditional write exists here, so a narrow write's window is made loud rather than closed: it
 *  re-reads and refuses, because restoring prose another session wrote while reporting that nothing
 *  changed is worse than the staleness. Title and confidence are named and left undefined since the
 *  upsert carries only a field the caller NAMED, and leaving them out sends the brief back untitled. */
const wroteBrief = async (was, body, digests) => {
  const now = await storedBrief();
  if (!same(heldPart(now), heldPart(was))) {
    fail("the brief moved between this call's read and its write, so the body this call is holding "
      + "would put back prose another session has already replaced. Nothing was written — read it "
      + "again and judge the line as it now stands: forge doctor");
  }
  return upsertEntry({
    slug: BRIEF_SLUG,
    body,
    kind: BRIEF_KIND,
    injection: BRIEF_INJECTION,
    title: undefined,
    confidence: undefined,
    meta: { [DIGESTS]: digests },
  });
};

const atLines = (numbers) =>
  `${numbers.length > 1 ? "lines" : "line"} ${numbers.join(", ")}`;

/** A prefix the caller retypes, which must open exactly the line the number names — docs/cli/the-stale-line.md. */
const wrongLine = (lines, at, was) => {
  const opens = lines.map((line, one) => (line.startsWith(was) ? one + 1 : 0)).filter(Boolean);
  const reads = `Line ${at} reads: ${lines[at - 1]}`;
  if (!opens.length) return `no line of the brief begins \`${was}\`. ${reads}.`;
  if (opens.length > 1) {
    return `\`${was}\` opens ${atLines(opens)}, so it does not say which of them is meant — name `
      + `more of the line. ${reads}.`;
  }
  return opens[0] === at ? null : `\`${was}\` opens line ${opens[0]}, not line ${at}. ${reads}.`;
};

/** The caller has read the lines naming this source against the file as it now is, and their prose
 *  still holds — so the digest alone is re-stamped and the body goes back byte for byte. What it
 *  covered is printed, because a digest is a path's and the caller vouched for lines. */
export const confirmSource = async (source) => {
  const entry = await storedBrief();
  const body = entry.body ?? "";
  const digests = entry.metadata?.[DIGESTS] ?? {};
  if (!Object.hasOwn(digests, source)) {
    fail(didYouMean("source of this brief", source, Object.keys(digests).sort(),
      "`forge doctor` prints the brief and the source each line was read from."));
  }
  const now = hashOf(source);
  if (now === null) {
    return [`gone: ${source} is named as a source and is not in this checkout, so there are no `
      + "bytes to confirm the brief against. Nothing was written."];
  }
  if (now === digests[source]) {
    return [`${source} holds the bytes the brief was read from, so nothing moved and nothing was `
      + "written."];
  }
  const covered = namersOf(body).get(source) ?? [];
  return [
    ...wroteLines(await wroteBrief(entry, body, { ...digests, [source]: now })),
    `  confirmed: ${source} ${digests[source] ?? "unhashed"} → ${now}`,
    `  read again and still holding: ${covered.length ? atLines(covered) : "no line names it now"}`
      + " — this call changed no prose, and every other digest is as it was stored",
  ];
};

/** One line's prose, replaced. A digest is keyed by path and not by line, so a source another line
 *  also reads is left stale here and named: stamping it would clear that other line over prose
 *  nobody looked at, which is the silent staleness the `stale:` line exists to prevent. Once those
 *  lines have been judged too, `--confirm` is what closes the source. */
export const replaceBriefLine = async (given, text, was) => {
  const entry = await storedBrief();
  const lines = (entry.body ?? "").split("\n");
  if (!/^[1-9]\d*$/u.test(given) || Number(given) > lines.length) {
    fail(`--line takes a line of the stored brief, 1 to ${lines.length}, and \`${given}\` is not `
      + "one. `forge doctor` prints the brief with those numbers down its margin.");
  }
  const at = Number(given);
  if (text.includes("\n")) {
    fail("--line replaces one line and this text holds a newline. A brief whose prose has to move "
      + "across lines is a brief being rewritten: forge doctor --refresh <brief.md>");
  }
  const wrong = wrongLine(lines, at, was);
  if (wrong) fail(`--was names the line --line replaces, and ${wrong} Nothing was written.`);
  if (lines[at - 1] === text) return [`line ${at} already reads that, so nothing was written.`];
  const body = [...lines.slice(0, at - 1), text, ...lines.slice(at)].join("\n");
  const before = entry.metadata?.[DIGESTS] ?? {};
  const namers = namersOf(body);
  const digests = {};
  const stamped = [];
  const shared = [];
  for (const path of [...namers.keys()].sort()) {
    const also = namers.get(path).filter((one) => one !== at);
    if (also.length) {
      digests[path] = Object.hasOwn(before, path) ? before[path] : hashOf(path);
      if (namers.get(path).includes(at)) shared.push({ path, also });
    } else {
      digests[path] = hashOf(path);
      stamped.push(path);
    }
  }
  const dropped = Object.keys(before).filter((path) => !namers.has(path));
  const unread = unhashable(text);
  const missing = stamped.filter((path) => digests[path] === null);
  const hashed = stamped.filter((path) => digests[path] !== null);
  return [
    ...wroteLines(await wroteBrief(entry, body, digests)),
    `  line ${at} was: ${lines[at - 1]}`,
    `  line ${at} now: ${text}`,
    ...(hashed.length
      ? [`  stamped: ${hashed.join(", ")} — no other line of the brief reads `
        + `${hashed.length > 1 ? "them" : "it"}`]
      : []),
    ...shared.map(({ path, also }) =>
      `  left stale: ${path} is also read by ${atLines(also)}, so its digest is not stamped here — `
      + `stamping it would clear ${also.length > 1 ? "those lines" : "that line"} over prose nobody `
      + `looked at. Once ${also.length > 1 ? "they hold" : "it holds"} too: forge doctor --confirm ${path}`),
    ...(dropped.length
      ? [`  dropped: ${dropped.join(", ")} — no line of the brief names ${dropped.length > 1 ? "them" : "it"} now`]
      : []),
    ...(missing.length
      ? [`  named and not here: ${missing.join(", ")} — kept, and read back as gone until they appear`]
      : []),
    ...(unread.length
      ? [`  not hashed: ${unread.join(", ")} — named as a source and not read as a path, so nothing `
        + "later can say one moved"]
      : []),
  ];
};
