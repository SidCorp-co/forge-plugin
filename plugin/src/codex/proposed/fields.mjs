/* A missing priority or complexity, proposed by the model the project names for it and written onto the
   issue with a correction saying which model proposed it: at filing, and on `forge issue ISS-nn
   --propose` for an issue filed without one. A field a person gave is never asked for and never
   replaced, and a proposal that fails leaves the field unset and says so, with the command that asks
   again — what to do next is the caller's, not a fallback's. docs/cli/proposed-fields.md. */
import { refuse } from "../../refusal.mjs";
import { fail, projectCodex, projectPriorities, refusing } from "../../resolve/settings.mjs";
import { gateway } from "../../resolve/machine/stores.mjs";
import { askedInSource } from "../../resolve/flags.mjs";
import { writeFields } from "../../tracker/field-write.mjs";
import { UNRANKED } from "../../tracker/declared/value-sets.mjs";
import { correctionFor } from "../../flow/override.mjs";
import { issueOf } from "../../flow/record/thread/posting.mjs";
import { render } from "../../flow/record/page.mjs";
import { askComplexity, namedModel } from "../complexity/complexity.mjs";
import { defaultEffort } from "../codex-plan.mjs";
import { askPriority } from "./priority.mjs";
import { SCALE_KEY, levelsOf } from "./scale.mjs";

const FIELDS = ["priority", "complexity"];

/** The command that proposes again, which every line naming a failure prints. */
const proposeAgain = (ref) => `forge issue ${ref} --propose`;

/** The fields a row lacks: a priority nobody judged, and no complexity at all. */
export const absentIn = (row) => FIELDS.filter((field) => (field === "priority"
  ? !row?.priority || row.priority === UNRANKED
  : !row?.complexity));

const named = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** What the project's record turns on for each field: a model, and for the priority the scale it judges on,
 *  or the sentence saying why it is off and the setting that turns it on. Nothing else switches it. */
export const switchesOf = (codex = projectCodex(), scale = projectPriorities()) => {
  const complexity = named(codex.complexityModel);
  const priority = named(codex.priorityModel);
  const levels = levelsOf(scale);
  const off = (said, route) => ({ off: said, route });
  return {
    complexity: complexity ? { model: complexity }
      : off("this project's record names no `codex.complexityModel`", "forge doctor --set codex.complexityModel=<model>"),
    priority: !priority ? off("this project's record names no `codex.priorityModel`", "forge doctor --set codex.priorityModel=<model>")
      : levels.length ? { model: priority, levels }
        : off(`this project's record names \`codex.priorityModel\` and states no \`${SCALE_KEY}\` scale for it to judge on`,
          `forge doctor --set ${SCALE_KEY}.high=<what earns it>`),
  };
};

const ASKERS = {
  complexity: (values, model, row, _on, options) => askComplexity(values, model, row, options),
  priority: (values, model, row, on, options) => askPriority(values, model, row, on.levels, options),
};

const confidenceSaid = (one) => (one.confidence === null || one.confidence === undefined
  ? "no confidence given" : `confidence ${one.confidence.toFixed(2)}`);

/** What the correction records of each written field: the model, its confidence and its sentence, so a
 *  later reader tells a proposed field from a judged one and sees what the proposal rested on. */
export const provenanceOf = (written, ref, occasion) => [
  `Proposed ${occasion} and not judged by a reader: `,
  written.map((one) => `${one.field} ${one.value} by ${one.model} (${confidenceSaid(one)}) — ${one.why}`).join("; "),
  `. A reader's \`forge issue ${ref} --set <field>=<value> --why <w>\` replaces it.`,
].join("");

