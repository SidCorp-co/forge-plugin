/* The contract the flow this project runs answers on, read out of the copy that is running: it sits
   inside `plugin/` because installing copies that and nothing beside it, and beside guides.mjs
   because `forge guide` serves both. Served by part, never whole — one file per part, ordered by the
   number its name carries, so nothing here lists them (ISS-78, ISS-802). Which flow answers for
   which part, and what a flow may not do to them: docs/cli/the-guides.md. */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bare, didYouMean } from "../suggest.mjs";
import { DEFAULT, FLOWS, flowPinned, flowRefusal, overridesOf, servedFor } from "./flow.mjs";

/** The contract this build reads and stamps on every record; another number is two versions in one. */
export const CONTRACT = 1;

export const SLUG = "contract";
const ROW = `${SLUG}\n  this plugin's own, not the tracker's: `
  + `\`forge guide ${SLUG}\` is the issue-flow contract's table of contents, one part per call`;

/** The listing's own line, or the refusal every other row carries: a flow refused on one surface and served on another is the inconsistency the axis exists without. */
export const listingRow = () => {
  const held = flowRefusal();
  return held ? `${SLUG}\n  ${held}` : ROW;
};
const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = "contract";

export const contractRoot = (root = HERE) => join(root, "guides", DIR);

export const contractPath = (root = HERE, flow = flowPinned().value) =>
  join(contractRoot(root), flow);

/** One heading per file, at the top: a file that lost its own is prose the join serves under the part before it, and a second is a part whose file name addresses neither. */
export const partFileProblem = (name, text) => {
  const lines = String(text).split("\n").filter((line) => line.trim());
  const heads = lines.filter((line) => HEADING.test(line));
  if (!lines.length || !HEADING.test(lines[0])) return `${name} opens with no heading, so nothing addresses it`;
  return heads.length > 1 ? `${name} carries ${heads.length} headings, and its name addresses one part` : null;
};

export const partFilesIn = (dir) => {
  try {
    const names = readdirSync(dir).filter((one) => one.endsWith(".md")).sort();
    return names.length ? names.map((name) => [name, readFileSync(join(dir, name), "utf8")]) : null;
  } catch {
    return null;
  }
};

const flowsIn = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((one) => one.isDirectory()).map((one) => one.name);
  } catch {
    return [];
  }
};

/** Every part of the contract for one flow, in `default`'s order: the flow's own file where the flow
 *  declares that name, `default`'s where it does not, and a `text` of null where the flow declares
 *  it and this copy has not got it. No sibling flow is read, which is the probe that stays forbidden. */
export const contractParts = ({ root = HERE, flow = flowPinned().value, flows = FLOWS } = {}) => {
  const base = partFilesIn(contractPath(root, DEFAULT));
  if (!base) return null;
  const declared = overridesOf(flow, flows);
  const own = new Map(partFilesIn(contractPath(root, flow)) ?? []);
  return base.map(([name, text]) => (declared.includes(name)
    ? { name, text: own.has(name) ? own.get(name) : null, base: text, from: flow }
    : { name, text, base: text, from: DEFAULT }));
};

const joined = (entries) => entries
  .filter(({ text }) => text !== null)
  .map(({ text }) => text.replace(/\s+$/u, ""))
  .join("\n\n");

/** The number a set of parts declares, with a lost part's identity still read though its body is served to nobody: off the served join instead, a copy that lost the part carrying the number would answer `no contract number` and refuse every intact part with it. */
export const identityOf = (entries) => statesContract(entries
  .map(({ text, base }) => (text ?? base).replace(/\s+$/u, ""))
  .join("\n\n"));

/** The parts joined into the one text every reader below expects. A malformed part withholds the whole join rather than serving its prose under the part before it: a reader that took the join would answer with the wrong part's text and nothing would say so, and this way every reader takes its own absent-contract route to `forge doctor`, which names the file. A part an incomplete installation lost is left out instead, because the parts the damage does not touch stay servable. */
export const readContract = (root = HERE, flow = flowPinned().value) => {
  const entries = contractParts({ root, flow });
  if (!entries) return null;
  if (entries.some(({ name, text }) => text !== null && partFileProblem(name, text))) return null;
  return joined(entries);
};

