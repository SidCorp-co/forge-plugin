/* The waits and the baseline the gate does not take are refused as any unknown flag is, before a record is written, so
   nothing reads them as a gate that ran. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, rmSync } from "node:fs";

import { TERMINAL, verdictRuns } from "../../gates/verdict.mjs";
import { run, runsFile, scratch } from "./scratch.mjs";

test("--baseline, --wait and --wait slot are refused as flags the gate does not take, and run nothing", () => {
  const { at, work } = scratch("gone-flags");
  try {
    for (const argv of [["--baseline"], ["--baseline", "ISS-7"], ["--wait"], ["--wait", "5"], ["--wait", "slot"],
      ["--wait", "slot", "5"], ["--full", "--wait"]]) {
      const said = run(work, argv);
      const named = argv.filter((one) => one !== "--full").join(" ");
      assert.equal(said.status, 1, `${argv.join(" ")}: ${said.stdout}${said.stderr}`);
      assert.ok(said.stderr.startsWith(`No such option: ${named}\n`), `${argv.join(" ")}: ${said.stderr}`);
      assert.ok(!said.stdout.includes(TERMINAL), `${argv.join(" ")} ran a gate:\n${said.stdout}`);
    }
    assert.equal(verdictRuns(work), null, "a refused flag wrote a gate's record");
    assert.ok(!existsSync(runsFile(work)), "a refused flag ran the gate");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
