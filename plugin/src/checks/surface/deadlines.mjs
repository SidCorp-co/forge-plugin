/* The host kills a hook at the timeout hooks.json registers, and every gate's answer dies with the
   process, so each event's own clock has to end first. Checked for the pre and post clocks alone while
   stop and ask ran unchecked beside them; read here off hook-switch's own parse, so a clock added to
   the line is checked by being registered. */
import { DEADLINES, registrationsIn } from "../../hooks/hook-switch.mjs";

/** Each registration whose clock would outlive what the host gives it, as the message a developer reads. */
export const deadlineProblems = (registered, deadlines = DEADLINES) =>
  registrationsIn(registered).flatMap(({ event, clock, timeout }) => {
    if (clock === null) return [];
    if (!Number.isFinite(timeout)) {
      return [`${event} runs the ${clock} clock with no timeout registered — give it a \`timeout\` in hooks.json`
        + ` above ${deadlines[clock] / 1000}s, the ${clock} deadline`];
    }
    if (deadlines[clock] < timeout * 1000) return [];
    return [`${event} registers ${timeout}s and the ${clock} deadline is ${deadlines[clock] / 1000}s — lower`
      + ` DEADLINES.${clock} in plugin/src/hooks/hook-switch.mjs under ${timeout}s, or raise the timeout,`
      + " so the gates answer before the host kills them"];
  });
