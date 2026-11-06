/* Whether the project a dispatch is made from asked for no brief: its gate profile is read and is not
   `strict`, and it delivers fast, which is the tracker saying agents act first and the record follows
   (REQ-76, REQ-79). Read off the tracker per dispatch, because a profile is raised after an incident
   and a cached waiver would outlive the raise. */
import { projectAt, accountCredentials, useProject } from "../resolve/settings.mjs";

/* A gate holds a dispatch while it reads, so one attempt on a short clock, never the retry ladder. */
export const ONE_READ = { once: true, waits: 8 };

export const STRICT = "strict";

const firstLine = (read) => String(read.refused).split("\n")[0];

/** The gate profile alone, in one short attempt. A read that failed, or answered no profile, is
 *  `unread`: nobody may act on a profile nobody read. */
export const profileOf = async () => {
  const { callTool } = await import("../tracker/rest.mjs");
  const gates = await callTool("forge_config", { action: "gates" }, true, ONE_READ);
  if (gates?.refused) return { unread: firstLine(gates) };
  return typeof gates?.profile === "string" && gates.profile ? { profile: gates.profile } : { unread: "no profile in the answer" };
};

/** The project the process is aimed at, as its gates stand: `{ profile, fast, waived }`, or
 *  `{ unread }` with the tracker's first line where either read failed. */
export const gatesOf = async () => {
  const { callTool } = await import("../tracker/rest.mjs");
  const [read, config] = await Promise.all([
    profileOf(),
    callTool("forge_config", { action: "document" }, true, ONE_READ),
  ]);
  if (read.unread) return { unread: read.unread };
  if (config?.refused) return { unread: firstLine(config) };
  const fast = config?.document?.delivery?.fast !== false;
  return { profile: read.profile, fast, waived: read.profile !== STRICT && fast };
};

/** The process aimed at the project `directory` stands in: `{ slug }`, or `{ unread }` saying why no
 *  profile can be read for it. `act` names what was made from there. */
export const aimAt = (directory, act) => {
  const slug = directory ? projectAt(directory) : null;
  if (!slug) return { unread: `${directory ?? "this directory"} is in no checkout of a Forge project` };
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) return { unread: "no Forge endpoint is saved, so the profile was not read" };
  useProject({ slug, from: `the directory the ${act} was made from, ${directory}` });
  return { slug };
};

/** `{ waived: true, slug, profile }` where the project at `directory` is not strict on fast delivery, else
 *  `{ waived: false, why }` saying what was read or why nothing could be. */
export const briefWaived = async (directory) => {
  const aimed = aimAt(directory, "dispatch");
  if (aimed.unread) return { waived: false, why: aimed.unread };
  const { slug } = aimed;
  const read = await gatesOf();
  if (read.unread) return { waived: false, why: `the tracker did not answer for ${slug}: ${read.unread}` };
  if (read.waived) return { waived: true, slug, profile: read.profile };
  return { waived: false, why: `${slug} is gated \`${read.profile}\`${read.fast ? "" : " with fast delivery off"}` };
};

/** The doctor's row for it, so a master reads before it dispatches whether a brief will be asked. */
export const gatesRow = (read) => (read.unread
  ? { level: "note", label: "gates", detail: `not read — ${read.unread}` }
  : { level: "ok", label: "gates", detail: `${read.profile}, fast delivery ${read.fast ? "on" : "off"}: `
    + (read.waived ? "not strict, so a dispatch to a plugin role is asked for no brief"
      : "a dispatch to a plugin role sends what `forge brief` printed") });
