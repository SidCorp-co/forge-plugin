import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { findInlineWarningGaps } from "../src/inline-warning.js";
import { tempRoom } from "./fixtures/room.js";

const WIRED = `export function Wired({ error, id }) {
  return (<div><input id={id} aria-invalid={!!error} aria-describedby={id} />
    <p role="alert">{error}</p></div>);
}`;

const FORWARDING = `export function Forwarding({ id, ...rest }) {
  return <input id={id} {...rest} />;
}`;

const CLOSED = `export function Closed({ value, onChange }) {
  return <input value={value} onChange={onChange} />;
}`;

const ACTION = `export function Action({ onGo }) {
  return <button type="button" onClick={onGo}>Go</button>;
}`;

function project(files) {
  const root = tempRoom("inline warning ");
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

const names = (entries) => entries.map((entry) => entry.component).sort();

test("a control that wires or forwards its error passes; a closed one fails", () => {
  const root = project({
    "src/components/ui/forms/wired.tsx": WIRED,
    "src/components/ui/forms/forwarding.tsx": FORWARDING,
    "src/components/ui/forms/closed.tsx": CLOSED,
  });
  const { controlCount, violations } = findInlineWarningGaps({ roots: [root] });
  assert.equal(controlCount, 3);
  assert.deepEqual(names(violations), ["Closed"]);
});

test("a bare button is an action, not a control", () => {
  const root = project({ "src/components/ui/action.tsx": ACTION });
  assert.equal(findInlineWarningGaps({ roots: [root] }).controlCount, 0);
});

test("a waiver needs a stated reason", () => {
  const reason = "a search box carries no validation state.";
  const withReason = project({ "src/ui/forms/a.tsx": `// inline-warning: none — ${reason}\n${CLOSED}` });
  const bare = project({ "src/ui/forms/a.tsx": `// inline-warning: none\n${CLOSED}` });

  const waived = findInlineWarningGaps({ roots: [withReason] });
  assert.equal(waived.violations.length, 0);
  assert.equal(waived.waivers[0].reason, reason);

  const rejected = findInlineWarningGaps({ roots: [bare] });
  assert.deepEqual(names(rejected.violations), ["Closed"]);
  assert.equal(rejected.waivers.length, 0);
});

test("discovery finds ui, primitives, and forms layouts and skips feature screens", () => {
  const root = project({
    "src/components/ui/forms/a.tsx": CLOSED,
    "packages/design/primitives/b.tsx": CLOSED,
    "app/dashboard/screen.tsx": CLOSED,
  });
  assert.equal(findInlineWarningGaps({ roots: [root] }).files.length, 2);
  assert.equal(findInlineWarningGaps({ roots: [root], all: true }).files.length, 3);
});

test("a worktree is never scanned, by walk or by an explicit root", () => {
  const root = project({
    "src/components/ui/forms/a.tsx": WIRED,
    ".claude/worktrees/agent-1/src/components/ui/forms/b.tsx": CLOSED,
    "worktrees/agent-2/src/components/ui/forms/c.tsx": CLOSED,
  });
  assert.equal(findInlineWarningGaps({ roots: [root] }).files.length, 1);

  for (const inside of [".claude/worktrees", "worktrees"]) {
    const result = findInlineWarningGaps({ roots: [path.join(root, inside)] });
    assert.deepEqual(result.files, [], `reached a worktree via ${inside}`);
  }
});
