/* What the harness settles before a call and reads off the reply after it, with no gateway in
   reach: a rule you cannot run offline is a rule nobody checks. docs/cli/codex-the-consult.md. */
import { isAbsolute } from "node:path";

import { configPath, userConfig } from "../resolve/config.mjs";
import { fail, fromProject, projectCodex } from "../resolve/settings.mjs";

export const EFFORTS = ["minimal", "low", "medium", "high"];
export const defaultEffort = () => userConfig().codex?.effort || "medium";

const DEFAULT_ROUNDS = 3;
const DEFAULT_ROUNDS_MAX = 5;
const DEFAULT_SMALL_LINES = 40;
const DEFAULT_LARGE_LINES = 400;
const FLOOR = 2;

const stepped = (level, by) => {
  const at = EFFORTS.indexOf(level);
  return at < 0 ? level : EFFORTS[Math.min(EFFORTS.length - 1, Math.max(0, at + by))];
};

export const budgetFor = ({ base, ceiling, bodies = false, clipped = 0 }) => {
  const want = (bodies && !clipped ? Math.max(FLOOR, base - 1) : base) + clipped;
  return Math.max(1, Math.min(want, Math.max(base, ceiling)));
};

const SENDS = ["diffs", "bodies"];

/* `null` where nobody named one, which is not `diffs`: the default is the one thing the set may overrule. The account's and never the checkout's, which names no send mode, because what of a file travels is the caller's business per consult where `codex.pathRe` and `codex.check` are the project's. */
export const chosenSend = (raw) => {
  const named = raw ?? userConfig().codex?.send ?? null;
  if (named !== null && !SENDS.includes(named)) fail(`codex: --send takes ${SENDS.join(" | ")}, not \`${named}\`.`);
  return named;
};

/** Whether this set travels whole, and what is owed the caller about why. Bodies off where the reviewer has tools and a diff to read: it fetches what it needs and the payload stops paying twice. But an absolute rel is `locate`'s word for a path outside the root, and what a consult names one for is a plan or a criteria file — the run's own scratch, in no checkout at all, so nothing can be shown of it as a change and its text is the whole of what the write that takes it asks for, which a diffs consult is refused by a round after the review (ISS-1311). Bodies over the set for that reason, and decided after `--recheck` has narrowed it rather than while the flags are read, a mode chosen before the set walking back into the same refusal. `changedIn` will diff an absolute path that does belong to another checkout, so this is a policy about where a path lies and never a claim that no diff of it exists. */
export const modeFor = (send, rels) => {
  const outside = rels.filter(isAbsolute);
  if (send === null) {
    return {
      bodies: outside.length > 0,
      said: outside.length
        ? `codex: ${outside.length} file(s) lie outside this checkout, so this consult sends them `
          + `whole rather than as a change of this repository: ${outside.join(", ")}. `
          + "Pass --send diffs for what the default would otherwise have sent."
        : null,
    };
  }
  const bodies = send === "bodies";
  return {
    bodies,
    said: outside.length && !bodies
      ? `codex: ${send} was named rather than defaulted, so it stands over the ${outside.length} `
        + "file(s) lying outside this checkout, which a plan or criteria write will then refuse for "
        + `carrying no whole body: ${outside.join(", ")}.`
      : null,
  };
};

/* Four jobs, and the size decides only for the one that says nothing about itself. */
const STEPS = { recheck: -1, verify: 1, bodies: 1, diff: 0 };

export const kindOf = ({ recheck = false, bodies = false, risks = 0 }) => {
  if (recheck) return "recheck";
  if (risks) return "verify";
  return bodies ? "bodies" : "diff";
};

/** One step off the base, never two, and the kind outranks the size. */
export const effortFor = ({ base, kind = "diff", lines = 0, small, large }) => {
  const step = STEPS[kind] ?? 0;
  if (step) return stepped(base, step);
  if (!lines) return base;
  if (lines > large) return stepped(base, 1);
  return lines < small ? stepped(base, -1) : base;
};

/* This gateway states a model's effort in the model id and validates the suffix — an invented one is
   refused with a 400 — so the id is the channel it reads and `reasoning_effort` is the one it does
   not. docs/cli/codex-the-round.md. */
const RUNG_END = new RegExp(`-(${EFFORTS.join("|")})$`, "u");

export const rungIn = (model) => String(model ?? "").match(RUNG_END)?.[1] ?? null;

export const effortVia = (model) => (rungIn(model) ? "model" : "parameter");

const rungTable = () => {
  const held = userConfig().codex?.rungs;
  return held && typeof held === "object" && !Array.isArray(held) ? held : {};
};

export const rungLadder = () => Object.entries(rungTable()).filter(([level]) => EFFORTS.includes(level));

export const rungFor = (effort, slotted) => {
  const table = rungTable();
  return table[effort] ?? table[defaultEffort()] ?? slotted ?? null;
};

export const disagreement = (effort, model) => {
  const said = rungIn(model);
  return said && said !== effort ? said : null;
};

