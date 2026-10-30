/* Whether the project a dispatch is made from asked for no brief: its gate profile is `yolo` and it
   delivers fast, which is the tracker saying agents act first and the record follows (REQ-76,
   REQ-79). Read off the tracker per dispatch, because a profile is raised after an incident and a
   cached `yolo` would outlive the raise. */
import { projectAt, accountCredentials, useProject } from "../resolve/settings.mjs";

/* A gate holds a dispatch while it reads, so one attempt on a short clock, never the retry ladder. */
export const ONE_READ = { once: true, waits: 8 };

/** The project the process is aimed at, as its gates stand: `{ profile, fast, waived }`, or
 *  `{ unread }` with the tracker's first line where either read failed. */
export const gatesOf = async () => {
  const { callTool } = await import("../tracker/rest.mjs");
  const [gates, config] = await Promise.all([
    callTool("forge_config", { action: "gates" }, true, ONE_READ),
    callTool("forge_config", { action: "document" }, true, ONE_READ),
  ]);
  const unread = [gates, config].find((one) => one?.refused);
  if (unread) return { unread: String(unread.refused).split("\n")[0] };
  const profile = gates?.profile ?? null;
  const fast = config?.document?.delivery?.fast !== false;
  return { profile, fast, waived: profile === "yolo" && fast };
};

/** `{ waived: true, slug }` where the project at `directory` is yolo on fast delivery, else
 *  `{ waived: false, why }` saying what was read or why nothing could be. */
export const briefWaived = async (directory) => {
  const slug = directory ? projectAt(directory) : null;
  if (!slug) return { waived: false, why: `${directory ?? "this directory"} is in no checkout of a Forge project` };
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) return { waived: false, why: "no Forge endpoint is saved, so the profile was not read" };
  useProject({ slug, from: `the directory the dispatch was made from, ${directory}` });
  const read = await gatesOf();
  if (read.unread) return { waived: false, why: `the tracker did not answer for ${slug}: ${read.unread}` };
  if (read.waived) return { waived: true, slug };
  return { waived: false, why: `${slug} is gated \`${read.profile ?? "unknown"}\`${read.fast ? "" : " with fast delivery off"}` };
};

/** The doctor's row for it, so a master reads before it dispatches whether a brief will be asked. */
export const gatesRow = (read) => (read.unread
  ? { level: "note", label: "gates", detail: `not read — ${read.unread}` }
  : { level: "ok", label: "gates", detail: `${read.profile ?? "unknown"}, fast delivery ${read.fast ? "on" : "off"}: `
    + (read.waived ? "a dispatch to a plugin role is asked for no brief"
      : "a dispatch to a plugin role sends what `forge brief` printed") });
