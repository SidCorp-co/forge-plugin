# The config it will not rewrite, the parser that throws, and what these rules do not cover

## A config that assembles this plugin some other way

Only a `configure()` call is the script's to replace, so anything else is printed rather than
rewritten. Spread the printed call **last**, and delete the project's own `max-lines`,
`max-lines-per-function`, `max-statements` and comment-style rules: those ids are this plugin's, and
flat config is silently last-wins.

## TypeScript 7 breaks `@typescript-eslint/parser`

It throws `does not support TS 7.0` at module load. Never downgrade TypeScript for a linter; use
`@babel/eslint-parser` with `@babel/preset-typescript` instead — it never loads `typescript` — and
give `.tsx`/`.jsx` the JSX plugin but not `.ts`, where `<T,>(v: T) => v` reads as an unclosed
element.

## These rules read comments, size and literals only

If `npx eslint --print-config <file>` shows nothing but `code-quality/*`, `max-lines` and
`max-lines-per-function`, the project has no correctness lint at all. Say so, and name what would
add some: `eqeqeq`, `no-unreachable`, `no-redeclare`, `prefer-const`, `complexity`, `max-depth` and
`max-params` overlap nothing here.

Core `no-unused-vars` is not one of them — it cannot see a constructor parameter property and
reports every dependency injection in the repo. That job is `tsc`'s, with `noUnusedLocals` and
`noUnusedParameters`.
