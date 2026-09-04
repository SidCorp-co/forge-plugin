/* What the harness settles before a call and reads off the reply after it, with no gateway in
   reach: a rule you cannot run offline is a rule nobody checks. docs/cli/codex-the-consult.md. */
import { userConfig } from "../resolve/config.mjs";

export const EFFORTS = ["minimal", "low", "medium", "high"];
export const defaultEffort = () => userConfig().codex?.effort || "medium";

export const DEFAULT_ROUNDS = 3;
export const DEFAULT_ROUNDS_MAX = 5;
export const DEFAULT_SMALL_LINES = 40;
export const DEFAULT_LARGE_LINES = 400;
const FLOOR = 2;

const stepped = (level, by) => {
  const at = EFFORTS.indexOf(level);
  return at < 0 ? level : EFFORTS[Math.min(EFFORTS.length - 1, Math.max(0, at + by))];
};

export const budgetFor = ({ base, ceiling, bodies = false, clipped = 0 }) => {
  const want = (bodies && !clipped ? Math.max(FLOOR, base - 1) : base) + clipped;
  return Math.max(1, Math.min(want, Math.max(base, ceiling)));
};

/** One step off the base, never two, and the round outranks the size. */
export const effortFor = ({ base, recheck = false, lines = 0, small, large }) => {
  if (recheck) return stepped(base, -1);
  if (!lines) return base;
  if (lines > large) return stepped(base, 1);
  return lines < small ? stepped(base, -1) : base;
};

/* First person, because "a guard cannot read a stale value" is a finding and not a short review. Never
   a CANNOT TELL either: that ruling is what the grammar asks for. docs/cli/codex-the-consult.md. */
export const INCOMPLETE =
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
export const plannedFor = ({ parts, bodies, recheck, asked, effort }) => {
  const limits = plannedLimits();
  const clipped = parts.filter((part) => part.clipped);
  const lines = changedLines(parts);
  const budget = asked ?? budgetFor({ ...limits, bodies, clipped: clipped.length });
  return {
    clipped: clipped.map((part) => part.rel),
    lines,
    budget,
    /* `--rounds 1` asked for one call; a ladder spending five more is the overrun it prevents. */
    ceiling: asked ?? Math.max(budget, limits.ceiling),
    effort: effort ?? effortFor({ base: defaultEffort(), recheck, lines, small: limits.small, large: limits.large }),
  };
};

