/* One part of the served method: how it is cut out of its text, and what one project's answers
   remove from it. Nothing here adds a word. The fence, why it is an HTML comment, why only its
   opener carries the condition, why parts are numbered, why a malformed fence refuses and why an
   unresolved condition is not a silence: docs/cli/the-parts.md. */
import { partsOf } from "./contract.mjs";

const OPEN = /^ {0,3}<!--\s+forge:when\s+([a-z][a-z0-9.]*)\s+([a-z][a-z0-9\s-]*?)\s+-->$/u;
const CLOSE = /^ {0,3}<!--\s+forge:end\s+-->$/u;
const RESERVED = /^ {0,3}<!--\s*forge:/u;
const GUARD = /^ {0,3}(?:```|~~~)/u;
const QUOTED = /^ {4,}\S/u;

const ROUTE = "The fence is `<!-- forge:when <condition> <value>… -->` to `<!-- forge:end -->`,"
  + " and docs/cli/the-parts.md carries it.";

/* Whether this block's own values are the key's, so a value the key never takes cannot read as a
   project that simply does not match it. Every answer declares its domain or resolves nothing. */
const strayIn = (block, held) => {
  const on = `marks a block on \`${block.condition}\``;
  if (!Array.isArray(held?.allowed)) return `${on}, whose values nothing here declares`;
  const stray = block.values.filter((one) => !held.allowed.includes(one));
  return stray.length
    ? `${on} for ${stray.join(", ")}, which that key does not take — it takes ${held.allowed.join(", ")}`
    : null;
};

const walk = (text, known) => {
  const kept = [];
  const blocks = [];
  const named = [];
  const problems = [];
  let open = null;
  let guarded = false;
  for (const [index, line] of String(text ?? "").split("\n").entries()) {
    const at = index + 1;
    const into = () => (open ? open.body : kept);
    if (GUARD.test(line)) guarded = !guarded;
    if (guarded || GUARD.test(line) || QUOTED.test(line)) {
      into().push(line);
      continue;
    }
    const opened = OPEN.exec(line);
    if (opened) {
      if (open) problems.push(`line ${at} opens a marked block inside the one line ${open.at} opened`);
      named.push(opened[1]);
      open = { condition: opened[1], values: opened[2].split(/\s+/u), at, body: [] };
      continue;
    }
    if (!CLOSE.test(line)) {
      if (RESERVED.test(line)) {
        problems.push(`line ${at} reaches for a fence and is neither an opener nor a closer`);
        continue;
      }
      into().push(line);
      continue;
    }
    if (!open) {
      problems.push(`line ${at} closes a marked block nothing opened`);
      continue;
    }
    blocks.push(open);
    const held = Object.hasOwn(known, open.condition) ? known[open.condition] : null;
    const wrong = held === null
      ? `marks a block on \`${open.condition}\`, a condition nothing here resolves`
      : strayIn(open, held);
    if (wrong) problems.push(`line ${open.at} ${wrong}`);
    if (wrong || open.values.includes(String(held.value))) kept.push(...open.body);
    open = null;
  }
  if (open) problems.push(`line ${open.at} opens a marked block nothing closes`);
  return { kept, blocks, named, problems };
};

/** One part's text for one project, closing the blank run a removal left behind and nothing else. */
export const render = (text, conditions = {}) => {
  const { kept, blocks, problems } = walk(text, conditions);
  return {
    text: kept.join("\n").replace(/\n{3,}/gu, "\n\n").replace(/\s+$/u, ""),
    blocks,
    problems: problems.map((one) => `${one}. ${ROUTE}`),
  };
};

/** Every marked block one text holds, with no project in the question: what a check counts. */
export const blocksOf = (text) => walk(text, {}).blocks;

/** Every condition this text opens a marked block on, closed or not: a block joins `blocks` at its closer, so a checker refusing a condition needs this to reach the malformed text too (ISS-1098). */
export const openersOf = (text) => walk(text, {}).named;

const PHASE = /^phase-(\d+)$/u;

/** The phases of one method text, each with the number that addresses it and every heading
 *  subordinate to it: `partsOf` ends a part at the next heading of any level, so a phase with a
 *  subsection would answer its number with the half above that subsection and say nothing. */
export const phasesOf = (text) => {
  const parts = partsOf(text);
  const out = [];
  for (const [at, part] of parts.entries()) {
    const number = part.keys.map((key) => PHASE.exec(key)?.[1]).find(Boolean);
    if (number === undefined) continue;
    const under = [];
    for (const next of parts.slice(at + 1)) {
      if (next.level <= part.level) break;
      under.push(next);
    }
    const held = [part, ...under].map((one) => one.text).join("\n\n");
    out.push({ ...part, number, text: held, chars: held.length });
  }
  return out;
};