/* First person, because "a guard cannot read a stale value" is a finding and not a short review. Never
   a CANNOT TELL either: that ruling is what the grammar asks for. docs/cli/codex-the-consult.md. */
const INCOMPLETE =
  /\b(?:I|we)\s+(?:could not|couldn't|cannot|can't|was unable to|were unable to|am unable to|did not get to)\s+(?:\w+\s+){0,6}?(?:check|verify|verified|confirm|read|inspect|examine|run|open|trace)\b|\b(?:no|without)\s+(?:further|more|additional|remaining)\s+tool|(?:tool|repository)\s+(?:calls?|access|budget)\s+(?:\w+\s+){0,3}?(?:exhausted|ended|spent|gone|capped|withdrawn)|ran out of tool|could not be (?:checked|verified|confirmed|read) (?:here|within|because)/i;

export const incompleteIn = (reply) => INCOMPLETE.test(String(reply ?? ""));

export const isNewFinding = (text) => /\bnew\b/i.test(String(text ?? "").split(":")[0]);

export const newFindingsIn = (findings) => findings.filter((one) => isNewFinding(one.text)).length;

export const keepsTools = () => userConfig().codex?.toolChoiceNone !== false;

const positive = (raw, fallback) => (Number.isInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : fallback);

export const plannedLimits = () => {
  const held = userConfig().codex ?? {};
  return {
    base: positive(held.rounds, DEFAULT_ROUNDS),
    ceiling: positive(held.roundsMax, DEFAULT_ROUNDS_MAX),
    small: positive(held.effortLines?.small, DEFAULT_SMALL_LINES),
    large: positive(held.effortLines?.large, DEFAULT_LARGE_LINES),
  };
};

/* A diff's moved lines, or the whole body where there is no diff to count. */
const HUNK = /^[+-][^+-]/u;
const changedLines = (parts) =>
  parts.reduce((many, part) => {
    if (part.diff?.text) return many + part.diff.text.split("\n").filter((line) => HUNK.test(line)).length;
    if (part.diff && !part.diff.untracked) return many;
    return many + String(part.text ?? "").split("\n").length;
  }, 0);

/** Both numbers come off the same two facts, so they are decided together; an asked-for one wins. */
export const plannedFor = ({ parts, bodies, recheck, risks = 0, asked, effort }) => {
  const limits = plannedLimits();
  const clipped = parts.filter((part) => part.clipped);
  const lines = changedLines(parts);
  const budget = asked ?? budgetFor({ ...limits, bodies, clipped: clipped.length });
  const kind = kindOf({ recheck, bodies, risks });
  return {
    clipped: clipped.map((part) => part.rel),
    lines,
    budget,
    kind,
    /* `--rounds 1` asked for one call; a ladder spending five more is the overrun it prevents. */
    ceiling: asked ?? Math.max(budget, limits.ceiling),
    effort: effort ?? effortFor({ base: defaultEffort(), kind, lines, small: limits.small, large: limits.large }),
  };
};

/* What a checkout naming no angles is reviewed by: every angle, debt among them by the owner's choice of
   2026-09-25 (ISS-2466). A project turns debt off by naming a list without it, and `forge codex stats`
   prints its row so whether it pays is a figure. */
export const DEFAULT_ANGLES = ["tech", "ba", "user", "ux", "debt"];

/* Which angles review a consult here, and which level said so: one reading shared by the consult, by
   `forge codex show` and by `forge doctor`, so the line a reader is shown is the list the consult runs. */
const listed = (given) =>
  (Array.isArray(given) ? given : String(given).split(",")).map((one) => String(one).trim()).filter(Boolean);

const DEFAULT_FROM = "the plugin's default";

/** The angles in effect and where they were read: the flag, else the checkout's file, else the
 *  machine's, else the default. Names are returned as given, an empty list included, because refusing
 *  what no consult can run under is the consult's to do. */
export const anglesInEffect = (raw) => {
  const said = [
    [raw, "--angles"],
    [projectCodex().angles, `codex.angles in ${fromProject()}`],
    [userConfig().codex?.angles, `codex.angles in ${configPath()}`],
  ].find(([value]) => value !== undefined);
  return said ? { angles: listed(said[0]), from: said[1] } : { angles: DEFAULT_ANGLES, from: DEFAULT_FROM };
};

/* A list a project wrote before debt existed is its own choice and is kept. What it is owed is to
   learn the angle exists, and the one write that adds it. */
const debtSaid = ({ angles }) => (angles.includes("debt")
  ? "debt is on"
  : `debt is available and off here: \`forge doctor --set project.codex.angles=${[...angles, "debt"].join(",")}\` adds it`);

/** The line `show` and `doctor` print, whether the debt angle is among them said on it. */
export const anglesShown = (raw) => {
  const held = anglesInEffect(raw);
  if (!held.angles.length) return `none  ← ${held.from} — a list naming no angle, so a consult here is refused`;
  return `${held.angles.join(", ")}  ← ${held.from} — ${debtSaid(held)}`;
};
