/* The tree's notation as a parser sees it, and nothing else: `docs/requirements/README.md` states
   the rules, `srs/01-introduction.md` the grammar. No file is read here, so a fixture proves it. */
import { createHash } from "node:crypto";

import {
  LINK_TEXT_PATTERN,
  TABLE_ROW_PATTERN,
  TABLE_SEPARATOR_PATTERN,
} from "../markdown.mjs";

export const KIND = {
  FR: "requirement",
  UC: "use case",
  AC: "criterion",
  NFR: "non-functional requirement",
  EI: "interface",
  BR: "business rule",
  G: "goal",
  M: "measure",
  C: "constraint",
  A: "assumption",
};

/* A rule about how the tree is written is not a clause of the product's specification, and the rows
   that hold those rules are the only identified rows the tree leaves unemphasised. */
export const FOREIGN = { R: "a rule of this tree, stated in the tree's own index" };

const PREFIXES = Object.keys(KIND);
const HEADED = ["FR", "UC", "NFR", "EI"];
const idPattern = (prefixes) => `\\b(${prefixes.join("|")})-(\\d+(?:-\\d+)*)\\b`;

const IDENT = new RegExp(`^${idPattern([...PREFIXES, ...Object.keys(FOREIGN)])}$`, "u");
const HEADING_ID = new RegExp(idPattern(HEADED), "u");
const BOLD_ID = new RegExp(`^\\*\\*${idPattern(PREFIXES)}\\*\\*\\s*(.*)$`, "u");
const CITED = new RegExp(`${idPattern(PREFIXES)}~(\\d+)(?![\\w-])`, "gu");

