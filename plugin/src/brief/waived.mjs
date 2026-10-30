/* Whether the project a dispatch is made from asked for no brief: its gate profile is `yolo` and it
   delivers fast, which is the tracker saying agents act first and the record follows (REQ-76,
   REQ-79). Read off the tracker per dispatch, because a profile is raised after an incident and a
   cached `yolo` would outlive the raise. */
import { projectAt, accountCredentials, useProject } from "../resolve/settings.mjs";

/* A gate holds a dispatch while it reads, so one attempt on a short clock, never the retry ladder. */
const ONE_READ = { once: true, waits: 8 };

/** `{ waived: true, slug }` where the project at `directory` is yolo on fast delivery, else
 *  `{ waived: false, why }` saying what was read or why nothing could be. */
export const briefWaived = async (directory) => {
  const slug = directory ? projectAt(directory) : null;
  if (!slug) return { waived: false, why: `${directory ?? "this directory"} is in no checkout of a Forge project` };
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) return { waived: false, why: "no Forge endpoint is saved, so the profile was not read" };
  useProject({ slug, from: `the directory the dispatch was made from, ${directory}` });
  const { callTool } = await import("../tracker/rest.mjs");
  const [gates, config] = await Promise.all([
    callTool("forge_config", { action: "gates" }, true, ONE_READ),
    callTool("forge_config", { action: "document" }, true, ONE_READ),
  ]);
  const unread = [gates, config].find((one) => one?.refused);
  if (unread) return { waived: false, why: `the tracker did not answer for ${slug}: ${String(unread.refused).split("\n")[0]}` };
  const profile = gates?.profile ?? null;
  const fast = config?.document?.delivery?.fast !== false;
  if (profile === "yolo" && fast) return { waived: true, slug };
  return { waived: false, why: `${slug} is gated \`${profile ?? "unknown"}\`${fast ? "" : " with fast delivery off"}` };
};
