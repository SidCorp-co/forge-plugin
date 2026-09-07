/* One part of the served method: how it is cut out of its text, and what one project's answers
   remove from it. Nothing here adds a word. The fence, why it is an HTML comment, why only its
   opener carries the condition, why parts are numbered, why a malformed fence refuses and why an
   unresolved condition is not a silence: docs/cli/the-parts.md. */
import { partsOf } from "./contract.mjs";

const OPEN = /^<!--\s+forge:when\s+([a-z][a-z0-9.]*)\s+([a-z][a-z0-9\s]*?)\s+-->$/u;
const CLOSE = /^<!--\s+forge:end\s+-->$/u;
const RESERVED = /^<!--\s*forge:/u;

const ROUTE = "The fence is `<!-- forge:when <condition> <value>… -->` to `<!-- forge:end -->`,"
  + " and docs/cli/the-parts.md carries it.";

const walk = (text, known) => {
  const kept = [];
  const blocks = [];
  const problems = [];
  let open = null;
  for (const [index, line] of String(text ?? "").split("\n").entries()) {
    const at = index + 1;
    const opened = OPEN.exec(line);
    if (opened) {
      if (open) problems.push(`line ${at} opens a marked block inside the one line ${open.at} opened`);
      open = { condition: opened[1], values: opened[2].split(/\s+/u), at, body: [] };
      continue;
    }
    if (!CLOSE.test(line)) {
      if (RESERVED.test(line)) {
        problems.push(`line ${at} reaches for a fence and is neither an opener nor a closer`);
        continue;
      }
      (open ? open.body : kept).push(line);
      continue;
    }
    if (!open) {
      problems.push(`line ${at} closes a marked block nothing opened`);
      continue;
    }
    blocks.push(open);
    const resolved = Object.hasOwn(known, open.condition);
    if (!resolved) problems.push(`line ${open.at} marks a block on \`${open.condition}\`, which nothing here resolves`);
    if (!resolved || open.values.includes(String(known[open.condition]))) kept.push(...open.body);
    open = null;
  }
  if (open) problems.push(`line ${open.at} opens a marked block nothing closes`);
  return { kept, blocks, problems };
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
