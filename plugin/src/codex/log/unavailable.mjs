/* What became of one file's consult, read one way by the plan and criteria writes, so a reviewer that
   could not answer and a consult nobody asked for are told apart in the same words. The caller finds
   its own rows — keyed on a file's real path — and hands them here for the judgement.
   docs/cli/codex-the-unavailable.md. */
import { isAnswered } from "../codex-log.mjs";

export const FAILED = "failed";
export const NO_GATEWAY = "no-gateway";
const UNASKED = "unasked";

export const NO_GATEWAY_REASON = "no codex gateway is configured on this machine";
export const STOOD_DOWN_REASON = "the check was stood down by FORGE_CODEX_DISABLE=1";

/** A consult row the gateway did not give: a consult that ended, and ended with no answer. A start
 *  with no end is a consult that died, which is no word from the gateway at all. */
export const gatewayFailed = (one) => one?.kind === "consult" && !isAnswered(one);

/** A failed row's reason: its HTTP status where the row carries one, and otherwise the error's first
 *  line — a timeout and a refused connection reach no status to name. */
const failedReason = (one) => {
  const said = Number.isInteger(one.status) ? one.status : String(one.error ?? "no error recorded").split("\n")[0];
  return `gateway unavailable (${said})${one.id ? `, consult ${one.id}` : ""}`;
};

/** The state of one file no consult read, each caller having asked that of its own key first: `failed`
 *  is the newest row that carried the file at the bytes it holds now and got nothing back; `gateway`
 *  is whether one is configured. With no gateway no consult can be asked for, so no file there is
 *  unasked. */
export const consultState = ({ failed, gateway }) => {
  if (!gateway) return { state: NO_GATEWAY, reason: NO_GATEWAY_REASON };
  if (failed) return { state: FAILED, reason: failedReason(failed) };
  return { state: UNASKED, reason: null };
};

/** Whether a state lets its file through unread under the project's `codex.consult`. */
export const passesUnread = (state, consult) => consult === "advisory" && (state === FAILED || state === NO_GATEWAY);

/** The route a refusal names where the gateway, not the agent, is why nothing read a file. */
export const ADVISORY_ROUTE = "`forge doctor --set codex.consult=advisory` is the project's way to let an "
  + "unavailable gateway hold nothing: what goes through then says no consult read it.";
