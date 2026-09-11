/* A project that closed the channel is not merely denied the verb. Every sentence of the served
   method telling a run to file about the plugin has to go with it, or the run writes a note it may
   not send and reads the refusal as the guidance it should have had before writing. So a paragraph
   on that subject is fenced on the key or defers its destination to the CLI, and nothing else is. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const { render } = await import("../../src/guides/render.mjs");
const { FEEDBACK_CHANNELS } = await import("../../src/resolve/settings.mjs");

const SKILLS = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "guides", "skills");
const SHIP = { value: "self", allowed: ["self", "ready"] };
const SUBJECT = /plugin defect|defect (in|of) (this|the) (plugin|tooling)|plugin's own backlog|never optional|filed the moment/iu;
const DEFERS = /forge new -h/u;
/* The arm above reads what survives into `off` from the open channels; this one reads what only
   `off` is served, which that comparison never examines. An affirmative filing there is the same
   defect written in the branch meant to prevent it. */
const ASSERTS = /\bis filed\b|is already an issue|never optional/iu;

const corpus = () => {
  const out = [];
  for (const slug of readdirSync(SKILLS)) {
    for (const flow of readdirSync(join(SKILLS, slug))) {
      for (const sub of ["guide", "references"]) {
        const dir = join(SKILLS, slug, flow, sub);
        if (!existsSync(dir)) continue;
        for (const name of readdirSync(dir).filter((one) => one.endsWith(".md"))) {
          out.push({ rel: `${slug}/${sub}/${name}`, text: readFileSync(join(dir, name), "utf8") });
        }
      }
    }
  }
  return out;
};

/* The paragraph is the unit a reader judges a claim in, so a wrapped sentence is joined first. */
const paragraphs = (text) => text.split(/\n\s*\n/u)
  .map((one) => one.replace(/\n/gu, " ").trim()).filter(Boolean);

const at = (text, value) =>
  paragraphs(render(text, { "feedback.plugin": { value, allowed: FEEDBACK_CHANNELS }, ship: SHIP }).text);

const exposed = (files) => files.flatMap(({ rel, text }) => {
  const off = at(text, "off");
  const shared = at(text, "all").filter((one) => SUBJECT.test(one) && off.includes(one) && !DEFERS.test(one));
  const only = off.filter((one) =>
    SUBJECT.test(one) && ASSERTS.test(one) && !DEFERS.test(one) && !shared.includes(one));
  return [...shared, ...only].map((one) => `${rel}: ${one.slice(0, 80)}`);
});

test("no served paragraph tells a closed channel's run to file about the plugin", () => {
  const files = corpus();
  assert.ok(files.length > 20, `the walk reached ${files.length} files, which is not this corpus`);
  assert.deepEqual(exposed(files), [], "a paragraph on that subject is fenced on the key or defers to the CLI");
});

test("and the walk that says so catches one written unfenced, and clears the two ways of writing it right", () => {
  const claim = "A plugin defect the run met is filed on the plugin's own backlog.";
  const planted = (body) => [{ rel: "made-up.md", text: `# One\n\nA line every project reads.\n\n${body}\n` }];
  assert.deepEqual(exposed(planted(claim)), [`made-up.md: ${claim}`], "the selector matches nothing otherwise");
  assert.deepEqual(exposed(planted(`<!-- forge:when feedback.plugin bugs all -->\n${claim}\n<!-- forge:end -->`)), [],
    "fencing it on the key clears it");
  assert.deepEqual(exposed(planted(`${claim.slice(0, -1)}, where \`forge new -h\` says one goes.`)), [],
    "and so does leaving the destination to the CLI, which answers the key itself");
  const inside = `<!-- forge:when feedback.plugin off -->\n${claim}\n<!-- forge:end -->`;
  assert.deepEqual(exposed(planted(inside)), [`made-up.md: ${claim}`],
    "and the branch written for a closed channel is read too, which the comparison alone never sees");
});
