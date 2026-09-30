/* A write through a name the command never spells reached no gate and said nothing, so a session that
   wrote through a loop variable and one that wrote nothing read the same (ISS-450). What is named is the
   spelling the shell wrote the file through, and only where the shell would expand it there: a notice
   claiming a write that did not happen sends a run after a file that does not exist. */
import assert from "node:assert/strict";
import test from "node:test";

import { unseenWrites } from "../../hooks/_hook.mjs";

test("a write through a binding, a substitution, a pattern or a handed name is named by the spelling it went through", () => {
  const cases = [
    ['for f in plugin/src/*.mjs; do sed -i s/x/y/ "$f"; done', ['"$f"']],
    ["echo x > $OUT/a.md", ["$OUT/a.md"]],
    ["D=$(mktemp -d); echo x > $D/a.md", ["$(mktemp -d)/a.md"]],
    ["echo x > log-$(date +%s).txt", ["log-$(date +%s).txt"]],
    ["bash -c 'echo x > $f'", ["$f"]],
    ["sed -i s/a/b/ src/*.mjs", ["src/*.mjs"]],
    ["cp x.md{,.bak}", ["x.md{,.bak}"]],
    ['cp a.md "$dest"', ['"$dest"']],
    ['curl -s -o "$out" https://example.test/a', ['"$out"']],
    ['wget -q -o "$log" https://example.test/a', ['"$log"']],
    ['curl -s -D "$headers" https://example.test/a', ['"$headers"']],
    ["grep -rl x . | xargs sed -i s/a/b/", ["xargs"]],
    ["find . -name '*.mjs' -exec sed -i s/a/b/ {} +", ["-exec"]],
  ];
  for (const [command, named] of cases) assert.deepEqual(unseenWrites(command), named, command);
});

test("a `$` the shell would not expand where a write lands, or one where no write lands, names nothing", () => {
  const cases = [
    "F=a.md; echo x > $F",
    "echo x > '$F'",
    String.raw`echo x > \$HOME/a.md`,
    'git commit -m "raise a > $b"',
    '[[ "$a" > "$b" ]] && echo y',
    "if [[ $x > $y ]]; then :; fi",
    "(( x > $y )) && echo y",
    "echo $(( n > $y ))",
    "echo ok # > $b",
    'ssh host "echo x > $f"',
    'sed -i "s/$a/b/" f.md',
    'sed -i -e "s/$a/b/" f.md',
    'sed "s/$a/b/" -i f.md',
    'curl -H "Authorization: $T" -o out.json https://example.test/a',
    'cp "$src" dest.md',
    "cmd 2>/dev/null > /dev/null",
    "python3 -c 'import sys; open(sys.argv[1], \"w\")' out.txt",
  ];
  for (const command of cases) assert.deepEqual(unseenWrites(command), [], command);
});

/* A stage a list or a pipe cut opens with the blank after its operator, which the write reading took for
   no command at all, so only the first write of a list was ever named (ISS-2933). */
test("a write in any stage of a list or a pipe is named as the same write standing alone is", () => {
  for (const command of ["tee $D/a.md", "echo x | tee $D/a.md", "true && tee $D/a.md", "true; tee $D/a.md", "false || tee $D/a.md"]) {
    assert.deepEqual(unseenWrites(command), ["$D/a.md"], command);
  }
  assert.deepEqual(unseenWrites("true && cp a $D/b.md"), ["$D/b.md"], "and a copy's source is no name it wrote through");
});