const HEADING = /^(#{1,6})\s+(.+)$/u;
const AC_ITEM = /^\s*[-*]\s+\*\*(AC-\d+(?:-\d+)*)\*\*\s*(?:·\s*)?(.*)$/u;
const ROW = new RegExp(TABLE_ROW_PATTERN, "u");
const RULE_ROW = new RegExp(TABLE_SEPARATOR_PATTERN, "u");
const NAV = /^\s*←/u;
const PROPOSAL = /^\s*\*\*Status: proposal\b/u;
const FIELD_LINE = /^Rev:/u;
const LINK = new RegExp(LINK_TEXT_PATTERN, "gu");
const BULLET = /^\s*(?:#{1,6}\s+|[-*+]\s+)/u;
const DIGITS = /^\d+$/u;

export const parseRef = (token) => {
  const [ref, rev, ...extra] = String(token ?? "").split("~");
  if (extra.length) return null;
  const found = IDENT.exec(ref.toUpperCase());
  if (!found) return null;
  if (rev !== undefined && !DIGITS.test(rev)) return null;
  return { id: `${found[1]}-${found[2]}`, prefix: found[1], cited: rev === undefined ? null : Number(rev) };
};

/** The clause content the tree's rules define: its markup gone and its whitespace collapsed, so a
 *  reflowed paragraph is the same clause and a reworded one is not. An underscore stays, because
 *  this tree writes emphasis with asterisks and an underscore is inside words it quotes. */
export const normalise = (text) =>
  String(text ?? "")
    .split("\n")
    .map((line) => line.replace(BULLET, ""))
    .join("\n")
    .replace(LINK, "$1")
    .replace(/[*`]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

export const digest = (text) => createHash("sha256").update(normalise(text)).digest("hex");

export const fieldsOf = (line) => {
  const out = {};
  for (const part of String(line).split("·")) {
    const at = part.indexOf(":");
    if (at < 0) return null;
    const key = part.slice(0, at).trim();
    if (!/^[A-Z][A-Za-z ]*$/u.test(key)) return null;
    out[key] = part.slice(at + 1).trim();
  }
  return Object.keys(out).length ? out : null;
};

export const citationsIn = (text) =>
  [...String(text ?? "").matchAll(CITED)].map((one) => ({ id: `${one[1]}-${one[2]}`, rev: Number(one[3]) }));

const idsIn = (value) =>
  String(value ?? "")
    .split(",")
    .map((one) => parseRef(one.trim())?.id)
    .filter(Boolean);

const titleFrom = (heading, id) => {
  const after = heading.slice(heading.indexOf(id) + id.length).replace(/^\s*[—–:-]\s*/u, "").trim();
  return after || heading.trim();
};

const clauseAt = (id, prefix, extra) => ({
  id,
  prefix,
  title: null,
  parent: null,
  fields: null,
  body: [],
  row: null,
  heading: null,
  ...extra,
});

/* A section heading inside a clause is part of it: only a clause, or a heading no deeper than the
   clause's own, ends one. */
const ends = (open, level) => !open || !open.level || level <= open.level;

const heading = (state, line) => {
  const found = HEADING.exec(line);
  if (!found) return false;
  const level = found[1].length;
  while (state.stack.length && state.stack.at(-1).level >= level) state.stack.pop();
  const inside = !ends(state.open, level);
  if (!inside) state.open = null;
  state.header = null;
  const id = HEADING_ID.exec(found[2]);
  if (!id) {
    if (inside) state.open.body.push(line);
    return true;
  }
  const clause = clauseAt(`${id[1]}-${id[2]}`, id[1], {
    title: titleFrom(found[2], `${id[1]}-${id[2]}`),
    parent: state.stack.at(-1)?.id ?? null,
    heading: found[2],
    level,
  });
  state.stack.push({ level, id: clause.id });
  state.out.push(clause);
  state.open = clause;
  return true;
};

const criterion = (state, line) => {
  const found = AC_ITEM.exec(line);
  if (!found) return false;
  const clause = clauseAt(found[1], "AC", {
    parent: state.stack.at(-1)?.id ?? null,
    fields: FIELD_LINE.test(found[2].trim()) ? fieldsOf(found[2].trim()) : null,
  });
  state.out.push(clause);
  state.open = clause;
  state.header = null;
  return true;
};

/* Emphasis is what tells a defining row from a reference to one: every closing table of a
   requirement names the rules it enforces in a plain cell, and naming is not defining. */
const rowClause = (cells, header, found) => {
  const fields = {};
  for (const [at, name] of (header ?? []).entries()) {
    if (at && name && cells[at] !== undefined) fields[name] = cells[at];
  }
  const rest = cells.slice(1).filter((cell) => cell && cell !== fields.Rev);
  const trailing = found[3].trim();
  return clauseAt(`${found[1]}-${found[2]}`, found[1], {
    title: trailing || rest[0] || null,
    fields: Object.keys(fields).length ? fields : null,
    row: [trailing, ...rest].filter(Boolean),
  });
};

/* A row that defines no clause is the clause's own content: a requirement may state a list as a
   table, and a table read as structure rather than text vanishes from the digest. */
const table = (state, line) => {
  const found = ROW.exec(line);
  if (!found) {
    state.previous = null;
    return false;
  }
  if (RULE_ROW.test(line)) {
    state.header = state.previous;
    return false;
  }
  const cells = found[1].split("|").map((one) => one.trim());
  state.previous = cells;
  const bold = BOLD_ID.exec(cells[0] ?? "");
  if (!bold) return false;
  state.out.push(rowClause(cells, state.header, bold));
  state.open = null;
  return true;
};

const collect = (state, line) => {
  if (PROPOSAL.test(line)) state.proposal = true;
  if (state.proposal) {
    if (!line.trim()) state.proposal = false;
    return;
  }
  if (!state.open || NAV.test(line)) return;
  if (state.open.prefix === "AC" && !line.trim()) {
    if (state.open.body.length) state.open = null;
    return;
  }
  state.open.body.push(line);
};

const settle = (clause) => {
  const body = clause.body.filter((line) => !NAV.test(line));
  let fields = clause.fields;
  let rest = body;
  if (!fields) {
    const at = body.findIndex((line) => line.trim());
    if (at >= 0 && FIELD_LINE.test(body[at].trim())) {
      fields = fieldsOf(body[at].trim());
      rest = [...body.slice(0, at), ...body.slice(at + 1)];
    }
  }
  const text = clause.row
    ? clause.row.join(" · ")
    : rest.join("\n").replace(/\n{3,}/gu, "\n\n").trim();
  const rev = DIGITS.test(fields?.Rev ?? "") ? Number(fields.Rev) : null;
  const content = clause.prefix === "AC" || clause.row ? text : `${clause.title}\n${text}`;
  return {
    id: clause.id,
    prefix: clause.prefix,
    kind: KIND[clause.prefix],
    rev,
    title: clause.title ?? clause.id,
    text: clause.prefix === "AC" ? text.replace(/\s+/gu, " ").trim() : text,
    fields: fields ?? {},
    parents: clause.parent ? [clause.parent] : [],
    children: [],
    enforces: idsIn(fields?.Enforces),
    enforcedBy: [],
    citations: citationsIn(text),
    hash: digest(content),
    heading: clause.heading ?? null,
  };
};

/** One document's clauses in the order they are written, each complete without its neighbourhood. */
export const clausesOf = (text) => {
  const state = { out: [], stack: [], open: null, header: null, previous: null, proposal: false };
  for (const line of String(text ?? "").split("\n")) {
    if (heading(state, line) || criterion(state, line) || table(state, line)) continue;
    collect(state, line);
  }
  return state.out.map(settle);
};
