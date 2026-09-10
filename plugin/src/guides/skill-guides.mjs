/* What a skill reads on a minority of its invocations is served from the running copy rather than
   loaded with the session: a long method as a body plus references, a short one as references alone
   beside an inline SKILL.md. The directory and the decision: docs/cli/the-guides.md, and why the
   flow is a segment of the path rather than a fence inside a file: docs/cli/the-flow-axis.md. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { FEEDBACK_CHANNELS, SHIP_MODES, feedbackScope, shipMode } from "../resolve/settings.mjs";
import { didYouMean } from "../suggest.mjs";
import {
  SLUG as CONTRACT_SLUG, contractKeys, contractRoot, joinedParts, partEntriesIn, partFileProblem,
} from "./contract.mjs";
import { DEFAULT, flowPinned, flowRefusal, servedFor } from "./flow.mjs";
import { openersOf, phasesOf, render } from "./render.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WITHIN = join("guides", "skills");
export const GUIDE = "guide";
const REFERENCES = "references";

const folders = (dir) => (existsSync(dir)
  ? readdirSync(dir, { withFileTypes: true }).filter((one) => one.isDirectory()).map((one) => one.name)
  : []);

const namesIn = (dir) => (existsSync(dir)
  ? readdirSync(dir).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3)).sort()
  : []);

export const skillGuidesRoot = (root = HERE) => join(root, WITHIN);

/** Where one flow's whole text for one skill sits: the flow is a segment, so `ls` is what that flow serves and nothing resolves through another. */
export const skillFlowDir = (slug, root = HERE, flow = flowPinned().value) =>
  join(skillGuidesRoot(root), slug, flow);

export const referencesOf = (slug, root = HERE, flow = flowPinned().value) =>
  namesIn(join(skillFlowDir(slug, root, flow), REFERENCES));

export const guideParts = (slug, root = HERE, flow = flowPinned().value) =>
  partEntriesIn(join(skillFlowDir(slug, root, flow), GUIDE));

/** The method as one text, joined from the flow's own parts in their own order, or null where this flow serves none for that skill. */
export const servedBody = (slug, root = HERE, flow = flowPinned().value) => {
  const parts = guideParts(slug, root, flow);
  return parts === null ? null : joinedParts(parts);
};

export const hasBody = (slug, root = HERE, flow = flowPinned().value) =>
  guideParts(slug, root, flow) !== null;

/** A method part answers to the contract's own one-heading rule, so a phase this copy lost its heading for is named rather than served under the phase above it. */
export const bodyProblems = (slug, root = HERE, flow = flowPinned().value) =>
  (guideParts(slug, root, flow) ?? [])
    .map(({ name, text }) => {
      const said = partFileProblem(name, text);
      return said === null ? null : `${join(skillFlowDir(slug, root, flow), GUIDE)}: ${said}`;
    })
    .filter(Boolean);

/** Read off the directories, for the flow served. Where the keys name a flow this copy cannot serve every slug is offered anyway, because a slug this listing drops is one `forge guide` looks for among the tracker's guides instead and answers *no guide named that*. */
export const skillGuideSlugs = (root = HERE, flow = flowPinned().value) => {
  const refused = flowRefusal() !== null;
  return folders(skillGuidesRoot(root))
    .filter((slug) => refused
      || hasBody(slug, root, flow) || referencesOf(slug, root, flow).length > 0)
    .sort();
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

/* One entry per answer this CLI can give here, each declaring the domain off that key's own list. A
   machine's mode and a project's channel are facts orthogonal to which flow it runs and belong
   inside a part; the flow itself is the directory, so it is no condition anything resolves. */
const conditions = () => ({
  "feedback.plugin": { value: feedbackScope().plugin.value, allowed: FEEDBACK_CHANNELS },
  ship: { value: shipMode().value, allowed: SHIP_MODES },
});

const served = (slug, text, tail) => {
  const { text: out, problems } = render(text, conditions());
  if (problems.length) return { refusal: `${slug}'s served text is marked wrong — ${problems[0]}` };
  return { lines: [out, ...tail] };
};

/** The answer shape `contractAnswer` gives, for one skill: the body, one reference, one numbered
 *  phase of the method, or a refusal. Every answer ends by naming the flow it was rendered for. */
export const skillGuideAnswer = (slug, root = HERE, flow = flowPinned().value) => ({ part = null, tracker = false, extra = [] } = {}) => {
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
  const dir = skillFlowDir(slug, root, flow);
  const tail = ["", ...servedFor(flow)];
  const wrong = bodyProblems(slug, root, flow);
  if (wrong.length) return { refusal: `${wrong[0]}. \`forge doctor\` reports which copy is running.` };
  const body = servedBody(slug, root, flow);
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

/* A citation of the contract resolves against its parts, the way the verb would answer it, and under the flow whose text carries the citation: a reader following it is being served that flow. */
const answers = (skill, reference, root, flow) => {
  if (skill === CONTRACT_SLUG) return contractKeys(root, flow).includes(reference);
  return referencesOf(skill, root, flow).includes(reference);
};

const stubsOf = (root) => {
  const dir = join(root, "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((one) => join(dir, one, "SKILL.md")).filter((one) => existsSync(one));
};

/** Every `forge guide <slug> <part>` a skill text names that this copy cannot answer: a citation is a path with no directory to resolve against, so it is checked here instead. Every flow the copy ships is read and the pin is not, so the finding is about the copy and does not move with the `.forge.json` beside it. A stub names no flow, so it is held to the flow a project falls back to; holding one to every shipped flow is a reading left to whoever ships the second flow. */
export const unresolvedCitations = (root = HERE) => {
  const out = [];
  const files = stubsOf(root).map((file) => ({ file, flow: DEFAULT }));
  for (const slug of folders(skillGuidesRoot(root))) {
    for (const flow of folders(join(skillGuidesRoot(root), slug))) {
      const dir = skillFlowDir(slug, root, flow);
      const at = (where, name) => ({ file: join(dir, where, name), flow });
      files.push(...(guideParts(slug, root, flow) ?? []).map(({ name }) => at(GUIDE, name)));
      files.push(...referencesOf(slug, root, flow).map((one) => at(REFERENCES, `${one}.md`)));
    }
  }
  for (const { file, flow } of files) {
    for (const [, skill, reference] of readFileSync(file, "utf8").matchAll(CITATION)) {
      if (!answers(skill, reference, root, flow)) out.push({ file, skill, reference, flow });
    }
  }
  return out;
};

const FENCED_ON = "flow";

const mdUnder = (dir, out = []) => {
  for (const one of folders(dir)) mdUnder(join(dir, one), out);
  out.push(...namesIn(dir).map((one) => join(dir, `${one}.md`)));
  return out;
};

/** Every served text fencing a block on the flow, in either tree and under every flow this copy
 *  ships. Two routes for one axis is a precedence rule with nothing to decide it, so the fence goes
 *  and the flow's own directory is where a difference between flows is written. */
export const flowFences = (root = HERE) =>
  [...mdUnder(contractRoot(root)), ...mdUnder(skillGuidesRoot(root))]
    .filter((file) => openersOf(readFileSync(file, "utf8")).includes(FENCED_ON))
    .map((file) => `${file} fences a block on \`forge:when ${FENCED_ON}\`, and a flow's directory is`
      + " the whole of what that flow serves — write the block as a part file under that flow's own"
      + " directory instead");
