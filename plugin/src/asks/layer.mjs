/* One project's precedent layer: every question its owner answered and every decision its sessions
   recorded, read out of that project's own transcripts into its own ask directory, and the shortlist
   a new question is judged against. Nothing here reads another project's transcripts or layer.
   plugin/hooks/how/ask-decide.md. */
import { closeSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { digestOf } from "../digest.mjs";
import { appendJsonlRows, jsonlAt, strictJsonlAt } from "../hooks/log/hook-log-file.mjs";
import { durableRootFor } from "../stats/corpus/corpus.mjs";
import { projectRepository } from "../resolve/settings.mjs";
import { withoutDeclaration } from "./declared.mjs";

export const OWNER_KIND = "owner";
export const DECISION_KIND = "decision";

/** The layer's two files and the transcripts it is filled from, keyed on the repository; absent
 *  outside a checkout, which has no transcripts to call its own. */
export const layerPaths = (room) => {
  const repository = projectRepository();
  return room && repository ? { precedents: join(room, "precedents.jsonl"), scanned: join(room, "scanned.json"),
    source: durableRootFor(repository), repository } : null;
};

export const precedentsIn = (paths) => (paths ? jsonlAt(paths.precedents) : []);

const strings = (list) => Array.isArray(list) && list.every((one) => typeof one === "string");

/* Every field the shortlist and the judge read, present in the type they read it as. */
const wholeRow = (row) => Boolean(row) && typeof row.id === "string" && (row.kind === OWNER_KIND
  ? typeof row.question === "string" && typeof row.answer === "string" && strings(row.options)
  : row.kind === DECISION_KIND && strings(row.readings) && row.readings.length > 0);

/* The layer read strictly, for the one reader that decides from it: a row that will not parse may be
   the answer that disagrees, and the offsets already read past it will not bring it back. */
const readLayer = (paths) => strictJsonlAt(paths.precedents, wholeRow, "a precedent");

/** How many precedents a layer holds, read without building anything. */
export const precedentCount = (paths) => precedentsIn(paths).length;

/** How an offered label says the session recommends it. */
export const RECOMMENDED = /\(recommended\)/iu;

const labelsOf = (question) =>
  (Array.isArray(question?.options) ? question.options.map((one) => String(one?.label ?? "")).filter(Boolean) : []);

/* A multi-select answer is its labels joined by commas; one that is none of the labels is the owner
   writing their own answer, which is precedent too — the strongest sign the options were wrong. */
const freeText = (answer, labels) => !String(answer).split(", ").every((one) => labels.includes(one));

/** A precedent row built from one answered question; nothing where the answer is empty. */
export const ownerRow = ({ id, at, question, answer, notes = null }) => {
  if (typeof answer !== "string" || !answer.trim() || !question?.question) return null;
  const labels = labelsOf(question);
  const recommended = labels.find((one) => RECOMMENDED.test(one)) ?? null;
  return {
    id, kind: OWNER_KIND, at: at ?? null, question: String(question.question), header: question.header ?? null,
    options: labels, recommended, answer, notes, free: freeText(answer, labels),
    matched: recommended === null ? null : answer === recommended,
  };
};

const resultId = (record) =>
  (Array.isArray(record?.message?.content) ? record.message.content.find((one) => one?.type === "tool_result")?.tool_use_id : null);

/* The result line carries the questions and the answers both, so no pairing across lines is needed. */
const ownerRows = (record, skip) => {
  const result = record?.toolUseResult;
  const id = resultId(record);
  if (!id || skip.has(id) || !Array.isArray(result?.questions) || !result.answers || typeof result.answers !== "object") return [];
  return result.questions
    .map((question, at) => ownerRow({ id: `${id}#${at}`, at: record.timestamp, question,
      answer: result.answers[question?.question], notes: result.annotations?.[question?.question]?.notes ?? null }))
    .filter(Boolean);
};

const DECISION_FOOTER = "`forge-record: decision";
const COMMENT_HEADER = /^--- ([A-Z][A-Z0-9]*-\d+), comment /mu;
const RECORD_BLOCK = /```forge-record\n([\s\S]*?)\n```/u;
const READING = /^decision: (.+)$/gmu;

const textOfResult = (block) => (typeof block.content === "string" ? block.content
  : Array.isArray(block.content) ? block.content.map((one) => one?.text ?? "").join("\n") : "");

/* A decision record exactly as the tracker holds it, read back through the CLI that owns its shape:
   a thread this project's sessions read carries each one under its issue's comment header. A command
   that only asked for one to be written proves nothing, so none is read from a command. */
const decisionRows = (record) => (Array.isArray(record?.message?.content) ? record.message.content : [])
  .filter((one) => one?.type === "tool_result")
  .flatMap((one) => textOfResult(one).split(/\n(?=--- [A-Z][A-Z0-9]*-\d+, comment )/u))
  .filter((chunk) => chunk.includes(DECISION_FOOTER))
  .map((chunk) => {
    const block = RECORD_BLOCK.exec(chunk)?.[1] ?? "";
    const readings = [...block.matchAll(READING)].map((hit) => hit[1].trim());
    const issue = COMMENT_HEADER.exec(chunk)?.[1] ?? null;
    return readings.length
      ? { id: `decision-${digestOf(`${issue}\0${block}`)}`, kind: DECISION_KIND,
          at: record.timestamp ?? null, issue, readings }
      : null;
  })
  .filter(Boolean);

/* Parsed only where it could hold something: an answer, or a decision record read back. Asked of the
   bytes, so the lines holding neither — nearly all of them — are never decoded. */
const MARKS = [Buffer.from("\"toolUseResult\""), Buffer.from(DECISION_FOOTER)];

/* The host names a project's transcript directory by a slug two repositories can share, so a row is
   this project's only where the session that wrote it stood in this repository. One that says where it
   stood elsewhere is another project's; one that does not say cannot be told apart, and is doubt. */
const standsIn = (record, repository) => {
  if (typeof record?.cwd !== "string" || !record.cwd) return null;
  return record.cwd === repository || record.cwd.startsWith(`${repository}/`);
};

/** The rows one line holds; null for a line that should hold some and cannot be read, which the
 *  build treats as evidence it has not seen rather than evidence that is not there. */
const rowsOfLine = (bytes, skip, repository) => {
  if (!MARKS.some((one) => bytes.includes(one))) return [];
  let record;
  try {
    record = JSON.parse(bytes.toString("utf8"));
  } catch {
    return null;
  }
  const rows = [...ownerRows(record, skip), ...decisionRows(record)];
  if (!rows.length) return rows;
  const here = standsIn(record, repository);
  if (here === null) return null;
  return here ? rows : [];
};

/* A directory that is not there holds no transcripts; one that is there and cannot be listed may hold
   the answer that disagrees, so it leaves the build incomplete. A link is followed only where it lands
   inside the project's own transcripts: one leading anywhere else is another project's, or nothing,
   and is doubt rather than evidence. */
const transcriptsUnder = (dir, root = null) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    return { files: [], complete: root === null && error.code === "ENOENT" };
  }
  const top = root ?? realpathSync(dir);
  const found = { files: [], complete: true };
  for (const one of entries) {
    const path = join(dir, one.name);
    let kind = one;
    if (one.isSymbolicLink()) {
      let target;
      try {
        target = realpathSync(path);
      } catch {
        found.complete = false;
        continue;
      }
      if (!target.startsWith(`${top}/`)) {
        found.complete = false;
        continue;
      }
      kind = statSync(target);
    }
    if (kind.isDirectory()) {
      const inner = transcriptsUnder(path, top);
      found.files.push(...inner.files);
      found.complete &&= inner.complete;
    } else if (one.name.endsWith(".jsonl")) found.files.push(path);
  }
  return found;
};