/* Its own line and shape, so the prose about contract versions is not read as the file's claim. */
const STATES = /^\*\*Contract (\d+)\.\*\*/mu;

export const statesContract = (text) => {
  const found = STATES.exec(String(text ?? ""));
  return found ? Number(found[1]) : null;
};

const HEADING = /^(#{1,6}) +(\S.*)$/u;
const SPAN = /`([^`]+)`/gu;
const DASH = /\s+—\s+/u;

const slugOf = (title) => title.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");

/* A heading names its part up to the em dash and says what it reads after. The statuses a part
   covers are the code spans in that first half, which is how `closed`, `dropped` is one part. */
const keysOf = (title) => {
  const [named] = title.split(DASH);
  const spans = [...named.matchAll(SPAN)].map((one) => one[1]);
  const rest = named.replace(SPAN, "").replace(/[,\s]+/gu, "");
  return spans.length && !rest ? spans : [slugOf(named)];
};

/** Every part, in order, holding the text to the next heading of any level: they partition the whole. */
export const partsOf = (text) => {
  const parts = [];
  for (const line of String(text ?? "").split("\n")) {
    const found = HEADING.exec(line);
    if (found) parts.push({ level: found[1].length, title: found[2], keys: keysOf(found[2]), body: [line] });
    else if (parts.length) parts.at(-1).body.push(line);
  }
  return parts.map(({ level, title, keys, body }) => {
    const held = body.join("\n").replace(/\s+$/u, "");
    const said = title.split(DASH).slice(1).join(" — ");
    return { level, title, keys, said, text: held, chars: held.length };
  });
};

/** A part this copy has not got is addressed by `default`'s heading, so a refusal answers the key a reader typed rather than a file name nobody does. */
export const addressed = (entries) => entries.flatMap(({ name, text, base, from }) =>
  partsOf(text ?? base).map((part) => ({ ...part, file: name, from, missing: text === null })));

/* A separator is how a name is misremembered, not which part was meant, so it costs no round. */
export const partFor = (parts, key) =>
  parts.find((part) => part.keys.includes(key))
  ?? parts.find((part) => part.keys.some((one) => bare(one) === bare(String(key ?? "")))) ?? null;

export const keysOfAll = (parts) => parts.flatMap((part) => part.keys);

/** What a citation of the contract resolves against: every key the verb would answer. */
export const contractKeys = (root = HERE) => keysOfAll(partsOf(readContract(root) ?? ""));

const ABSENT = "absent";

/** One line per part and per status, with its size and command, and none of the contract's prose. */
export const contentsOf = (parts, number) => {
  const rows = parts.flatMap((part) => part.keys.map((key) => [key, part]));
  const width = rows.reduce((wide, [key]) => Math.max(wide, key.length), 0);
  return [
    `The issue-flow contract — this plugin's own, contract ${number}, ${parts.length} part(s).`,
    "Each line is one part, its size in characters, and the command that prints it:",
    "",
    ...rows.map(([key, part]) =>
      `  ${key.padEnd(width)}  ${String(part.missing ? ABSENT : part.chars).padStart(6)}`
      + `  forge guide ${SLUG} ${key}`),
  ];
};

/** Never silent: a copy that lost the file, or the heading, is the copy that most needs to be told. */
export const stageLine = (status, parts, path = contractPath()) => {
  const part = partFor(parts, status);
  if (!part) return `No ${status} stage in the contract at ${path} — \`forge doctor\` says what this copy has.`;
  return `Contract, the ${status} stage — ${part.said}: \`forge guide ${SLUG} ${status}\``
    + ` (${part.chars} characters).`;
};

/** The malformed part before presence: a directory holding one is what `readContract` withholds the join for, and a reader told only that the contract is absent would go looking for a directory that is right there. The parts are resolved here rather than handed in, because a caller with no list to offer would otherwise switch the rule off and be told the contract is well formed (ISS-848). */
export const contractProblems = ({ root = HERE, flow = flowPinned().value, flows = FLOWS, reads = CONTRACT } = {}) => {
  const base = contractPath(root, DEFAULT);
  const entries = contractParts({ root, flow, flows });
  if (entries === null) {
    return [`no contract at ${base}, so this copy holds none of the rules that are not code`];
  }
  const malformed = entries
    .filter(({ text }) => text !== null)
    .map(({ name, text, from }) => {
      const said = partFileProblem(name, text);
      return said === null ? null : `${contractPath(root, from)}: ${said}`;
    })
    .filter(Boolean);
  if (malformed.length) return malformed;
  const states = identityOf(entries);
  if (states === null) {
    return [`${base} states no contract number, so nothing says which rules a reader has`];
  }
  if (states !== reads) {
    return [`${base} states contract ${states} and this build reads contract ${reads}`];
  }
  return [];
};

