/* Which angles review a consult here, and which level said so: one reading shared by the consult, by
   `forge codex show` and by `forge doctor`, so the line a reader is shown is the list the consult runs. */
import { DEFAULT_ANGLES } from "./codex-api.mjs";
import { configPath, userConfig } from "../resolve/config.mjs";
import { fromProject, projectCodex } from "../resolve/settings.mjs";

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
   learn the angle exists and what adding it takes. */
const debtSaid = ({ angles }) => (angles.includes("debt")
  ? "debt is on"
  : `debt is available and off here: add it to that list, as ${[...angles, "debt"].join(",")}`);

/** The line `show` and `doctor` print, whether the debt angle is among them said on it. */
export const anglesShown = (raw) => {
  const held = anglesInEffect(raw);
  if (!held.angles.length) return `none  ← ${held.from} — a list naming no angle, so a consult here is refused`;
  return `${held.angles.join(", ")}  ← ${held.from} — ${debtSaid(held)}`;
};
