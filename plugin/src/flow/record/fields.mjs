/* `plan`, `criteria` and `note`: every refusal each can earn, and the field and the value each asks
   the writer for. Together because one update carries all three — a cap is measured on what the
   transport is about to send, so a call holding two of them is capped once or the first lands before
   the second is judged — and apart from `record.mjs` because that file stands at its line limit.
   docs/cli/record-the-rung.md. */
import { refuse } from "../../refusal.mjs";
import { citationsChecked, criteriaChecked } from "../../spec/checked.mjs";
import { SECTIONS, compoundCriteria, planFlags, planSteps, planTyped, sectionOwedBy, sectionsOwed, stepsUncited } from "../machine.mjs";
import { translateTo } from "../../resolve/settings.mjs";
import { readOrRefuse } from "../../codex/codex-read.mjs";
import { bodyFrom } from "../../resolve/payload.mjs";
import { flags } from "../../resolve/flags.mjs";
import { didYouMean } from "../../suggest.mjs";
import { kindUsage } from "./record-rows.mjs";
import { RUN_FLAGS } from "./rung.mjs";

const NUMBERED = /^(\d+)\.\s+(.*)$/u;

const CRITERIA_BODY = "record criteria takes the file holding the numbered lines, which a consult reads before the issue takes them.";
const PLAN_BODY = "record plan takes the file holding the plan, which a consult reads before the issue takes it.";

export const criteriaLines = (text) => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const match = NUMBERED.exec(line);
    if (!match) refuse(`Every criterion is a numbered line, \`N. outcome\`; this one is not:\n  ${line}`);
    const number = Number(match[1]);
    if (out.some((one) => one.number === number)) refuse(`Two criteria are numbered ${number}; a verdict names one by its number.`);
    out.push({ number, text: match[2] });
  }
  if (!out.length) refuse("No criteria given; an empty field is what Phase 5 cannot judge against.");
  return out;
};

/* The grammar's own reading, in the language the project writes its prose in: `machine.mjs` says
   which shapes it can prove and which it lets through. The refusal carries the halves — a line named without them is a second reading the author has to make. */
export const compoundRefused = (criteria, language = translateTo()) => {
  const found = compoundCriteria(criteria, language);
  if (!found.length) return;
  refuse([
    `${found.length === 1 ? "One criterion carries" : `${found.length} criteria carry`} two outcomes,`
      + " which is two criteria, so nothing was written:",
    ...found.flatMap((one) => [
      `  ${one.number}. one outcome: ${one.first}`,
      `  ${String(one.number).replace(/./gu, " ")}  another: ${one.second}`,
    ]),
    "Split each into two numbered lines, renumber what follows, and send the file one consult reads.",
  ].join("\n"));
};

/* Two forms, and a flag from the other one is refused rather than dropped. */
export const noteFrom = (argv) => {
  const { skip, ...rest } = flags(argv, "record note", ["--skip"], { usage: kindUsage("note") });
  const allowed = skip ? ["why", "technical"] : ["section", "user", "technical"];
  for (const given of Object.keys(rest)) {
    if (!allowed.includes(given)) {
      refuse(`record note${skip ? " --skip" : ""} takes ${allowed.map((one) => `--${one}`).join(" ")}, not --${given}.`);
    }
  }
  if (skip) {
    if (!rest.why) refuse("record note --skip needs --why: a withheld note says why it is withheld.");
    return { section: "Skip", userFacing: rest.why, technical: rest.technical ?? null };
  }
  if (!SECTIONS.includes(rest.section)) refuse(`--section takes one of ${SECTIONS.join(", ")}, or --skip --why.`);
  if (!rest.user) refuse("record note needs --user: what the reporter will now see, in their words.");
  return { section: rest.section, userFacing: rest.user, technical: rest.technical ?? null };
};

/* Every shape rule of a typed plan, before the field is written. A plan carrying no section at all
   is the free text this verb has always stored, so its shape is nobody's here to judge and what it
   owes is `approved`'s to say — which is what keeps a plan already on the tracker writable. */
const planChecked = (plan) => {
  if (!planTyped(plan)) {
    return console.error("The plan carries none of the sections `forge record plan -h` prints, so nothing"
      + " here judged its shape: it is stored as the free text it is, and `forge advance` will refuse"
      + " `approved` while it stays untyped.");
  }
  const declared = planFlags(plan);
  const owed = sectionsOwed(plan, declared);
  if (owed.length) {
    refuse([
      `The plan carries no ${owed.length === 1 ? "section" : `${owed.length} of the sections`} below, so nothing was written:`,
      ...owed.map((name) => {
        const by = sectionOwedBy(name, declared);
        return `  ## ${name}${by.length ? ` — the plan declares ${by.join(" and ")}` : ""}`;
      }),
      "Each opens on a heading whose text is the name and nothing else. What each answers: `forge record plan -h`.",
    ].join("\n"));
  }
  const bare = stepsUncited(planSteps(plan));
  if (bare.length) {
    refuse([
      `${bare.length === 1 ? "One step names" : `${bare.length} steps name`} no criterion, and a step`
        + " serving none is one no verdict reaches, so nothing was written:",
      ...bare.map((one) => `  ${one.number}. ${one.text}`),
      "Name what each serves on its own line, as `criteria: 3` or `criteria: 3, 4`.",
    ].join("\n"));
  }
  return null;
};

/* One file and nothing after it, and a flag in the path's place answered as the run flag it may be. */
const onlyFile = (kind, [path, ...extra], what) => {
  if (!path) refuse(what);
  if (path.startsWith("--")) refuse(`${didYouMean(`record ${kind} flag`, path, RUN_FLAGS)} ${what}`);
  if (extra.length) refuse(`record ${kind} takes one file and nothing after it, not \`${extra.join(" ")}\`.`);
  return readOrRefuse(path);
};

/** The plan field, and every refusal a plan can earn, from a file a consult has read. */
export const planPrepared = async (argv) => {
  const { refusal, text } = onlyFile("plan", argv, PLAN_BODY);
  if (refusal && text === null) refuse(refusal);
  const plan = text ?? await bodyFrom(argv[0]);
  if (!plan.trim()) refuse("An empty plan would clear the field; pass the plan itself.");
  citationsChecked(plan, refuse);
  planChecked(plan);
  if (refusal) refuse(refusal);
  return { field: "plan", value: plan, shown: plan };
};

/** The criteria field, numbered and renumbered by nobody: the numbers a verdict names are stored. */
export const criteriaPrepared = async (argv) => {
  /* The file's own shape first, the consult after it: a criterion this verb will refuse anyway is
     one no review round should have been spent on, which is the whole of ISS-483. */
  const { refusal, text } = onlyFile("criteria", argv, CRITERIA_BODY);
  if (refusal && text === null) refuse(refusal);
  const criteria = criteriaLines(text ?? await bodyFrom(argv[0]));
  criteriaChecked(criteria, refuse);
  compoundRefused(criteria);
  if (refusal) refuse(refusal);
  const value = criteria.map((one) => `${one.number}. ${one.text}`).join("\n");
  return { field: "acceptanceCriteria", value, shown: value };
};

/** The release note, in whichever of its two forms was typed. */
export const notePrepared = (argv) => {
  const value = noteFrom(argv);
  return { field: "releaseNotes", value, shown: JSON.stringify(value, null, 2) };
};
