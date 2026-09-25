/* The ship's half of the answer plugin/test/stats/runs/worktree.test.mjs pins for the stats reader: a
   worktree beside the checkout is read back to the checkout, not to itself (ISS-2094). The layout is
   written by hand, as git writes it, so no `git worktree add` is spent. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { checkoutRoot } from "../checkout.mjs";
import { tempRoom } from "../../plugin/test/fixtures.mjs";

test("the ship's checkout of a linked worktree is the checkout its commondir names", () => {
  const room = realpathSync(tempRoom("checkout-root-"));
  const checkout = join(room, "checkout");
  const tree = join(room, "wt-checkout-ISS-1");
  const admin = join(checkout, ".git", "worktrees", "wt-checkout-ISS-1");
  mkdirSync(admin, { recursive: true });
  writeFileSync(join(checkout, ".git", "HEAD"), "ref: refs/heads/master\n");
  writeFileSync(join(admin, "HEAD"), "ref: refs/heads/iss-1\n");
  writeFileSync(join(admin, "commondir"), "../..\n");
  mkdirSync(tree);
  writeFileSync(join(tree, ".git"), `gitdir: ${admin}\n`);

  assert.equal(checkoutRoot(tree), checkout);
  assert.equal(checkoutRoot(checkout), checkout, "and the checkout itself answers for itself");
});
