/* A verdict that keeps a probe is recorded through the verdict door (POST /api/issues/:id/verdicts),
   the only door core keeps a probe from, rather than as a comment: `record.mjs` prepares it here and
   `thread/written.mjs` sends it after the uploads. Before any of that, the issue's criterion classes
   are read and every block core would refuse is named in one message, so nothing uploads for a verdict
   core would turn back — core's clip and probe rules mirrored by their own refusal codes.
   docs/cli/record.md. ISS-7. */
import { refuse } from "../../../refusal.mjs";
import { PROBE_TAKES, SHORT, criterionNumber } from "../../machine.mjs";
import { draftRuntimeOf } from "../../machine/identity.mjs";
import { render } from "../page.mjs";
import { runOf } from "../../../codex/codex-log.mjs";

/* A pass or short rests on a kept probe (core's `verdictEarns`); a pass, short or fail owes a screen
   clip (core's `CITING_VERDICTS`). Spelt here off core's words so a value added to one set is added to
   the one it belongs to. */
const RESTS_ON_PROBE = new Set(["pass", SHORT]);
const OWES_CLIP = new Set(["pass", SHORT, "fail"]);

/* A screen clip is a WebM or MP4 (core's `RELEASE_CLIP_MIMES`); an attachment goes up under its base
   name, so a cited clip carries the extension it went up with. A URL or a commit is never one. */
const CLIP = /\.(?:webm|mp4)$/iu;
const hasClip = (evidence) => (evidence ?? []).some((one) => CLIP.test(String(one)));

const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const CALLERS = new Set(["anonymous", "replayer"]);

const bad = (why) => ({ refusal: `${why} (VERDICT_PROBE_SHAPE). A probe is ${PROBE_TAKES}` });

/** The probe a `--probe` value stands for, or `{ refusal }` where its shape is wrong: the two forms
 *  and the fields each owes, checked here so an obvious error costs no upload. The field regexes core
 *  holds (a path's form, a service slug) are left to the door, whose refusal the uploaded-names lead
 *  then carries. */