const CHUNK = 32 * 1024 * 1024;
const NEWLINE = 0x0a;

/* Whole lines only, so a transcript still being written is read to its last complete line and the
   rest waits for the next build. `visit` answers false to stop before a line, and `end` is then the
   offset that line starts at, so the next build reads it again; otherwise just past the last newline. */
const eachLineRun = (path, from, to, visit) => {
  const fd = openSync(path, "r");
  let at = from;
  let carry = Buffer.alloc(0);
  let end = from;
  try {
    while (at < to) {
      const size = Math.min(CHUNK, to - at);
      const read = Buffer.alloc(size);
      readSync(fd, read, 0, size, at);
      at += size;
      const data = carry.length ? Buffer.concat([carry, read]) : read;
      let start = 0;
      for (let stop = data.indexOf(NEWLINE); stop >= 0; stop = data.indexOf(NEWLINE, start)) {
        if (!visit(data.subarray(start, stop))) return { end, stopped: true };
        end += stop + 1 - start;
        start = stop + 1;
      }
      carry = data.subarray(start);
    }
  } finally {
    closeSync(fd);
  }
  /* Unfinished bytes carrying a marker count as a stop: they may be the answer that disagrees. */
  return { end, stopped: MARKS.some((one) => carry.includes(one)) };
};