/** Which parts of one flow this copy declares an override for and has not got, so the refusal for
 *  each says which and the parts around them stay servable. */
export const missingIn = (entries) => (entries ?? []).filter(({ text }) => text === null);

/** What this copy ships held against what it declares, with no pin as an input: the answer to *what
 *  does this copy ship*, which a gate verdict must not take off a `.forge.json` it does not declare. */
export const flowProblems = (root = HERE, flows = FLOWS) => {
  const out = [];
  const base = new Map(partFilesIn(contractPath(root, DEFAULT)) ?? []);
  if (!base.size) {
    out.push(`${contractPath(root, DEFAULT)} holds no contract part, so no flow has a base to answer from`);
  }
  for (const flow of Object.keys(flows)) {
    if (flow === DEFAULT) continue;
    const own = new Map(partFilesIn(contractPath(root, flow)) ?? []);
    if (!own.size) {
      out.push(`${flow} is declared and ${contractPath(root, flow)} holds no part — install the plugin again for a whole copy, or take the flow out of FLOWS`);
    }
    for (const name of overridesOf(flow, flows)) {
      if (!base.has(name)) {
        out.push(`${flow} declares ${name} and ${DEFAULT} has no part of that name: a flow overrides a part and never inserts one`);
      } else if (!own.has(name)) {
        out.push(`${flow} declares ${name} and has not got it, so that part is refused rather than inherited — restore the file, or take the name out of FLOWS`);
      } else if (own.get(name) === base.get(name)) {
        out.push(`${flow}'s ${name} is byte-identical to ${DEFAULT}'s, so the override carries nothing — delete the file and let the part inherit`);
      }
    }
    for (const name of own.keys()) {
      if (!overridesOf(flow, flows).includes(name)) {
        out.push(`${flow} holds ${name} and declares no override for it, so nothing serves it — declare the name in FLOWS, or delete the file`);
      }
    }
  }
  for (const name of flowsIn(contractRoot(root))) {
    if (!Object.hasOwn(flows, name)) {
      out.push(`${contractRoot(root)} holds ${name} and FLOWS names no such flow — declare it, or delete the directory`);
    }
  }
  return out;
};

/** All of what the verb answers — lines, or one refusal — so a case can ask it without a process. */
export const contractAnswer = ({ part = null, tracker = false, extra = [], root = HERE } = {}) => {
  if (tracker) {
    return { refusal: `--tracker does not apply to ${SLUG}, which is this plugin's own, not the`
      + ` tracker's. \`forge guide ${SLUG}\` prints it.` };
  }
  if (extra.length) {
    return { refusal: `${SLUG} takes one part, not \`${[part, ...extra].join(" ")}\`.`
      + ` \`forge guide ${SLUG}\` lists them.` };
  }
  /* The flow before the file: an absent `erp-flow/` is a chosen slug, not a copy that lost its rules. */
  const pinned = flowRefusal();
  if (pinned) return { refusal: pinned };
  const wrong = contractProblems({ root });
  if (wrong.length) return { refusal: `${wrong[0]}. \`forge doctor\` reports which copy is running.` };
  const entries = contractParts({ root });
  const parts = addressed(entries);
  if (!part) return { lines: [...contentsOf(parts, identityOf(entries)), "", ...servedFor()] };
  const held = partFor(parts, part);
  if (!held) {
    return { refusal: didYouMean(`guide ${SLUG}`, part, keysOfAll(parts),
      `\`forge guide ${SLUG}\` lists every part.`) };
  }
  if (held.missing) {
    return { refusal: `${held.from} declares ${held.file} and this copy has not got it, so the`
      + ` ${part} part is refused rather than inherited — install the plugin again for a whole copy.`
      + " `forge doctor` reports which copy is running." };
  }
  return { lines: [held.text, "", ...servedFor(held.from)] };
};