const probeParsed = (text) => {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return bad("is not JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return bad("is not a probe object");
  if (value.kind === "request") {
    const request = value.request;
    if (!request || typeof request !== "object") return bad("names no `request`");
    if (!METHODS.has(request.method)) return bad("names no request method (GET, POST, …)");
    if (typeof request.path !== "string" || !request.path.startsWith("/")) {
      return bad("names no `path` on the build's origin (one starting with `/`)");
    }
    if (!CALLERS.has(request.as)) return bad("names no `as`: `anonymous` or `replayer`");
    if (!value.expect || typeof value.expect !== "object" || !Number.isInteger(value.expect.status)) {
      return bad("names no expected `status`");
    }
    return { probe: value };
  }
  if (value.kind === "command") {
    const command = value.command;
    if (!command || !Array.isArray(command.argv) || !command.argv.length) return bad("names no command `argv`");
    if (!value.expect || typeof value.expect !== "object" || !Number.isInteger(value.expect.exitCode)) {
      return bad("names no expected `exitCode`");
    }
    return { probe: value };
  }
  return bad("names no `kind`: `request` or `command`");
};

/* What a verdict goes to the door as: the criterion by number, its identity read runtime before commit
   (core's `verdictPairsIn` order), and the probe it keeps. The judge id a comment verdict stamps is no
   field here — the door attributes the verdict to the credential it is sent on. */
const doorDraft = (got, probe, run) => {
  const criterion = criterionNumber(got.criterion);
  const draft = draftRuntimeOf(got.runtime);
  const identity = draft !== null
    ? { kind: "storefront_draft", workflowId: draft.workflowId, draftVersion: draft.draftVersion, environment: got.environment }
    : got.runtime !== undefined
      ? { kind: "runtime", ref: got.runtime }
      : got.commit !== undefined
        ? { kind: "commit", sha: got.commit }
        : null;
  const payload = {
    criterion,
    verdict: got.verdict,
    ...(got.why !== undefined ? { reason: got.why } : {}),
    ...(identity ? { identity } : {}),
    ...(got.evidence?.length ? { evidence: got.evidence } : {}),
    probe,
    ...(got["without-clip"] !== undefined ? { withoutClip: got["without-clip"] } : {}),
    ...(run ? { run } : {}),
  };
  return { criterion, verdict: got.verdict, payload, rendered: render("verdict", [got], null) };
};

/* Every block core would refuse, named in one line of its own, by the same code core names it by: a
   malformed probe, a pass or short on an observable criterion resting on a probe nobody sent or kept, a
   pass, short or fail on one citing no clip, and a probe on a verdict with no commit or runtime for the
   door to record it against. */
const faultsOf = (blocks, classes, parsed) => {
  const out = [];
  for (const got of blocks) {
    const number = criterionNumber(got.criterion);
    const sent = got.probe !== undefined;
    const verdict = got.verdict;
    if (sent) {
      const read = probeParsed(got.probe);
      if (read.refusal) out.push(`criterion ${number}'s --probe ${read.refusal}`);
      else parsed.set(got, read.probe);
    }
    const held = classes?.get(number);
    const klass = held?.klass ?? null;
    if (klass === "observable" && OWES_CLIP.has(verdict) && !got["without-clip"] && !hasClip(got.evidence)) {
      out.push(`criterion ${number} is observable on the running build and a \`${verdict}\` on it cites no `
        + "screen clip (a WebM or MP4 in --evidence) and no --without-clip (VERDICT_CLIP_REQUIRED)");
    }
    if (klass === "observable" && RESTS_ON_PROBE.has(verdict) && !sent && !(held?.kept)) {
      out.push(`criterion ${number} is observable on the running build and a \`${verdict}\` on it rests on `
        + "a kept probe; none was sent (--probe) and none is kept on it (VERDICT_PROBE_REQUIRED)");
    }
    if (sent && verdict !== "skipped" && got.commit === undefined && got.runtime === undefined) {
      out.push(`criterion ${number} sends --probe, which the verdict door records against a commit or a `
        + "runtime, and this issue lands outside git: record it without --probe");
    }
  }
  return out;
};

// cm:why beta answers a route it lacks ROUTE_ABSENT and dev answers NOT_FOUND naming no route, and the criteria read shares the verdict door's routes (ISS-62)
const NO_DOOR = /^(?:ROUTE_ABSENT:|NOT_FOUND:.*no route serves)/isu;

const refuseProbeWithoutDoor = (blocks, refused, reference) => {
  if (!refused || !NO_DOOR.test(refused) || !blocks.some((got) => got.probe !== undefined)) return;
  refuse(`record verdict on ${reference}: this tracker serves no verdict door, so a --probe cannot be kept `
    + "there, and nothing was sent and nothing went up. Its criteria read answered: "
    + `${refused.split("\n")[0]}\nSend the same command without --probe to record the verdict as a comment.`);
};

/** The door drafts a verdict write sends and the blocks that stay a comment, after refusing locally —
 *  all of them in one message — every block core would refuse once its evidence was up. One write is
 *  all-or-nothing, so a single faulty block turns the whole write back with nothing sent, every block
 *  at fault named so the caller fixes them in one retry (ISS-7). `classes` is null where the criteria
 *  read could not be had: the clip and probe-required rules are then core's to apply, and only a
 *  malformed probe and a missing identity are still refused here. */
export const verdictDoorPrepared = (blocks, { reference, classes, refused = null, run = runOf() }) => {
  refuseProbeWithoutDoor(blocks, refused, reference);
  const parsed = new Map();
  const faults = faultsOf(blocks, classes, parsed);
  if (faults.length) {
    const were = faults.length === 1 ? "block core would refuse once its evidence was"
      : "blocks core would refuse once their evidence was";
    refuse(`record verdict on ${reference}: ${faults.length} ${were} up, and one write is `
      + "all-or-nothing, so nothing was sent and nothing went up:\n"
      + faults.map((one) => `  ${one}`).join("\n")
      + "\nFix every block named and send the write again.");
  }
  return {
    drafts: blocks.filter((got) => got.probe !== undefined).map((got) => doorDraft(got, parsed.get(got), run)),
    commentBlocks: blocks.filter((got) => got.probe === undefined),
  };
};