const readScanned = (path) => {
  try {
    const held = JSON.parse(readFileSync(path, "utf8"));
    return held && typeof held.files === "object" ? held : { files: {} };
  } catch {
    return { files: {} };
  }
};

/** Brings a layer up to what its transcripts hold now, reading each file only past the offset the
 *  last build reached; a file that shrank was replaced, and is read again from its start, rows
 *  already held being kept once. `skip` is the tool-use ids the gate decided itself, and `until` a
 *  time past which the build stops before its next line, inside a file as between files, and keeps
 *  its place for the next one. `rows` is the layer as this build read it with what it added, which a
 *  caller judges from rather than reading the file again: a row another session appends while this
 *  build runs reaches the next call, as one appended a moment after this call would. */
export const refreshLayer = (paths, { skip = new Set(), until = Infinity } = {}) => {
  const layer = readLayer(paths);
  if (layer.unreadable) return { added: 0, complete: false, unreadable: layer.unreadable };
  const scanned = readScanned(paths.scanned);
  const held = new Set(layer.rows.map((one) => one.id));
  const found = [];
  const listed = transcriptsUnder(paths.source);
  let { complete } = listed;
  for (const file of listed.files.sort()) {
    if (Date.now() > until) {
      complete = false;
      break;
    }
    let size;
    try {
      size = statSync(file).size;
    } catch {
      complete = false;
      continue;
    }
    const was = scanned.files[file]?.offset ?? 0;
    const from = size < was ? 0 : was;
    if (from >= size) continue;
    const { end, stopped } = eachLineRun(file, from, size, (bytes) => {
      if (Date.now() > until) return false;
      const rows = rowsOfLine(bytes, skip, paths.repository);
      if (rows === null) return false;
      for (const row of rows.filter((one) => !held.has(one.id))) {
        held.add(row.id);
        found.push(row);
      }
      return true;
    });
    if (stopped) complete = false;
    scanned.files[file] = { offset: end };
  }
  appendJsonlRows(paths.precedents, found);
  mkdirSync(dirname(paths.scanned), { recursive: true });
  writeFileSync(paths.scanned, `${JSON.stringify(scanned)}\n`, { mode: 0o600 });
  return { added: found.length, complete, rows: [...layer.rows, ...found] };
};

/** The owner answers the post-call gate saw, each added unless the layer holds it already, in one
 *  write; how many were added. */
