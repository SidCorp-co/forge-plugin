/* Reading the parks on an issue's page: the newest well-formed park in a window, the one that set a
   side status, and whether a person has answered it since. Apart from earned.mjs because none of it
   reads the flow's order, which is what lets that file's readers of the claim history ask it too. */
import { unwrap } from "../machine.mjs";
import { parse } from "../record/page.mjs";
import { PARK_STATUS, sameLanding } from "../earned/park-status.mjs";
import { shapeGaps } from "../earned/shape-gaps.mjs";

export const parkRecord = (view, wanted = () => true, since = null, until = null) => {
  const found = view.comments
    .filter((one) => (!since || (one.createdAt ?? "") > since) && (!until || (one.createdAt ?? "") < until))
    .map((one) => ({ comment: one, record: parse(one.body ?? "") }))
    .filter((one) => one.record?.kind === "park" && wanted(one.record.fields.kind))
    .filter((one) => !shapeGaps("park", one.record, view.names).length);
  return found.length ? found.at(-1) : null;
};

export const SILENT = "on_hold";
const ANNOUNCED = /—\s*moved from `[a-z_]+`$/u;
const announces = (one) => ANNOUNCED.test(unwrap(one.body).split("\n")[0]?.trim() ?? "");
const announcements = (view) => view.comments.filter(announces);
export const announcedAt = (view) => announcements(view).at(-1)?.createdAt ?? null;

/* The park that set a side status, not the newest of a kind, and the two orders one may be written
   in — docs/cli/advance-what-it-sends.md. `on_hold` announces nothing, as it did (ISS-420). */
export const parkThatSet = (view, status) => {
  const wanted = (one) => sameLanding(PARK_STATUS[one], status);
  if (status === SILENT) return parkRecord(view, wanted);
  const said = announcements(view);
  if (!said.length) return null;
  const last = said.at(-1);
  const under = parkRecord(view, wanted, last.createdAt ?? null);
  if (under) return under;
  const prior = said.at(-2) ?? null;
  const over = parkRecord(view, wanted, prior?.createdAt ?? null, last.createdAt);
  const spent = over && prior && view.comments[view.comments.indexOf(prior) + 1] === over.comment;
  return spent ? null : over;
};

/** Whether an `answer` record newer than `at` stands on the page, judged by the write's own shape
 *  rules. Both readers of a park ask it, so the resume and the look cannot disagree about one. */
export const relayedSince = (view, at) => view.comments.some((one) => {
  if ((one.createdAt ?? "") <= at) return false;
  const record = parse(one.body ?? "");
  return record?.kind === "answer" && !shapeGaps("answer", record, view.names).length;
});

/* A screen is the change a deploy does not undo for whoever already read it, so a person answers: a
   comment later than the park, from a token that is neither a device's nor the tracker's own, or
   their answer relayed on the record. */
export const answered = (view, kind) => {
  const asked = parkRecord(view, (one) => one === kind);
  const at = asked?.comment?.createdAt ?? "";
  return Boolean(asked) && (relayedSince(view, at) || view.comments.some(
    (one) => !one.authorDeviceId && !announces(one) && (one.createdAt ?? "") > at,
  ));
};
