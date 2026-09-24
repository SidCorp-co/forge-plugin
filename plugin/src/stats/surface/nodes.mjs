/* The texts an agent can be served by this copy, each read by running the command that prints it:
   what a caller pays for is what was printed, project state included, and no module constant carries
   that. Which texts are walked and which are not: docs/cli/stats-the-surface.md. */
import { spawn } from "node:child_process";
import { join } from "node:path";

import { VERB_NAMES } from "../../resolve/visibility.mjs";
import { SLUG as CONTRACT, partsOf, readContract } from "../../guides/contract.mjs";
import { localSlugs } from "../../guides/guides.mjs";
import { referencesOf } from "../../guides/skill-guides.mjs";
import { PLUGIN_ROOT } from "../../tools/plugin-copy.mjs";

const FORGE = join(PLUGIN_ROOT, "bin", "forge");
const AT_ONCE = 8;
export const HELP = "help";
export const GUIDE = "guide";

/* Each verb answering help for subjects of its own declares them in its own module, and none of
   those lists is reachable from the verb table; they are loaded here, on the one call that walks
   them, so `forge stats runs` pays nothing for this subject. `cli-help.test.mjs` holds that every
   name its own table walks is one of these. */
const subjectsOf = async () => {
  const [knowledge, cloudflare, coolify, chatgpt, stats, codex, doctor, record] = await Promise.all([
    import("../../tools/knowledge.mjs"),
    import("../../tools/services/cloudflare.mjs"),
    import("../../tools/services/coolify/coolify.mjs"),
    import("../../tools/services/chatgpt.mjs"),
    import("../stats.mjs"),
    import("../../codex/codex.mjs"),
    import("../../tools/services/doctor/subjects.mjs"),
    import("../../flow/record/record-rows.mjs"),
  ]);
  return [
    ["knowledge", Object.keys(knowledge.SAYS)],
    ["cloudflare", Object.keys(cloudflare.SAYS)],
    ["coolify", Object.keys(coolify.SAYS)],
    ["chatgpt", Object.keys(chatgpt.SAYS)],
    ["stats", Object.keys(stats.SAYS)],
    ["codex", Object.keys(codex.SAYS)],
    ["doctor", doctor.SUBJECT_SLUGS],
    ["spec", ["check"]],
    ["record", record.KINDS],
  ];
};

const helpNode = (words) => ({ kind: HELP, name: `forge ${[...words, "-h"].join(" ")}`, argv: [...words, "-h"] });

/* One node per part and every key it answers to kept beside it: `closed` and `dropped` are one part,
   and a node per key would report one text as a line repeated in two. */
const contractNodes = () => [
  { kind: GUIDE, name: `forge guide ${CONTRACT}`, argv: ["guide", CONTRACT], keys: [CONTRACT] },
  ...partsOf(readContract() ?? "").map((part) => ({
    kind: GUIDE,
    name: `forge guide ${CONTRACT} ${part.keys[0]}`,
    argv: ["guide", CONTRACT, part.keys[0]],
    keys: part.keys.map((key) => `${CONTRACT} ${key}`),
  })),
];

const skillNodes = (slug) => [
  { kind: GUIDE, name: `forge guide ${slug}`, argv: ["guide", slug], keys: [slug] },
  ...referencesOf(slug).map((reference) => ({
    kind: GUIDE,
    name: `forge guide ${slug} ${reference}`,
    argv: ["guide", slug, reference],
    keys: [`${slug} ${reference}`],
  })),
];

/** Every text walked, unread: `forge -h`, each verb's and each subject's help, and each guide part this copy serves as its own. */
export const surfaceNodes = async () => [
  helpNode([]),
  ...VERB_NAMES.map((verb) => helpNode([verb])),
  ...(await subjectsOf()).flatMap(([verb, subjects]) => subjects.map((subject) => helpNode([verb, subject]))),
  ...contractNodes(),
  ...localSlugs().filter((slug) => slug !== CONTRACT).flatMap(skillNodes),
];

/* The text on stdout, and stderr beside it only where the command refused: a zero exit's stderr holds
   transient notices alone — a retried tracker call — and counting those would move the figure between
   two readings of one copy. A refusal is kept whole, since that is what was read. */
const ranText = (argv, cwd) => new Promise((done) => {
  const child = spawn(FORGE, argv, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const out = [];
  const err = [];
  child.stdout.on("data", (chunk) => out.push(chunk));
  child.stderr.on("data", (chunk) => err.push(chunk));
  child.on("error", (dropped) => done({ text: "", unread: dropped.message }));
  child.on("close", (code) => done({ text: `${Buffer.concat(out)}${code === 0 ? "" : Buffer.concat(err)}`, code }));
});

/** Each item through `each`, `AT_ONCE` at a time, answered in the order given. */
export const pooled = async (items, each) => {
  const answered = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      answered[index] = await each(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker));
  return answered;
};

/** Each node with its text, read from the directory the caller stands in. */
export const readNodes = (nodes, cwd = process.cwd(), read = ranText) =>
  pooled(nodes, async (node) => ({ ...node, ...(await read(node.argv, cwd)) }));