export const addPrecedents = (paths, rows) => {
  const given = rows.filter(Boolean);
  if (!given.length) return 0;
  const held = new Set(precedentsIn(paths).map((one) => one.id));
  const fresh = given.filter((one) => !held.has(one.id));
  appendJsonlRows(paths.precedents, fresh);
  return fresh.length;
};

const STOP = new Set(("the and for are but not you your yours this that these those with from into onto what which who whom "
  + "when where why how should would could will can may might must shall does did done has have had was were been being "
  + "its it's they them their there here then than also only just more most less some any all each every one two three "
  + "now next first last about over under after before because so if or of to in on at by as is be an a do we our i me my "
  + "recommended").split(" "));

const stem = (word) => word.replace(/(?:ing|ed|es|s)$/u, "") || word;

const tokensOf = (text) =>
  (String(text ?? "").toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}._-]*/gu) ?? [])
    .filter((one) => one.length > 2 && !STOP.has(one))
    .map(stem);

const textOfRow = (row) => (row.kind === DECISION_KIND
  ? row.readings.map((one) => String(one).split("|")[0]).join(" ")
  : [row.question, row.header, ...(row.options ?? [])].join(" "));

/** The words a question is matched on: its own, its header and its labels. */
const questionText = (question) =>
  [withoutDeclaration(question), question?.header, ...labelsOf(question)].join(" ");

const vectorOf = (tokens, idf) => {
  const counts = new Map();
  for (const one of tokens) counts.set(one, (counts.get(one) ?? 0) + 1);
  const vector = new Map([...counts].map(([one, n]) => [one, n * idf(one)]));
  const norm = Math.sqrt([...vector.values()].reduce((sum, one) => sum + one * one, 0));
  return { vector, norm };
};

const cosine = (left, right) => {
  if (!left.norm || !right.norm) return 0;
  let dot = 0;
  for (const [one, weight] of left.vector) dot += weight * (right.vector.get(one) ?? 0);
  return dot / (left.norm * right.norm);
};

/** How alike two texts must be, by TF-IDF cosine, for a precedent to be put in front of the judge. */
const SHORTLIST_FLOOR = 0.2;
const SHORTLIST_OWNER = 5;
const SHORTLIST_DECISIONS = 3;

/* A cap that fell between two equally close precedents would hide the one that disagrees, so every row
   as close as the last one kept is kept with it. */
const cutKeepingTies = (sorted, cap) => (sorted.length <= cap ? sorted
  : sorted.filter((one) => one.score >= sorted[cap - 1].score));

/** The shortlist of one call: the rows are tokenised once, and each question asked of it gets the
 *  precedents closest to it, owner answers and recorded decisions each capped apart, every one at or
 *  above the floor, the score travelling with each so the judge sees how close. The question counts
 *  as one more document, so a word only it holds weighs what it would in any one row. */
export const shortlister = (rows) => {
  const docs = rows.map((row) => ({ row, tokens: tokensOf(textOfRow(row)) }));
  const inDocs = new Map();
  for (const { tokens } of docs) {
    for (const one of new Set(tokens)) inDocs.set(one, (inDocs.get(one) ?? 0) + 1);
  }
  const total = docs.length + 1;
  return (question) => {
    const asked = tokensOf(questionText(question));
    const own = new Set(asked);
    const idf = (one) => Math.log((total + 1) / ((inDocs.get(one) ?? 0) + (own.has(one) ? 1 : 0) + 1)) + 1;
    const target = vectorOf(asked, idf);
    const scored = docs
      .map(({ row, tokens }) => ({ ...row, score: Number(cosine(target, vectorOf(tokens, idf)).toFixed(3)) }))
      .filter((one) => one.score >= SHORTLIST_FLOOR)
      .sort((left, right) => right.score - left.score);
    return [...cutKeepingTies(scored.filter((one) => one.kind === OWNER_KIND), SHORTLIST_OWNER),
      ...cutKeepingTies(scored.filter((one) => one.kind === DECISION_KIND), SHORTLIST_DECISIONS)];
  };
};
