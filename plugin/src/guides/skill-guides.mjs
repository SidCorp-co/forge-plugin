/* What a skill reads on a minority of its invocations is served from the running copy rather than
   loaded with the session: a long method as a body plus references, a short one as references alone
   beside an inline SKILL.md. The directory and the decision: docs/cli/the-guides.md. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { feedbackScope } from "../resolve/settings.mjs";
import { didYouMean } from "../suggest.mjs";
import { SLUG as CONTRACT_SLUG, partFor, partsOf, readContract } from "./contract.mjs";
import { phasesOf, render } from "./render.mjs";
import { SHIPPED, methodPinned, pinRefusal, versionDir } from "./version.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WITHIN = join("guides", "skills");
export const BODY = "guide.md";
const REFERENCES = "references";

const folders = (dir) => (existsSync(dir)
  ? readdirSync(dir, { withFileTypes: true }).filter((one) => one.isDirectory()).map((one) => one.name)
  : []);

const namesIn = (dir) => (existsSync(dir)
  ? readdirSync(dir).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3)).sort()
  : []);

/* Two roots, because one number pins the method and nothing else: the versioned root holds what a
   project's `method` chooses between, the plain one every skill no version judges. A slug in both is
   served versioned; `bodyPathsOf` reads the tree whole, for a check owed to it rather than to a pin. */
const servedFrom = (slug, root, version) => {
  const dir = join(root, "guides", versionDir(version), "skills");
  return existsSync(join(dir, slug)) ? { dir, version } : { dir: join(root, WITHIN), version: null };
};

const homeOf = (slug, root, version) => servedFrom(slug, root, version).dir;

/* Asked of the versions this copy stands behind, never of the pin: docs/cli/the-parts.md. */
const isVersioned = (slug, root) =>
  SHIPPED.some((one) => existsSync(join(root, "guides", versionDir(one), "skills", slug)));

const pinProblem = (slug, root) => (isVersioned(slug, root) ? pinRefusal() : null);

/* Every shipped version's root and the plain one, so the listing is one set whatever a project pins;
   exported because two scripts walk skill text and would each carry this shape. Newest version
   first, and by number: `readdirSync` promises no order and a lexical one puts v10 under v2. */
export const guideRoots = (root = HERE) => [
  ...folders(join(root, "guides")).filter((one) => /^v\d+$/u.test(one))
    .sort((one, next) => Number(next.slice(1)) - Number(one.slice(1)))
    .map((one) => join(root, "guides", one, "skills")),
  join(root, WITHIN),
];

export const referencesOf = (slug, root = HERE, version = methodPinned().value) =>
  namesIn(join(homeOf(slug, root, version), slug, REFERENCES));

export const guideBodyPath = (slug, root = HERE, version = methodPinned().value) =>
  join(homeOf(slug, root, version), slug, BODY);

export const bodyPathsOf = (slug, root = HERE) =>
  guideRoots(root).map((dir) => join(dir, slug, BODY)).filter((one) => existsSync(one));

const hasBody = (slug, root = HERE, version = methodPinned().value) =>
  existsSync(guideBodyPath(slug, root, version));

const speaks = (dir, slug) =>
  existsSync(join(dir, slug, BODY)) || namesIn(join(dir, slug, REFERENCES)).length > 0;

/** Read off the directories rather than listed. */
export const skillGuideSlugs = (root = HERE) =>
  [...new Set(guideRoots(root).flatMap((dir) => folders(dir).filter((slug) => speaks(dir, slug))))].sort();

const sizeOf = (path) => (existsSync(path) ? statSync(path).size : 0);

const INLINE = (slug) => `The ${slug} skill's method is its SKILL.md, loaded with the skill; this copy serves its references.`;

/** The line `forge guide` prints for a skill: what it is, and the command that reads it. */
export const skillListingRow = (slug, root = HERE) => {
  const held = pinProblem(slug, root);
  if (held) return `${slug}\n  ${held}`;
  const count = `${referencesOf(slug, root).length} reference(s)`;
  if (!hasBody(slug, root)) {
    return `${slug}\n  the ${slug} skill's references, this copy's own: \`forge guide ${slug} <reference>\` prints one of its ${count}`;
  }
  return `${slug}\n  the ${slug} skill's method, this copy's own:`
    + ` \`forge guide ${slug}\` prints it, and \`forge guide ${slug} <reference>\` one of its ${count}`;
};

const referenceLines = (slug, root) => {
  const dir = join(homeOf(slug, root, methodPinned().value), slug, REFERENCES);
  const names = referencesOf(slug, root);
  if (!names.length) return [];
  const width = names.reduce((wide, one) => Math.max(wide, one.length), 0);
  return ["", `References, each \`forge guide ${slug} <reference>\`:`, ...names.map((one) =>
    `  ${one.padEnd(width)}  ${String(sizeOf(join(dir, `${one}.md`))).padStart(6)}`)];
};

const read = (path) => readFileSync(path, "utf8").replace(/\s+$/u, "");

const versionLine = (version) =>
  `Method version ${version}, which this project runs; \`forge doctor\` names its source.`;

/* One entry per answer this CLI can give about the project it stands in. */
const conditions = () => ({ "feedback.plugin": feedbackScope().plugin.value });

const served = (slug, text, tail) => {
  const { text: out, problems } = render(text, conditions());
  if (problems.length) return { refusal: `${slug}'s served text is marked wrong — ${problems[0]}` };
  return { lines: [out, ...tail] };
};

/** The answer shape `contractAnswer` gives, for one skill: the body, one reference, one numbered
 *  phase of the method, or a refusal. A part served out of a version directory ends by naming it. */
export const skillGuideAnswer = (slug, root = HERE) => ({ part = null, tracker = false, extra = [] } = {}) => {
  if (tracker) {
    return { refusal: `--tracker does not apply to ${slug}, which is this plugin's own, not the tracker's.`
      + ` \`forge guide ${slug}\` prints it.` };
  }
  if (extra.length) {
    return { refusal: `${slug} takes one reference, not \`${[part, ...extra].join(" ")}\`.`
      + ` \`forge guide ${slug}\` lists them.` };
  }
  const held = pinProblem(slug, root);
  if (held) return { refusal: held };
  const { dir: home, version } = servedFrom(slug, root, methodPinned().value);
  const dir = join(home, slug);
  const tail = version === null ? [] : ["", versionLine(version)];
  const body = hasBody(slug, root) ? read(join(dir, BODY)) : null;
  if (!part) return served(slug, body ?? INLINE(slug), [...referenceLines(slug, root), ...tail]);
  const names = referencesOf(slug, root);
  if (names.includes(part)) return served(slug, read(join(dir, REFERENCES, `${part}.md`)), tail);
  const phases = body === null ? [] : phasesOf(body);
  const phase = phases.find((one) => one.number === String(part));
  if (phase) return served(slug, phase.text, tail);
  return { refusal: didYouMean(`guide ${slug}`, part, [...names, ...phases.map((one) => one.number)],
    phases.length
      ? `\`forge guide ${slug}\` lists every reference, and each phase of the method is its number.`
      : `\`forge guide ${slug}\` lists every reference.`) };
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
    const dir = join(homeOf(slug, root, methodPinned().value), slug);
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
