/* The gate a release passed, published for the head it pushed, so a branch cut from that head cites the result instead of invoking a gate of its own (ISS-1101). The whole-scope claim is read here and handed over as a word: the gate's record is a content-keyed `tools/` artefact the plugin may not read, and the ship is the only thing that may say `whole` of a run that was itself scoped. Every field is read off the tree being published for and none off the process's own checkout — sharing a repository is no guarantee of sharing a `.forge.json`, and a publication filed under the invoking project is one the release's own checkout cannot discover. */
import { gitOut } from "../checkout.mjs";
import { greenHeld } from "../gates/carried.mjs";
import { remoteHeadOf, shortly } from "./install.mjs";
import { publishBaseline, publishedSaid } from "../../plugin/src/flow/earned/published.mjs";
import { projectAt } from "../../plugin/src/resolve/settings.mjs";

/** The gate's own command, named once: the step that runs it and the record that says what the result answers for read the same words, and a run citing that record types them back. */
export const CHECK = ["run", "check"];

/* The two things that have to be true of a head before a ship may speak for it, and both are asked because a resume reaches this step without them: `--from` puts the gate back and neither the push nor the clean-tree check.
   The remote holds it, or the commit is one this run made and nobody else has, and publishing it would make one run's own commit the next run's authority — the one thing this record may not be. Pinned by ls-remote rather than off a tracking ref a resume never refreshed; an unreachable remote reads as no answer and publishes nothing, which is the safe direction.
   And nothing is uncommitted, because the reading is taken over the content on disk while the record names HEAD: a dirty tree would certify a committed head from a measurement of different files. The flags are the ones `cleanHead` asks the same question with on the baseline write — untracked files counted, submodules not ignored — so the two halves of this feature agree about what a stampable tree is. */
const CLEAN = ["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"];

const unshippedSays = (tree, base, commit) => {
  const held = remoteHeadOf(tree, base);
  if (!held) return `${base} could not be read off the remote, so nothing says this commit is shipped`;
  if (held !== commit) {
    return `the remote holds ${shortly(held)} for ${base} and this tree is at ${shortly(commit)}`;
  }
  const dirty = gitOut(CLEAN, tree);
  if (dirty === null) return `this tree could not be asked whether anything in it is uncommitted`;
  if (dirty !== "") {
    return `this tree holds uncommitted work, so the gate's reading is of content no commit carries`;
  }
  return null;
};

/** Called from every route that releases a head, the ship and the landing alike, because a rule reading `the ship publishes the baseline for the head it shipped` is incomplete while a second route releases one and publishes nothing. Reports and refuses nothing, as the record's carry does — a record this cannot read is not a release this may stop. `read` is a seam so a case can drive the outcomes a real step table will not produce to order, and the real reader is driven as well, over a repository whose gate ledger is its own. */
export const publishes = (tree, base, version, { say = console.log, read = greenHeld } = {}) => {
  const commit = gitOut(["rev-parse", "HEAD"], tree);
  try {
    const unshipped = unshippedSays(tree, base, commit);
    if (unshipped) return say(`  nothing is published for ${shortly(commit)}: ${unshipped}`);
    const { green, of } = read(tree);
    const whole = of > 0 && green === of;
    return say(`  ${publishedSaid(publishBaseline({
      project: projectAt(tree),
      commit,
      gate: `npm ${CHECK.join(" ")}`,
      scope: whole ? "whole" : `${green} of ${of}`,
      result: whole
        ? `nothing fails: all ${of} gate step(s) green at this commit`
        : `${green} of ${of} gate step(s) green at this commit`,
      version: version ?? null,
    }), commit)}`);
  } catch (error) {
    return say(`  nothing is published for ${shortly(commit)}: the gate's record could not be read (${error.message})`);
  }
};
