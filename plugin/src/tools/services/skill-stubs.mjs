/* One copy of a stub ships to every machine and nothing of this plugin stands between it and the
   agent, so the file is what varies: written into the copy the harness installed, from the text this
   copy ships kept beside it. Why one tool to a line: docs/cli/an-unconfigured-tool.md. */
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";

import { SKILLS_WITHIN, shippedSkills } from "../../resolve/visibility.mjs";
import { CONFIGURABLE, unconfiguredTool } from "./tool-config.mjs";
import { installedPaths, insideCheckout } from "../plugin-copy.mjs";

export const STUB = "SKILL.md";
export const SHIPPED = ".SKILL.md.shipped";

const FENCE = "---";
const DESCRIPTION = /^description:/u;
const CONTINUES = /^\s/u;

const namedIn = (line, verb) => new RegExp(`\\b${verb}\\b`, "iu").test(line);

const frontmatterSpan = (lines) => {
  if (lines[0] !== FENCE) return null;
  const closes = lines.indexOf(FENCE, 1);
  return closes === -1 ? null : { from: 1, to: closes };
};

/* A block scalar ends where the indentation does, not at the next line that looks like a key: a
   quoted or underscored field would answer to no such heuristic and be taken for description text.
   The key line is never dropped — a stub whose description sits there is `shippedProblems`'s. */
const descriptionSpan = (lines) => {
  const front = frontmatterSpan(lines);
  if (!front) return null;
  const at = lines.slice(front.from, front.to).findIndex((line) => DESCRIPTION.test(line));
  if (at === -1) return null;
  let to = front.from + at + 1;
  while (to < front.to && (lines[to] === "" || CONTINUES.test(lines[to]))) to += 1;
  return { at: front.from + at, to };
};

const namesTool = (text, verb) => {
  const lines = text.split("\n");
  const said = descriptionSpan(lines);
  return Boolean(said) && lines.slice(said.at + 1, said.to).some((line) => namedIn(line, verb));
};

const absentNow = () => CONFIGURABLE.filter((verb) => unconfiguredTool(verb));

/** One stub's text for this machine: gone is every continuation line of its description naming a
 *  tool this machine saved nothing for, with the tools those lines named said. */
export const stubFor = (text, absent = absentNow()) => {
  const lines = text.split("\n");
  const said = descriptionSpan(lines);
  if (!said) return { text, dropped: [] };
  const dropped = new Set();
  const kept = lines.filter((line, at) => {
    if (at <= said.at || at >= said.to) return true;
    const verb = absent.find((one) => namedIn(line, one));
    if (verb) dropped.add(verb);
    return !verb;
  });
  return { text: kept.join("\n"), dropped: [...dropped] };
};

const dirOf = (root, slug) => join(root, SKILLS_WITHIN, slug);

const pristineOf = (dir) => {
  const held = join(dir, SHIPPED);
  return readFileSync(existsSync(held) ? held : join(dir, STUB), "utf8");
};

/** Per stub: what a write would drop, what is out of the text on disk — the fact and not its cause,
 *  a tool being configurable again before the start that restores its words — and what is left. */
export const stubStates = (root) =>
  shippedSkills(root).map((slug) => {
    const dir = dirOf(root, slug);
    const shipped = pristineOf(dir);
    const { text, dropped } = stubFor(shipped);
    const held = readFileSync(join(dir, STUB), "utf8");
    const out = CONFIGURABLE.filter((verb) => namesTool(shipped, verb) && !namesTool(held, verb));
    return { slug, dropped, out, matches: text === held, differs: shipped !== held };
  });

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

const within = (root, path) => root !== null && (path === root || path.startsWith(root + sep));

const entryAt = (path) => {
  try {
    return Boolean(lstatSync(path));
  } catch {
    return false;
  }
};

/* A file inside a permitted directory can still be a symlink out of it, and a write follows one —
   a dangling one too, which resolves to nothing and would have the write create the target. */
const lands = (dir, file) => {
  const held = real(file);
  return held === null ? !entryAt(file) : within(real(dir), held);
};

/* Two conditions, not one, and both of the real path: a plugin can be installed from a checkout, and
   an installed path can be a symlink into one, so membership alone proves nothing about the tree. */
const writable = (dir, record) => {
  const here = real(dir);
  return here !== null && !insideCheckout(here)
    && installedPaths(record).some((one) => within(real(one), here));
};

/** Every stub of one installed copy brought to what this machine should read, and what changed. */
export const writeStubs = (root, record) => {
  if (!root) return [];
  const out = [];
  for (const { slug, matches } of stubStates(root)) {
    const dir = dirOf(root, slug);
    if (matches || !writable(dir, record)) continue;
    if (!lands(dir, join(dir, STUB)) || !lands(dir, join(dir, SHIPPED))) continue;
    const shipped = pristineOf(dir);
    const { text, dropped } = stubFor(shipped);
    if (!existsSync(join(dir, SHIPPED))) writeFileSync(join(dir, SHIPPED), shipped);
    writeFileSync(join(dir, STUB), text);
    out.push({ slug, dropped });
  }
  return out;
};

const stubRow = ({ slug, out }) => (out.length
  ? { label: "skill stub",
    detail: `${slug} — ${out.join(", ")} out of its description in the copy a session loads, `
      + "which a session reads as of its start" }
  : { level: "note", label: "skill stub",
    detail: `${slug} — the stub in the copy a session loads is not the text this copy ships` });

/** What the report prints per stub, and nothing where a machine took no words out of one. */
export const stubRows = (installed) => {
  try {
    return stubStates(installed?.dir ?? "").filter((one) => one.differs).map(stubRow);
  } catch {
    return [];
  }
};

/** A shipped stub naming a tool where no write could reach it, and so advertising that tool on
 *  every machine however it is configured. */
export const shippedProblems = (root) =>
  shippedSkills(root)
    .map((slug) => {
      const lines = readFileSync(join(dirOf(root, slug), STUB), "utf8").split("\n");
      const said = descriptionSpan(lines);
      const verb = said && CONFIGURABLE.find((one) => namedIn(lines[said.at], one));
      return verb ? `${slug}'s description names ${verb} on its own key line, where no machine can `
        + "drop it — put each tool's words on continuation lines of their own" : null;
    })
    .filter(Boolean);