const movedOf = (written) =>
  `${written.map((one) => `${one.field} set to \`${one.value}\``).join(", ")} by a proposal`;

/* The correction for the fields that landed; one refused after they landed is answered apart, since
   the fields stand: what comes back is the refusal's own route out with the body it would have posted. */
const recordOf = async (documentId, ref, landed, occasion) => {
  const said = { moved: movedOf(landed), why: provenanceOf(landed, ref, occasion), corrects: `issue:${landed.map((one) => one.field).join(",")}` };
  try {
    await correctionFor(documentId, ref, said.moved, said.why, { corrects: said.corrects });
    return null;
  } catch (error) {
    return `${error?.message ?? error}\n\n${render("correction", said)}`;
  }
};

/* The field writer takes the issue's lease for the write and hands it back when the call ends, so a field
   written onto an issue this call just filed needs no claim; the correction is the one AC-02-3-3 owes.
   One update carries every field, and a read-back can find one landed and its neighbour not: the writer
   hands the landed ones to `partly` before it refuses, so they get their correction and are said to
   stand, and only the others are the failure. A refusal before anything landed is the caller's. */
const writeProposed = async (documentId, ref, written, occasion) => {
  const pairs = written.map((one) => ({ field: one.field, value: one.value }));
  let part = null;
  try {
    await writeFields(documentId, pairs, {
      ref, refuse, override: true, ask: askedInSource("propose", ...pairs.map((one) => one.field)),
      partly: async (moved) => {
        const landed = written.filter((one) => moved.some((held) => held.field === one.field));
        part = { landed, unrecorded: await recordOf(documentId, ref, landed, occasion) };
      },
    });
  } catch (error) {
    if (!part) throw error;
    return { ...part, refused: error?.message ?? String(error) };
  }
  return { landed: written, unrecorded: await recordOf(documentId, ref, written, occasion) };
};

const live = () => ({ gateway, ask: ASKERS, effort: defaultEffort, write: writeProposed, switches: switchesOf });

const askOne = async (field, on, row, reach, deps) => {
  if (reach.problem) return { field, model: on.model, failed: `there is no gateway to send it to — ${reach.problem}` };
  const { model, refusal } = namedModel(reach.values, on.model);
  if (refusal) return { field, model: on.model, failed: refusal };
  const answer = await deps.ask[field](reach.values, model, row, on, { effort: deps.effort() });
  if (answer.refused) return { field, model, failed: answer.refused };
  /* The reason is what the correction rests on, so an answer without one is no proposal to write. */
  if (!String(answer.why ?? "").trim()) return { field, model, failed: "the model gave no reason, and a field is written only with the sentence it rests on" };
  return { field, model, value: answer.proposed, confidence: answer.confidence, why: answer.why };
};

/** The reply's lines, one per field asked about, in the order the fields are named. */
const linesOf = ({ written, failed, off }, ref) => [
  ...written.map((one) => `${one.field} ${one.value} proposed by ${one.model} (${confidenceSaid(one)}) and written.`),
  ...failed.map((one) => `${one.field} left unset: the proposal by ${one.model} failed — ${one.failed}. `
    + `Propose it again: ${proposeAgain(ref)}`),
  ...off.map((one) => `${one.field} left unset: ${one.off}. \`${one.route}\` turns its proposal on.`),
];

/** Every field in `absent` the record turns on is asked at once; what came back is written in one update
 *  and one correction. `row` is what the question reads — the title, the category and the body. */
export const proposeFields = async ({ documentId, ref, row, absent, occasion }, deps = live()) => {
  const switches = deps.switches();
  const on = absent.filter((field) => switches[field].model);
  const off = absent.filter((field) => !switches[field].model).map((field) => ({ field, ...switches[field] }));
  const reach = on.length ? deps.gateway() : null;
  const answers = await Promise.all(on.map((field) => askOne(field, switches[field], row, reach, deps)));
  const written = answers.filter((one) => one.value !== undefined);
  const failed = answers.filter((one) => one.failed !== undefined);
  const wrote = (written.length ? await deps.write(documentId, ref, written, occasion) : null) ?? { landed: written, unrecorded: null };
  const unread = written.filter((one) => !wrote.landed.includes(one))
    .map((one) => ({ ...one, failed: `the tracker did not read it back as written — ${wrote.refused}` }));
  const outcome = { written: wrote.landed, failed: [...failed, ...unread], off };
  const lines = linesOf(outcome, ref);
  if (wrote.unrecorded) lines.push(`The field(s) above were written and the correction naming their model was not: ${wrote.unrecorded}`);
  return { ...outcome, unrecorded: wrote.unrecorded, lines };
};

/** The step `forge new` hands the filing: the fields its flags left absent, proposed onto the issue the create
 *  answered with. Nothing here may cost the filing its id line, so a refusal on the way is a line naming it
 *  and the command that asks again, never an exit. */
export const proposeAtFiling = (filing, absent, deps = live()) => async (answer) => {
  const documentId = answer?.documentId ?? null;
  const ref = answer?.issueId ?? documentId;
  if (!documentId) return [`No field was proposed: the create named no id to write one onto.`];
  const row = { issueId: ref, title: filing.title, description: filing.body, category: filing.kind };
  try {
    const outcome = await refusing(() => proposeFields({ documentId, ref, row, absent, occasion: "at filing" }, deps));
    return outcome.lines;
  } catch (error) {
    return [`The fields proposed for ${ref} were not written: ${error?.message ?? error}`, `Propose them again: ${proposeAgain(ref)}`];
  }
};

/** The step a filing on another project's backlog is handed instead: the record that decides a proposal
 *  there is that project's, and a checkout of some other project does not read it, so nothing is asked
 *  and the reply names where the call that asks is run from. */
export const proposedElsewhere = (project) => async (answer) => {
  const ref = answer?.issueId ?? answer?.documentId ?? "the new issue";
  return [`priority and complexity left unset: this filing is on ${project}, whose record decides a proposal, `
    + `and this checkout reads another project's. From a checkout of ${project}: ${proposeAgain(ref)}`];
};

/** `forge issue ISS-nn --propose`: the fields the issue lacks, and only those, proposed and written. A call
 *  that could write none of what was absent is refused with every line saying why. */
export const proposeFor = async (reference, deps = live()) => {
  const { documentId, body } = await issueOf(reference);
  const ref = body?.issueId ?? reference;
  const absent = absentIn(body);
  if (!absent.length) {
    return console.log(`${ref} holds priority ${body.priority} and complexity ${body.complexity}. A proposal fills `
      + "only an absent field, so nothing was asked and nothing was written.");
  }
  const outcome = await proposeFields({ documentId, ref, row: body, absent, occasion: "on `forge issue --propose`" }, deps);
  if (!outcome.written.length) fail(outcome.lines.join("\n"));
  for (const line of outcome.lines) console.log(line);
  return null;
};
