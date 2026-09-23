/* A wave read off its headline's page: the dispatch records after the latest fold, or that fold and
   the dispatches it closed. Its lines, the live read of its members and the fold's refusal are here
   too, so the screen and the write that ends a wave read one reading. It writes nothing: `resume`
   imports it and spends one issue read per member. docs/cli/resume.md, ISS-818. */
import { SHAPES, atMinute } from "../machine.mjs";
import { parseAll } from "./page.mjs";
import { NO_LONGER_OWES } from "../earned/park-status.mjs";
import { FIELD, leaseOf, stateOf } from "../lease.mjs";
import { sessionSourced } from "../../resolve/config.mjs";
import { documentIdIfAny } from "../../tracker/issues.mjs";
import { scoped } from "../../tracker/rest.mjs";

const DISPATCH = "wave";
const FOLD = Object.keys(SHAPES).find((kind) => SHAPES[kind].closes === DISPATCH);

const dispatchOf = ({ at, record }) => ({
  at: atMinute(at),
  role: record.fields.role ?? null,
  session: record.fields.session ?? null,
  tree: record.fields.tree ?? null,
  members: record.fields.member ?? [],
});

/** Every wave the page holds, oldest first: a fold closes the dispatches written since the fold
 *  before it, and dispatches after the last fold are the one open wave. Ordered by the stamp the
 *  assembly sorts by, so a fold reads as after the dispatches it followed. Each dispatch and fold
 *  also carries its raw `stamp`, which a reading across waves measures spans by. */
export const wavesOf = (comments) => {
  const held = comments
    .flatMap((one) => parseAll(one.body ?? "").map((record) => ({ at: String(one.createdAt ?? ""), record })))
    .filter((one) => one.record.kind === DISPATCH || one.record.kind === FOLD)
    .sort((a, b) => a.at.localeCompare(b.at));
  const waves = [];
  let since = [];
  for (const one of held) {
    if (one.record.kind === DISPATCH) {
      since.push({ ...dispatchOf(one), stamp: one.at });
      continue;
    }
    waves.push({
      state: "folded",
      dispatches: since,
      fold: { at: atMinute(one.at), summary: one.record.fields.summary ?? "", runs: since.length, stamp: one.at },
    });
    since = [];
  }
  if (since.length) waves.push({ state: "open", dispatches: since });
  return waves;
};

const unstamped = (one) => Object.fromEntries(Object.entries(one).filter(([key]) => key !== "stamp"));

/** The latest of those, as `forge resume` prints it, or null where the page holds neither kind. */
export const waveOf = (comments) => {
  const last = wavesOf(comments).at(-1);
  if (!last) return null;
  if (last.state === "open") return { state: "open", dispatches: last.dispatches.map(unstamped) };
  return { state: "folded", fold: unstamped(last.fold) };
};

/* Softly, so a member the tracker will not answer for is a line carrying its words rather than a
   resume that exits on the first of them. */
export const readMember = async (key) => {
  const found = await documentIdIfAny(key, { soft: true });
  if (found.refused) return { refused: String(found.refused) };
  const body = await scoped("forge_issues", { action: "get", documentId: found.id }, true);
  return body?.refused ? { refused: String(body.refused) } : { body };
};

const memberNow = async (key, read, mine) => {
  const got = await read(key);
  if (got.refused) return { key, unreadable: got.refused };
  const lease = leaseOf(got.body?.[FIELD]);
  return {
    key,
    status: String(got.body?.status ?? "unknown"),
    holder: lease?.holder ?? null,
    lease: stateOf(lease, mine),
  };
};

/** The open wave with every member read now, one read per issue however many dispatches name it; a folded wave reads nothing. `read` is the tracker unless a caller hands another. */
export const waveLive = async (wave, read = readMember) => {
  if (wave?.state !== "open") return wave;
  const mine = sessionSourced().id;
  const keys = [...new Set(wave.dispatches.flatMap((one) => one.members))];
  const now = new Map();
  for (const key of keys) now.set(key, await memberNow(key, read, mine));
  const dispatches = wave.dispatches.map((one) => {
    const members = one.members.map((key) => now.get(key));
    return { ...one, members, complete: members.every((two) => NO_LONGER_OWES.includes(two.status)) };
  });
  return { ...wave, dispatches, runs: dispatches.length, issues: keys.length };
};

const foldForm = (ref) => `forge record fold ${ref} --summary "<the fold's line>"`;

const memberLine = (one) => {
  if (one.unreadable) return `${one.key}  unreadable: ${one.unreadable}`;
  const held = one.holder ? `leased by ${one.holder}, ${one.lease}` : "no lease";
  return `${one.key}  ${one.status}  ${held}`;
};

const dispatchLines = (one, at) => [
  `dispatch ${at + 1}, ${one.at}: ${one.role}, session ${one.session}${one.tree ? `, tree ${one.tree}` : ", no tree"}`,
  ...one.members.map((two) => `  ${memberLine(two)}`),
  one.complete
    ? `  complete: every member is at ${NO_LONGER_OWES.join(" or ")}`
    : `  not complete: ${one.members.filter((two) => !NO_LONGER_OWES.includes(two.status)).map((two) => two.key).join(", ")} still owed`,
];

/** The block `resume` prints under its header, from what `waveLive` returned. */
export const waveLines = (wave, ref) => {
  if (!wave) return [];
  if (wave.state === "folded") {
    return [`folded ${wave.fold.at}, closing ${wave.fold.runs} run(s): ${wave.fold.summary}`];
  }
  return [
    `open: ${wave.dispatches.length} dispatch(es), ${wave.runs} run(s), ${wave.issues} member issue(s)`,
    ...wave.dispatches.flatMap(dispatchLines),
    `the fold is owed, written once its reporting and its cost count are posted:`,
    `  ${foldForm(ref)}`,
  ];
};

/** Why a fold would close nothing, or null. A cut page may hold the dispatch past where it stops, so that is said rather than a fold refused for a wave it could not see. */
export const foldProblem = (kind, ref, { comments, cut }) => {
  if (!SHAPES[kind]?.closes) return null;
  if (waveOf(comments)?.state === "open") return null;
  if (cut) {
    return `record ${kind}: ${ref}'s page is cut, and no dispatch after a fold is on the part that was read. ${cut} `
      + "A fold closes the dispatches written after the last fold, so nothing was sent.";
  }
  return `record ${kind}: ${ref} holds no ${DISPATCH} record after its latest ${FOLD}, so this fold would `
    + `close nothing. Nothing was sent. What the headline holds:\n  forge resume ${ref}`;
};
