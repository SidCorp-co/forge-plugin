/* The release run's first write: what it is working from, which core's deploy door reads before it
   lets a run's deploy change production (RELEASE_NOTHING_RECORDED). Nothing in this CLI made it, so a
   coolify deploy under a run (`--run`) was refused by a step no verb could take. `loaded: false` with a detail
   is an answer core takes, for a run whose method would not load. docs/cli/release-batch.md. */
import { flags } from "../../resolve/flags.mjs";
import { fail } from "../../resolve/settings.mjs";
import { write } from "../../tracker/rest.mjs";
import { answeredOr } from "./refused.mjs";

export const METHOD_USAGE = "Usage: forge release-batch method <runId> --skill <name> [--not-loaded] "
  + '[--detail "<text>"]';

/* Core's own bounds on the body (`methodBodySchema`), measured here so an over-long value is refused
   before the call rather than by the route's 400. */
const SKILL_MAX = 200;
const DETAIL_MAX = 4_000;

const owed = (what) => fail(`release-batch method: nothing written. ${what}\n${METHOD_USAGE}`);

export const method = async ([runId, ...rest]) => {
  if (!runId || runId.startsWith("--")) owed("The runId is owed: the one `forge release-batch start` printed.");
  const given = flags(rest, "release-batch method", ["--not-loaded"], { usage: METHOD_USAGE });
  const skill = String(given.skill ?? "").trim();
  if (!skill) owed("--skill is owed: the method this release run works from, by name.");
  if (skill.length > SKILL_MAX) owed(`--skill is ${skill.length} characters and core takes ${SKILL_MAX}.`);
  const detail = given.detail === undefined ? undefined : String(given.detail).trim();
  if (detail !== undefined && !detail) owed("--detail was given empty: say what it is, or leave it off.");
  if (detail && detail.length > DETAIL_MAX) owed(`--detail is ${detail.length} characters and core takes ${DETAIL_MAX}.`);
  const data = { skill, loaded: !given["not-loaded"], ...(detail ? { detail } : {}) };
  const said = answeredOr("method", await write("forge_release_batch.method", { runId, data }, undefined, true));
  console.log(`runId      ${runId}`);
  console.log(`method     ${said?.skill ?? skill}, ${said?.loaded ?? data.loaded ? "loaded" : "not loaded"}`);
  if (said?.detail) console.log(`detail     ${said.detail}`);
  console.log(`The run has recorded on its batch, so a deploy under it — \`--run ${runId}\` on the tracker `
    + "route's `forge coolify deploy` — is no longer refused for that.");
};
