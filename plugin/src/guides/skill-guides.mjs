/* What a skill reads on a minority of its invocations is served from the running copy rather than
   loaded with the session: a long method as a body plus references, a short one as references alone
   beside an inline SKILL.md. The directory and the decision: docs/cli/the-guides.md. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { FEEDBACK_CHANNELS, SHIP_MODES, feedbackScope, shipMode } from "../resolve/settings.mjs";
import { didYouMean } from "../suggest.mjs";
import { SLUG as CONTRACT_SLUG, contractKeys } from "./contract.mjs";
import { FLOW_SLUGS, flowPinned, flowRefusal, servedFor } from "./flow.mjs";
import { phasesOf, render } from "./render.mjs";

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

/** One root, no flow axis in the path: what a flow changes it changes inside the file, in a fence. */
export const skillGuidesRoot = (root = HERE) => join(root, WITHIN);

export const referencesOf = (slug, root = HERE) =>
  namesIn(join(skillGuidesRoot(root), slug, REFERENCES));

export const guideBodyPath = (slug, root = HERE) => join(skillGuidesRoot(root), slug, BODY);

export const hasBody = (slug, root = HERE) => existsSync(guideBodyPath(slug, root));

const speaks = (dir, slug) =>
  existsSync(join(dir, slug, BODY)) || namesIn(join(dir, slug, REFERENCES)).length > 0;

/** Read off the directories rather than listed. */
export const skillGuideSlugs = (root = HERE) => {
  const dir = skillGuidesRoot(root);
  return folders(dir).filter((slug) => speaks(dir, slug)).sort();
};

const sizeOf = (path) => (existsSync(path) ? statSync(path).size : 0);

const INLINE = (slug) => `The ${slug} skill's method is its SKILL.md, loaded with the skill; this copy serves its references.`;

/** The line `forge guide` prints for a skill: what it is, and the command that reads it. */
export const skillListingRow = (slug, root = HERE) => {
  const held = flowRefusal();
  if (held) return `${slug}\n  ${held}`;
  const count = `${referencesOf(slug, root).length} reference(s)`;
  if (!hasBody(slug, root)) {
    return `${slug}\n  the ${slug} skill's references, this copy's own: \`forge guide ${slug} <reference>\` prints one of its ${count}`;
  }
  return `${slug}\n  the ${slug} skill's method, this copy's own:`
    + ` \`forge guide ${slug}\` prints it, and \`forge guide ${slug} <reference>\` one of its ${count}`;
};

const referenceLines = (slug, dir) => {
  const names = namesIn(join(dir, REFERENCES));
  if (!names.length) return [];
  const width = names.reduce((wide, one) => Math.max(wide, one.length), 0);
  return ["", `References, each \`forge guide ${slug} <reference>\`:`, ...names.map((one) =>
    `  ${one.padEnd(width)}  ${String(sizeOf(join(dir, REFERENCES, `${one}.md`))).padStart(6)}`)];
};

const read = (path) => readFileSync(path, "utf8").replace(/\s+$/u, "");

/* One entry per answer this CLI can give here, each declaring the domain off that key's own list. */
const conditions = () => ({
  "feedback.plugin": { value: feedbackScope().plugin.value, allowed: FEEDBACK_CHANNELS },
  flow: { value: flowPinned().value, allowed: FLOW_SLUGS },
  ship: { value: shipMode().value, allowed: SHIP_MODES },
});

const served = (slug, text, tail) => {
  const { text: out, problems } = render(text, conditions());
  if (problems.length) return { refusal: `${slug}'s served text is marked wrong — ${problems[0]}` };
  return { lines: [out, ...tail] };
};

/** The answer shape `contractAnswer` gives, for one skill: the body, one reference, one numbered
 *  phase of the method, or a refusal. Every answer ends by naming the flow it was rendered for. */
export const skillGuideAnswer = (slug, root = HERE) => ({ part = null, tracker = false, extra = [] } = {}) => {
  if (tracker) {
    return { refusal: `--tracker does not apply to ${slug}, which is this plugin's own, not the tracker's.`
      + ` \`forge guide ${slug}\` prints it.` };
  }
  if (extra.length) {
    return { refusal: `${slug} takes one reference, not \`${[part, ...extra].join(" ")}\`.`
      + ` \`forge guide ${slug}\` lists them.` };
  }
  const held = flowRefusal();
  if (held) return { refusal: held };
  const dir = join(skillGuidesRoot(root), slug);
  const tail = ["", ...servedFor()];
  const body = existsSync(join(dir, BODY)) ? read(join(dir, BODY)) : null;
  if (!part) return served(slug, body ?? INLINE(slug), [...referenceLines(slug, dir), ...tail]);
  const names = namesIn(join(dir, REFERENCES));
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
  if (skill === CONTRACT_SLUG) return contractKeys(root).includes(reference);
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
