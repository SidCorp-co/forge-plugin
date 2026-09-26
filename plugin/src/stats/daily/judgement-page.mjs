/* The models' reading of a day as the page shows it: the Decisions block, one self-contained section
   a layout can move whole; each section's line at that section's head; and what each role spent, in
   the footer. Every figure a reading names is shown with the label and value the page computed, never
   in the model's words: docs/cli/stats.md. */
import { esc } from "./html.mjs";

const figureSaid = (figure) => `${esc(figure.said)}: ${esc(figure.value)}`;

const STAGE_NAMES = { explore: "explore", review: "review", judge: "judge" };

/** One line per stage that did not run as configured, and per section a stage could not finish. */
export const stageLines = (judgement) => [
  ...Object.entries(judgement.stages ?? {}).filter(([, stage]) => stage.skipped)
    .map(([role, stage]) => `The ${STAGE_NAMES[role] ?? role} stage was skipped: ${stage.skipped}.`),
  ...Object.values(judgement.sections ?? {}).flatMap((read) => read.notes.map((note) => `${read.title}: ${note}.`)),
];

/** How many readings were dropped at which stage and why, in one sentence, or null where none was. */
export const droppedLine = (judgement) => {
  const dropped = judgement.dropped ?? [];
  if (!dropped.length) return null;
  const total = dropped.reduce((sum, one) => sum + one.count, 0);
  return `${total} reading(s) dropped before this page was written: `
    + `${dropped.map((one) => `${one.count} at ${one.stage}, ${one.reason}`).join("; ")}.`;
};

const decisionHtml = (one) => `<li><strong>${esc(one.action)}</strong> — ${esc(one.what)}`
  + `<br><span class="note">Figure <code>${esc(one.figure.key)}</code>, ${figureSaid(one.figure)}.`
  + `${one.command ? ` Carried out by <code>${esc(one.command)}</code>.` : ""}</span></li>`;

/** What a judged page says in place of its decisions where it holds none: the judge's own word that
 *  there was nothing, or that none of what it proposed survived the checks, which is not the same. */
export const NOTHING = "Nothing to decide.";
export const NONE_KEPT = "No decision the judge proposed survived the checks.";
export const emptySaid = (judgement) => (judgement.nothing ? NOTHING : NONE_KEPT);

const judgedBody = (judgement) => {
  if (judgement.decisions.length) return `<ol class="decisions">${judgement.decisions.map(decisionHtml).join("")}</ol>`;
  return `<p><strong>${esc(emptySaid(judgement))}</strong></p>`;
};

/** The Decisions block, or the one line saying why the page carries none; nothing for a page written
 *  before the reading existed. */
export const decisionsHtml = (judgement) => {
  if (!judgement) return "";
  const notes = [...stageLines(judgement), droppedLine(judgement)].filter(Boolean);
  if (judgement.why) {
    return `<section id="decisions"><p class="missing">No decisions: ${esc(judgement.why)}.</p>`
      + `${notes.map((one) => `<p class="note">${esc(one)}</p>`).join("")}</section>`;
  }
  if (!judgement.judged) {
    return `<section id="decisions"><h2>Decisions</h2><p class="missing">No decisions: no judge ran.</p>`
      + `${notes.map((one) => `<p class="note">${esc(one)}</p>`).join("")}</section>`;
  }
  return `<section id="decisions"><h2>Decisions</h2>${judgedBody(judgement)}`
    + `${notes.map((one) => `<p class="note">${esc(one)}</p>`).join("")}`
    + `<p class="note">Judged by models over this page's own figures, at ${esc(judgement.at)}; every figure cited was checked against them.</p></section>`;
};

const findingHtml = (one) => `<li>${esc(one.reading)} <span class="note">(<code>${esc(one.figure.key)}</code>, ${figureSaid(one.figure)})</span></li>`;

/** What a section opens with: the judge's line where it gave one, else the findings the stages kept. */
export const sectionHead = (judgement, id) => {
  const read = judgement?.sections?.[id];
  if (!read) return "";
  if (read.verdict) return `<p class="verdict"><strong>${esc(read.verdict)}</strong> — ${esc(read.why)}</p>`;
  if (read.input === "figures" || !read.findings.length) return "";
  const said = read.input === "findings" ? "Reviewed findings" : "Unreviewed findings";
  return `<p class="note">${said}, no judge having ruled on this section:</p><ul>${read.findings.map(findingHtml).join("")}</ul>`;
};

/** Per role: the model, its calls and the tokens they spent. */
export const costLines = (judgement) => Object.entries(judgement?.cost ?? {}).map(([role, one]) =>
  `${role}: ${one.model}, ${one.calls} call(s)${one.failed ? ` of which ${one.failed} failed` : ""}, `
  + `${one.input} input and ${one.output} output token(s)`);

export const costFooter = (judgement) => {
  const lines = costLines(judgement);
  return lines.length ? `<footer><p class="note">What reading this page cost: ${lines.map(esc).join("; ")}.</p></footer>` : "";
};
