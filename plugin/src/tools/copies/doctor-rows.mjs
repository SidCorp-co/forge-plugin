/* The doctor's copy subject: which copy a typed `forge` reaches, which one that runs from here, and
   which the gates run. docs/cli/the-way-in.md. */
import { join } from "node:path";

import { copyToRun, FROZEN, hereCopy, sessionPluginDir } from "../plugin-copy.mjs";
import { reachRow, typedReach } from "./on-path.mjs";
import { flowRow } from "./flow-copy.mjs";
import { OK, line, report, under } from "../services/doctor/showing.mjs";

export const copyLines = () => {
  /* Read off the file on PATH and this environment, never off the copy answering (on-path.mjs).
     Then which copy that one runs from here: it changes with the directory and, for the flow's
     verbs, the verb. */
  under("copy");
  const reach = typedReach();
  report([reachRow(reach, process.env.FORGE_PLUGIN_ROOT || sessionPluginDir())]);
  const dispatched = copyToRun();
  const chooser = reach?.version && reach.version !== hereCopy().version
    ? ` — as ${hereCopy().version}'s chooser reads it; ${reach.version} chooses by its own` : "";
  line(OK, "copy a call runs", `${dispatched.kind} ${dispatched.version ?? "?"} at ${dispatched.dir}`
    + ` — ${dispatched.why}${chooser}`);
  line(OK, "copy of the flow", flowRow());
  /* The session's registration: the copy it was started with by path, where it names one. */
  const loaded = sessionPluginDir();
  const gating = copyToRun({ entry: join("hooks", "_hook.mjs"), ...(loaded ? { root: loaded, registered: true } : {}) });
  line(OK, "copy the gates run", `${gating.kind} ${gating.version ?? "?"} at ${gating.dir}`
    + ` — ${gating.why}`);
  /* The two lines above say which copy answers a call; this one says what no call reaches. One reading, spent by the release step and by the gate that holds a write to any of them. */
  line(OK, "restart set", `${FROZEN.join(", ")} — a session keeps these as of its start, whatever `
    + "copy the lines above name");
  return dispatched;
};

