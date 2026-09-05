/* A skill's method, served from the running copy rather than loaded with the session: the stub under
   plugin/skills/ carries the description Claude Code offers the skill by; the body and its references
   live here, beside the contract, because installing copies plugin/ alone and `forge guide` serves
   both. docs/cli/the-guides.md carries the decision. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { didYouMean } from "../suggest.mjs";
import { SLUG as CONTRACT_SLUG, partFor, partsOf, readContract } from "./contract.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WITHIN = join("guides", "skills");
export const BODY = "guide.md";
const REFERENCES = "references";

export const skillGuidesRoot = (root = HERE) => join(root, WITHIN);

/** The skills whose method this copy serves, read off the directory rather than listed. */
export const skillGuideSlugs = (root = HERE) => {
  const dir = skillGuidesRoot(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((one) => one.isDirectory() && existsSync(join(dir, one.name, BODY)))
    .map((one) => one.name)
    .sort();
};

export const referencesOf = (slug, root = HERE) => {
  const dir = join(skillGuidesRoot(root), slug, REFERENCES);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3)).sort();
};

const sizeOf = (path) => (existsSync(path) ? statSync(path).size : 0);

/** The line `forge guide` prints for a skill: what it is, and the two commands that read it. */
export const skillListingRow = (slug, root = HERE) => `${slug}\n  the ${slug} skill's method, this copy's own:`
  + ` \`forge guide ${slug}\` prints it, and \`forge guide ${slug} <reference>\` one of its`
  + ` ${referencesOf(slug, root).length} reference(s)`;

const referenceLines = (slug, root) => {
  const dir = join(skillGuidesRoot(root), slug, REFERENCES);
  const names = referencesOf(slug, root);
  if (!names.length) return [];
  const width = names.reduce((wide, one) => Math.max(wide, one.length), 0);
  return ["", `References, each \`forge guide ${slug} <reference>\`:`, ...names.map((one) =>
    `  ${one.padEnd(width)}  ${String(sizeOf(join(dir, `${one}.md`))).padStart(6)}`)];
};

/** The answer shape `contractAnswer` gives, for one skill: the body, one reference, or a refusal. */
export const skillGuideAnswer = (slug, root = HERE) => ({ part = null, tracker = false, extra = [] } = {}) => {
  if (tracker) {
    return { refusal: `--tracker does not apply to ${slug}, which is this plugin's own, not the tracker's.`
      + ` \`forge guide ${slug}\` prints it.` };
  }
  if (extra.length) {
    return { refusal: `${slug} takes one reference, not \`${[part, ...extra].join(" ")}\`.`
      + ` \`forge guide ${slug}\` lists them.` };
  }
  const dir = join(skillGuidesRoot(root), slug);
  if (!part) {
    const body = readFileSync(join(dir, BODY), "utf8").replace(/\s+$/u, "");
    return { lines: [body, ...referenceLines(slug, root)] };
  }
  if (referencesOf(slug, root).includes(part)) {
    return { lines: [readFileSync(join(dir, REFERENCES, `${part}.md`), "utf8").replace(/\s+$/u, "")] };
  }
  return { refusal: didYouMean(`guide ${slug}`, part, referencesOf(slug, root),
    `\`forge guide ${slug}\` lists every reference.`) };
};

const CITATION = /`forge guide ([a-z][a-z0-9-]*) ([a-z][a-z0-9-]*)`/gu;

/* A citation of the contract resolves against its parts, the way the verb would answer it. */
const answers = (skill, reference, root) => {
  if (skill === CONTRACT_SLUG) return partFor(partsOf(readContract(root) ?? ""), reference) !== null;
  return referencesOf(skill, root).includes(reference);
};

/** Every `forge guide <slug> <part>` a served text names that this copy cannot answer: a citation
 *  is a path with no directory to resolve against, so it is checked here instead. */
export const unresolvedCitations = (root = HERE) => {
  const out = [];
  for (const slug of skillGuideSlugs(root)) {
    const dir = join(skillGuidesRoot(root), slug);
    const files = [join(dir, BODY), ...referencesOf(slug, root).map((one) => join(dir, REFERENCES, `${one}.md`))];
    for (const file of files) {
      for (const [, skill, reference] of readFileSync(file, "utf8").matchAll(CITATION)) {
        if (!answers(skill, reference, root)) out.push({ file, skill, reference });
      }
    }
  }
  return out;
};
