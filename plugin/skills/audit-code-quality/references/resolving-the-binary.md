# When the command does not resolve

`npm error 404 ... is not in this registry` means npx reached the registry, where this package is
not published. Two different causes, and neither is fixed by installing:

- the plugin is installed *below* here, not here. Borrow the binary and keep the root as the working directory.
- the plugin is installed right here, but this binary postdates the last install: `node_modules/.bin` is written at install time, so a bin added by a later version of the package is absent from it while the package's own `bin/` has it.

```sh
find . -path "*/node_modules/.bin/code-quality-gate" -not -path "*/worktrees/*" | head  # borrow one
ls node_modules/eslint-plugin-code-quality/bin/                                       # or run it by path
node node_modules/eslint-plugin-code-quality/bin/code-quality-gate.mjs
```

Never install anything to make the command resolve — running the file by path needs no install and
no rebuild, because nothing here is compiled. Use `eslint <paths>` through the same resolution when
the user named a scope, or when warnings matter because the project adopted a rule at `warn`.
