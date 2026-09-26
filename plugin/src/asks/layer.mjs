/* One project's precedent layer: every question its owner answered and every decision its sessions
   recorded, read out of that project's own transcripts into its own ask directory, and the shortlist
   a new question is judged against. Nothing here reads another project's transcripts or layer.
   plugin/hooks/how/ask-decide.md. */
import { closeSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { appendJsonl, jsonlAt } from "../hooks/log/hook-log-file.mjs";
import { durableBase, slugFor } from "../stats/corpus/corpus.mjs";
import { projectRepository } from "../resolve/settings.mjs";
import { DECLARED } from "./declared.mjs";

export const OWNER_KIND = "owner";
export const DECISION_KIND = "decision";

/** The two files of one layer, and the transcript directory it is filled from; null where this
 *  process stands in no checkout, which has no transcripts to call its own. */
export const layerPaths = (room, repository = projectRepository()) => (room && repository
  ? {
      precedents: join(room, "precedents.jsonl"),
      scanned: join(room, "scanned.json"),
      source: join(durableBase(), slugFor(repository.replace(/\/+$/u, "") || "/")),
    }
  : null);

export const precedentsIn = (paths) => (paths ? jsonlAt(paths.precedents) : []);

/** How many precedents a layer holds, read without building anything. */
export const precedentCount = (paths) => precedentsIn(paths).length;

const RECOMMENDED = /\(recommended\)/iu;

const labelsOf = (question) =>
  (Array.isArray(question?.options) ? question.options.map((one) => String(one?.label ?? "")).filter(Boolean) : []);

/* A multi-select answer is its labels joined by commas; one that is none of the labels is the owner
   writing their own answer, which is precedent too — the strongest sign the options were wrong. */
const freeText = (answer, labels) => !String(answer).split(", ").every((one) => labels.includes(one));

/** One question the owner answered, as a precedent row; null where it holds no answer. */
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

/* In command position only, so a sentence or an `echo` carrying the words records nothing. */
const DECISION_RUN = /(?:^|[;&|(]\s*)(?:\S*\/)?forge\s+record\s+decision\s/u;
const DECISION_FLAG = /--decision\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)')/gu;
const DECISION_ISSUE = /forge\s+record\s+decision\s+([A-Za-z]+-\d+)/u;
const REFUSED = /nothing was written|refused/iu;

/* A decision a session asked to record, held until its result says the write went through: the
   tracker lists comments one issue at a time, and these are the ones this project's own runs wrote. */
const decisionsAsked = (record, pending) => {
  for (const one of Array.isArray(record?.message?.content) ? record.message.content : []) {
    const command = one?.type === "tool_use" && one.name === "Bash" ? String(one.input?.command ?? "") : "";
    if (!DECISION_RUN.test(command)) continue;
    const readings = [...command.matchAll(DECISION_FLAG)].map((hit) => (hit[1] ?? hit[2]).replace(/\\(.)/gu, "$1"));
    if (readings.length) {
      pending[one.id] = { id: one.id, kind: DECISION_KIND, at: record.timestamp ?? null, issue: DECISION_ISSUE.exec(command)?.[1] ?? null, readings };
    }
  }
};

const textOfResult = (block) => (typeof block.content === "string" ? block.content
  : Array.isArray(block.content) ? block.content.map((one) => one?.text ?? "").join("\n") : "");

const decisionsRecorded = (record, pending) => (Array.isArray(record?.message?.content) ? record.message.content : [])
  .filter((one) => one?.type === "tool_result" && pending[one.tool_use_id])
  .flatMap((one) => {
    const row = pending[one.tool_use_id];
    delete pending[one.tool_use_id];
    return one.is_error === true || REFUSED.test(textOfResult(one)) ? [] : [row];
  });

/* Parsed only where it could hold something: an answer, a decision asked for, or the result of one. */
const worthParsing = (line, pending) => line.includes("\"toolUseResult\"") || line.includes("record decision")
  || Object.keys(pending).some((id) => line.includes(id));

const rowsOfLine = (line, skip, pending) => {
  if (!worthParsing(line, pending)) return [];
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return [];
  }
  decisionsAsked(record, pending);
  return [...ownerRows(record, skip), ...decisionsRecorded(record, pending)];
};

