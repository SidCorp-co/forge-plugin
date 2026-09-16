/* What this project left ready, off the checkpoints rather than off git or a branch name, so the verb
   named for what is ready stops asking the caller to already know it. docs/cli/the-checkpoint.md. */
import { stop } from "../../checkout.mjs";
import { asked } from "./member.mjs";
import { ORDER as RUNGS, SIDE } from "../../../plugin/src/flow/earned.mjs";
import { landingOf } from "../../../plugin/src/flow/landing/checkpoint.mjs";
import { everyIssue, shortOf } from "../../../plugin/src/tracker/issues.mjs";
import { scoped } from "../../../plugin/src/tracker/rest.mjs";

/* `sessionContext` is in no list projection, so each candidate costs a get and the set is bounded
   first: a landing still owing its pin has not run its own status step, so the issue stands where the
   build left it. Printed, because a landing past its pin moves the status out of this bound. */
const BAND = [...RUNGS.slice(RUNGS.indexOf("in_progress"), RUNGS.indexOf("closed")), ...SIDE];

const SHORT = (said, self) =>
  `${said}\nSo nothing here knows what this project left ready, and no batch is built on a read that `
  + `came back short. Name the branches this landing is to take:\n    ${self} land-ready ISS-45`;

const NOTHING = (self, seen) =>
  `no checkpoint on this project reads a state this landing would start at the pin from, so there is `
  + `nothing ready to land${seen ? `: the ${seen} above name another turn or another step` : ""}. A `
  + `build writes one where it ends, and a landing past its pin is named rather than found:\n`
  + `    forge claim ISS-45 --pushed --ready\n    ${self} land-ready ISS-45`;

/* Oldest capture first, the order a caller wanting this candidate would have typed; no stamp sorts last. */
const LAST = "￿";
const numbered = (key) => Number(String(key).replace(/\D+/gu, "")) || 0;
const inOrder = (found) => [...found].sort((one, two) =>
  (one.landing.at || LAST).localeCompare(two.landing.at || LAST) || numbered(one.key) - numbered(two.key));

const foundIn = async (rows) => {
  const out = [];
  for (const row of rows) {
    const issue = await asked(() => scoped("forge_issues",
      { action: "get", documentId: row.documentId, fields: [] }));
    const landing = landingOf(issue?.sessionContext ?? null);
    if (landing) out.push({ key: row.issueId, landing });
  }
  return inOrder(out);
};

const shown = (found, taking, self) => {
  console.log(`\nwhat this project left ready, off the checkpoints of every issue at ${BAND.join(", ")}:`);
  for (const one of found) {
    const at = `${one.key}  \`${one.landing.state}\`  ${one.landing.branch || "no branch"}`;
    console.log(taking.includes(one)
      ? `  ${at}  — this landing's, in the order below`
      : `  ${at}  — left out: read where it is, forge resume ${one.key}`);
  }
  if (!taking.length) return;
  console.log(`  in that order, and a different set or order is the caller's to type:\n`
    + `    ${self} land-ready ${taking.map((one) => one.key).join(" ")}`);
};

/** The keys an empty call takes, said before anything is spent; `startsAtPin` is the take's own reading. */
export const readyKeys = async (ctx, startsAtPin) => {
  const read = await asked(() => everyIssue({}));
  const short = shortOf(read, "The set of issues a landing could take");
  if (short) stop(SHORT(short, ctx.self));
  const found = await foundIn(read.rows.filter((row) => BAND.includes(String(row.status ?? ""))));
  const taking = found.filter((one) => startsAtPin(one.landing));
  if (found.length) shown(found, taking, ctx.self);
  if (!taking.length) stop(NOTHING(ctx.self, found.length));
  return taking.map((one) => one.key);
};
