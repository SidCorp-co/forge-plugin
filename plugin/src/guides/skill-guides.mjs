/* What a skill reads on a minority of its invocations is served from the running copy rather than
   loaded with the session: a long method as a body plus references, a short one as references
   alone beside an inline SKILL.md. The directory is the contract's for the reason contract.mjs
   gives; docs/cli/the-guides.md carries the decision. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { didYouMean } from "../suggest.mjs";
import { SLUG as CONTRACT_SLUG, partFor, partsOf, readContract } from "./contract.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WITHIN = join("guides", "skills");
export const BODY = "guide.md";
const REFERENCES = "references";

const skillGuidesRoot = (root = HERE) => join(root, WITHIN);

export const referencesOf = (slug, root = HERE) => {
  const dir = join(skillGuidesRoot(root), slug, REFERENCES);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3)).sort();
};

const hasBody = (slug, root) => existsSync(join(skillGuidesRoot(root), slug, BODY));

/** Read off the directory rather than listed. */
export const skillGuideSlugs = (root = HERE) => {
  const dir = skillGuidesRoot(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((one) => one.isDirectory() && (hasBody(one.name, root) || referencesOf(one.name, root).length))
    .map((one) => one.name)
    .sort();
};

const sizeOf = (path) => (existsSync(path) ? statSync(path).size : 0);

const INLINE = (slug) => `The ${slug} skill's method is its SKILL.md, loaded with the skill; this copy serves its references.`;

/** The line `forge guide` prints for a skill: what it is, and the command that reads it. */
export const skillListingRow = (slug, root = HERE) => {
  const count = `${referencesOf(slug, root).length} reference(s)`;
  if (!hasBody(slug, root)) {
    return `${slug}\n  the ${slug} skill's references, this copy's own: \`forge guide ${slug} <reference>\` prints one of its ${count}`;
  }
  return `${slug}\n  the ${slug} skill's method, this copy's own:`
    + ` \`forge guide ${slug}\` prints it, and \`forge guide ${slug} <reference>\` one of its ${count}`;
};

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
    const body = hasBody(slug, root) ? readFileSync(join(dir, BODY), "utf8").replace(/\s+$/u, "") : INLINE(slug);
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

const stubsOf = (root) => {
  const dir = join(root, "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((one) => join(dir, one, "SKILL.md")).filter((one) => existsSync(one));
};

/** Every `forge guide <slug> <part>` a skill text names that this copy cannot answer: a citation
 *  is a path with no directory to resolve against, so it is checked here instead. */
export const unresolvedCitations = (root = HERE) => {
  const out = [];
  const files = stubsOf(root);
  for (const slug of skillGuideSlugs(root)) {
    const dir = join(skillGuidesRoot(root), slug);
    if (hasBody(slug, root)) files.push(join(dir, BODY));
    files.push(...referencesOf(slug, root).map((one) => join(dir, REFERENCES, `${one}.md`)));
  }
  for (const file of files) {
    for (const [, skill, reference] of readFileSync(file, "utf8").matchAll(CITATION)) {
      if (!answers(skill, reference, root)) out.push({ file, skill, reference });
    }
  }
  return out;
};