const transcriptsUnder = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((one) => {
    const path = join(dir, one.name);
    if (one.isDirectory()) return transcriptsUnder(path);
    return one.name.endsWith(".jsonl") ? [path] : [];
  });
};

const CHUNK = 32 * 1024 * 1024;
const NEWLINE = 0x0a;

/* Whole lines only, so a transcript still being written is read to its last complete line and the
   rest waits for the next build; `end` is the offset just past the last newline consumed. */
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
      const last = data.lastIndexOf(NEWLINE);
      if (last < 0) {
        carry = data;
        continue;
      }
      visit(data.subarray(0, last).toString("utf8"));
      end = at - (data.length - last - 1);
      carry = data.subarray(last + 1);
    }
  } finally {
    closeSync(fd);
  }
  return end;
};

const readScanned = (path) => {
  try {
    const held = JSON.parse(readFileSync(path, "utf8"));
    return held && typeof held.files === "object" ? { pending: {}, ...held } : { files: {}, pending: {} };
  } catch {
    return { files: {}, pending: {} };
  }
};

/** Brings a layer up to what its transcripts hold now, reading each file only past the offset the
 *  last build reached; a file that shrank was replaced, and is read again from its start, rows
 *  already held being kept once. `skip` is the tool-use ids the gate decided itself, and `until` a
 *  time past which the build stops and keeps its place for the next one. */
export const refreshLayer = (paths, { skip = new Set(), until = Infinity } = {}) => {
  if (!paths) return { added: 0, complete: true };
  const scanned = readScanned(paths.scanned);
  const held = new Set(precedentsIn(paths).map((one) => one.id));
  let added = 0;
  let complete = true;
  for (const file of transcriptsUnder(paths.source).sort()) {
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
    const end = eachLineRun(file, from, size, (text) => {
      for (const line of text.split("\n")) {
        for (const row of rowsOfLine(line, skip, scanned.pending)) {
          if (held.has(row.id)) continue;
          held.add(row.id);
          appendJsonl(paths.precedents, row);
          added += 1;
        }
      }
    });
    scanned.files[file] = { offset: end };
  }
  mkdirSync(dirname(paths.scanned), { recursive: true });
  writeFileSync(paths.scanned, `${JSON.stringify(scanned)}\n`, { mode: 0o600 });
  return { added, complete };
};

/** One owner answer the post-call gate saw, added unless the layer holds it already. */
export const addPrecedent = (paths, row) => {
  if (!paths || !row || precedentsIn(paths).some((one) => one.id === row.id)) return false;
  appendJsonl(paths.precedents, row);
  return true;
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

/** The question's own words, the declaration dropped: a reversal is how it is undone, not what it asks. */
const questionText = (question) =>
  [String(question?.question ?? "").replace(DECLARED, ""), question?.header, ...labelsOf(question)].join(" ");

const vectorOf = (tokens, idf) => {
  const counts = new Map();
  for (const one of tokens) counts.set(one, (counts.get(one) ?? 0) + 1);
  const vector = new Map([...counts].map(([one, n]) => [one, n * (idf.get(one) ?? 0)]));
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

/** The precedents closest to one question, owner answers and recorded decisions each capped apart,
 *  every one at or above the floor; the score travels with each so the judge sees how close. */
export const shortlistFor = (question, rows, { floor = SHORTLIST_FLOOR } = {}) => {
  const docs = rows.map((row) => ({ row, tokens: tokensOf(textOfRow(row)) }));
  const asked = tokensOf(questionText(question));
  const df = new Map();
  for (const tokens of [asked, ...docs.map((one) => one.tokens)]) {
    for (const one of new Set(tokens)) df.set(one, (df.get(one) ?? 0) + 1);
  }
  const total = docs.length + 1;
  const idf = new Map([...df].map(([one, n]) => [one, Math.log((total + 1) / (n + 1)) + 1]));
  const target = vectorOf(asked, idf);
  const scored = docs
    .map(({ row, tokens }) => ({ ...row, score: Number(cosine(target, vectorOf(tokens, idf)).toFixed(3)) }))
    .filter((one) => one.score >= floor)
    .sort((left, right) => right.score - left.score);
  return [...cutKeepingTies(scored.filter((one) => one.kind === OWNER_KIND), SHORTLIST_OWNER),
    ...cutKeepingTies(scored.filter((one) => one.kind === DECISION_KIND), SHORTLIST_DECISIONS)];
};
