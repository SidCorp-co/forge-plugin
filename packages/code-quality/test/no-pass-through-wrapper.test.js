import { RuleTester } from "eslint";
import test from "node:test";
import rule from "../src/rules/no-pass-through-wrapper.js";

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

test("a named layer that only forwards is reported; a callback is not a layer", () => {
  tester.run("no-pass-through-wrapper", rule, {
    valid: [
      // An inline callback cannot be shortened to its callee: `map` would pass the
      // index on as a second argument.
      "const paths = roots.map((root) => path.resolve(root));",
      "const any = names.some((name) => list.includes(name));",
      // Anything the wrapper adds makes it a layer that earns its keep.
      "function getUser(id) { return repo.findById(id, { withRoles: true }); }",
      "function getUser(id) { return repo.findById(String(id)); }",
      "function swap(a, b) { return call(b, a); }",
      "function withDefault(id = 1) { return repo.findById(id); }",
      "function unpack({ id }) { return repo.findById(id); }",
      "function getUser(id) { log(id); return repo.findById(id); }",
      "function getUser(id) { return repo?.findById(id); }",
      "const has = (key) => key in map;",
      // A BUILT receiver is work the wrapper does for every caller, and leaves no name
      // to offer: reporting these named `max` and `encode`, neither of which is in scope.
      "const trimmedText = (max) => z.string().trim().max(max);",
      "const bytes = (text) => new TextEncoder().encode(text);",
      "const run = (x) => getHandler().call(x);",
      "const at = (x) => list[next()].run(x);",
      {
        code: "// pass-through: keep — the port the adapter is named for\nfunction getUser(id) { return repo.findById(id); }",
      },
    ],
    invalid: [
      // A path that runs nothing is nameable however it is spelled, and the report quotes
      // it verbatim, so a computed step does not cost the finding.
      {
        code: "const run = (x) => handlers[0].call(x);",
        errors: [
          {
            message:
              "run only forwards to handlers[0].call. Call handlers[0].call directly and " +
              "delete the wrapper.",
          },
        ],
      },
      {
        code: "const run = (x) => handlers[kind].call(x);",
        errors: [
          {
            message:
              "run only forwards to handlers[kind].call. Call handlers[kind].call directly " +
              "and delete the wrapper.",
          },
        ],
      },
      {
        code: "export function getUser(id) { return userRepository.findById(id); }",
        errors: [
          {
            message:
              "getUser only forwards to userRepository.findById. Call userRepository.findById " +
              "directly and delete the wrapper.",
          },
        ],
      },
      {
        code: "const getUser = (id) => repo.findById(id);",
        errors: [{ messageId: "passThroughFunction" }],
      },
      {
        code: "async function getUser(id) { return await repo.findById(id); }",
        errors: [{ messageId: "passThroughFunction" }],
      },
      {
        code: "function forward(...args) { return target(...args); }",
        errors: [{ messageId: "passThroughFunction" }],
      },
      {
        code: "const service = { getUser(id) { return repo.findById(id); } };",
        errors: [{ messageId: "passThroughFunction" }],
      },
    ],
  });
});

test("a component that only spreads its props is an alias for the one it renders", () => {
  tester.run("no-pass-through-wrapper", rule, {
    valid: [
      "const PrimaryButton = (props) => <Button variant=\"primary\" {...props} />;",
      "const Wrapper = (props) => <Button {...props}>{props.children}</Button>;",
      "const Fixed = () => <Button variant=\"primary\" />;",
      "const Renamed = ({ label, ...rest }) => <Button {...rest} />;",
      {
        code: "// pass-through: keep — the design system's public name for it\nconst Button = (props) => <BaseButton {...props} />;",
      },
    ],
    invalid: [
      {
        code: "const PrimaryButton = (props) => <Button {...props} />;",
        errors: [
          {
            message:
              "PrimaryButton only renders <Button> with its own props. Use Button directly and " +
              "delete the wrapper.",
          },
        ],
      },
      {
        code: "function Card(props) { return <Panel {...props} />; }",
        errors: [{ messageId: "passThroughComponent" }],
      },
    ],
  });
});

test("a neutral element carrying nothing but one child is deleted, not the semantic ones", () => {
  tester.run("no-pass-through-wrapper", rule, {
    valid: [
      '<div className="grid gap-4"><UserCard /></div>',
      "<div><UserCard /><UserCard /></div>",
      "<div>{items}</div>",
      "<div>text</div>",
      // A tag that means something to the document is not carrying nothing.
      "<section><UserCard /></section>",
      "<li><UserCard /></li>",
      { code: "<div>{/* pass-through: keep — the grid's row box */}<UserCard /></div>" },
      { code: "<article><UserCard /></article>", options: [{ elements: false }] },
      { code: "<div><UserCard /></div>", options: [{ elements: false }] },
    ],
    invalid: [
      {
        code: "<div><UserCard user={u} /></div>",
        errors: [
          {
            message:
              "<div> wraps a single child and carries nothing of its own. Delete it and keep the child.",
          },
        ],
      },
      {
        code: "<span>\n  <Icon />\n</span>",
        errors: [{ messageId: "emptyWrapper" }],
      },
      {
        code: "<article><UserCard /></article>",
        options: [{ neutralElements: ["article"] }],
        errors: [{ messageId: "emptyWrapper" }],
      },
    ],
  });
});

test("each shape can be switched off, and a file can be exempt", () => {
  tester.run("no-pass-through-wrapper", rule, {
    valid: [
      { code: "function getUser(id) { return repo.findById(id); }", options: [{ functions: false }] },
      {
        code: "const P = (props) => <Button {...props} />;",
        options: [{ components: false }],
      },
      {
        code: "function getUser(id) { return repo.findById(id); }",
        filename: "src/legacy/adapter.ts",
        options: [{ exemptFiles: ["src/legacy/**"] }],
      },
    ],
    invalid: [
      // Switching off components leaves the function half on, and the reverse.
      {
        code: "function getUser(id) { return repo.findById(id); }",
        options: [{ components: false }],
        errors: [{ messageId: "passThroughFunction" }],
      },
    ],
  });
});

test("a thunk defers a call rather than forwarding one", () => {
  tester.run("no-pass-through-wrapper", rule, {
    // `budget.abort` unbound is not `() => budget.abort()`: the receiver is lost,
    // so there is nothing to delete the wrapper in favour of.
    valid: [
      "const onStop = () => budget.abort();",
      "function reset() { return store.clear(); }",
    ],
    invalid: [],
  });
});
