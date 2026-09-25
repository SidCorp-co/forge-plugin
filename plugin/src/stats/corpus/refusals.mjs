/* The refusal reader `stats runs` and the waves share: docs/cli/stats-the-refusals.md */
import { VERB_NAMES } from "../../resolve/visibility.mjs";
import { escaped } from "../../markdown.mjs";
import { WHOLE, appendedLine } from "../../hooks/appended.mjs";
import { held } from "../../shown/ledger.mjs";

/* The harness's own sentence is cut off the line it shares, so a repeat keys on the rule it names. */
const shortened = (line) =>
  (line.replace(WHOLE, "").trim().slice(0, 110) || "(empty)")
    .replaceAll(/ISS-\d+/gu, "ISS-nn").replaceAll(/[0-9a-f]{7,}/gu, "<sha>");

/* Every gate's refusal ends on the line `how()` writes, and the harness returns a denial as the
   whole result — so where that line is the last the gate wrote, the rule is named on the first. A
   body that only quotes a refusal goes on printing past it. */
const GATE_HOW = /^How: `forge hooks --how \S+`$/u;

/* The host names the event ahead of a denial it relays from a hook, which is not the gate's text. */
const HOST_SAID = /^\S+:\S+ hook error: /u;

/* The shown ledger's one-line repeat, opening on the words `held()` writes ahead of the route. */
const AGAIN = escaped(held("\u0000").split("`")[0]);

/* A gate's openers, the shown ledger's repeat and the transport's `<name> refused:`, the rule after
   the colon for a transport failure and on the next line for a tool's. Read first: a refusal opening
   on one goes on to quote the lines it was refused over, which look like the shape below. */
const OPENERS = String.raw`Hold — |Refused(?:\.| —) |${AGAIN}|\S+ refused:`;
const MARKED = new RegExp(`^(?:${OPENERS}).*$`, "u");
/* The same openers over the whole body, unsplit where none is in it. A prefilter and not a second matcher: `/m` sees a break at a bare CR that `split` does not, so the split still decides. */
const ANY_MARKED = new RegExp(`^(?:${HOST_SAID.source.slice(1)})?(?:${OPENERS})`, "mu");

/* `settings.mjs` refuses with a verb and no marker, and so does a line an ANSWERING call printed —
   `project id: …` — hence the failed-call guard and a marked line's precedence over this shape. */
const VERB_SENTENCE = new RegExp(String.raw`^(?:forge )?(?:${VERB_NAMES.join("|")})\b.*?: .*$`, "u");

const TOOL_RULE = /^\S+ refused:[ \t]*(?<rule>.*)$/u;

const lastOf = (lines, shape) => {
  for (let at = lines.length - 1; at >= 0; at -= 1) if (shape.test(lines[at])) return at;
  return -1;
};

/* The last line the gate wrote, the harness's own being read past. */
const lastWritten = (lines) => lines.findLast((one) => !appendedLine(one)) ?? "";

/** The line naming the rule a call was refused by, or null where it met none of this plugin's own.
 *  Never the body's first line by default: a `forge` command prints its provenance banner before it
 *  refuses, and reading line one filed 187 of those banners under a row that names no rule. */
export const refusalIn = (call) => {
  const whole = call.body.trim();
  if (!call.error && !ANY_MARKED.test(whole)) return null;
  const lines = whole.split("\n").filter((one) => one.trim()).map((one) => one.replace(HOST_SAID, ""));
  if (!lines.length) return null;
  if (call.error && GATE_HOW.test(lastWritten(lines))) return shortened(lines[0]);
  /* A marked line counts however the call exited: a run that pipes a refusal through `tail`, or
     ends the line with `; echo EXIT=$?`, met it just the same and the shell answered 0 for it.
     411 of this project's 813 marked refusals arrived that way, against seven bodies that merely
     quoted one — which is the trade, and docs/cli/stats-the-refusals.md carries it. */
  let at = lastOf(lines, MARKED);
  /* The shown ledger cut a repeat to the lines this session had not seen, which carry no opener;
     the harness's sentence about the whole command is what is left to say a gate refused it. */
  if (at < 0 && call.error && lines.some((one) => one.trim().endsWith(WHOLE))) return shortened(lines[0]);
  if (at < 0 && call.error) at = lastOf(lines, VERB_SENTENCE);
  if (at < 0) return null;
  const tool = TOOL_RULE.exec(lines[at]);
  if (!tool) return shortened(lines[at]);
  return shortened(tool.groups.rule || lines[at + 1] || lines[at]);
};
