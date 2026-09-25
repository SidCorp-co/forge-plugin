/* Every rule here is asked a second time, of the stored plan rather than the file, and over the
   criteria field the write cannot see: a plan that arrived by any route answers to the same shape,
   and a number it cites is weighed against the criteria only the issue holds. */
import { criteriaUncovered, declarationLine, declarationsMissing, need, planSteps, planTyped, sectionsOwed, stepsUncited, witnessedAnswers, witnessedOn } from "../machine.mjs";

/* Which lines are owed is the table's, read by the write as well, and every missing one is named at
   once: a plan answering some is told which it lacks rather than that it declares none (ISS-312,
   ISS-752). */
const declarationsOwed = (flags, ref) => {
  const missing = declarationsMissing(flags).map((key) => `\`${declarationLine(key)}\``);
  if (!missing.length) return [];
  const listed = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} or ${missing.at(-1)}`;
  return [need(
    `the plan does not declare ${listed}, ${missing.length === 1 ? "which decides" : "each deciding"} what the plan and the ship steps owe`,
    `forge record plan ${ref} <plan.md>, with ${missing.length === 1 ? "that line" : "those lines"} under \`## Declarations\``,
  )];
};

/** Every shortfall of a plan's shape at `approved`; `asks` is false where the rung waives the plan. */
export const planShapeOwed = (asks, plan, flags, criteria, ref) => {
  const out = asks && plan ? declarationsOwed(flags, ref) : [];
  if (asks && plan && !planTyped(plan)) {
    out.push(need(
      `the plan is untyped — it carries none of the sections a typed plan owes: ${sectionsOwed(plan, flags).join(" · ")}`,
      `forge record plan ${ref} <plan.md>, each section opened by a heading whose text is its name`,
    ));
  } else if (asks && plan) {
    const owed = sectionsOwed(plan, flags);
    if (owed.length) {
      out.push(need(
        `the plan carries no ${owed.length === 1 ? "section" : "sections"} ${owed.map((name) => `\`## ${name}\``).join(", ")}`,
        `forge record plan ${ref} <plan.md>, with each in it`,
      ));
    }
    const steps = planSteps(plan);
    const bare = criteriaUncovered(steps, criteria);
    if (bare.length) {
      out.push(need(
        `no plan step names criterion ${bare.join(", ")}, so nothing the plan does serves ${bare.length === 1 ? "it" : "them"}`,
        `forge record plan ${ref} <plan.md>, with a step naming each as \`criteria: ${bare[0]}\``,
      ));
    }
    const uncited = stepsUncited(steps, criteria);
    if (uncited.length) {
      const named = uncited.map((one) => (one.cites.length ? `${one.number} (citing ${one.cites.join(", ")})` : `${one.number}`));
      out.push(need(
        `plan step ${named.join(", ")} ${uncited.length === 1 ? "serves" : "serve"} no criterion this issue holds, `
          + `so no verdict reaches what ${uncited.length === 1 ? "it does" : "they do"}`,
        `forge record plan ${ref} <plan.md>, with \`criteria: <n>\` on each, from ${criteria.map((one) => one.number).join(", ")}`,
      ));
    }
    /* The plan's other set of criterion numbers: a witnessed set pointing at nothing asks a person to
       look at nothing, and a section answering no way at all or both ways says nothing about whether
       one is owed — which the write refuses too, and a plan edited on the tracker never met. */
    const witnessed = witnessedOn(plan);
    const answers = witnessedAnswers(witnessed);
    if (witnessed && answers.length !== 1) {
      out.push(need(
        `\`## Witnessed on screen\` ${answers.length ? `cites criterion ${witnessed.cites.join(", ")} and says \`none\` as well` : "answers neither way"}, `
          + "so nothing there says whether a person at the running product is owed a look",
        `forge record plan ${ref} <plan.md>, that section citing what only a person there can witness or saying \`none\``,
      ));
    }
    const held = new Set(criteria.map((one) => one.number));
    const adrift = (witnessed?.cites ?? []).filter((number) => !held.has(number));
    if (adrift.length) {
      out.push(need(
        `\`## Witnessed on screen\` cites criterion ${adrift.join(", ")}, which this issue does not hold, `
          + "so what a person is asked to witness resolves to nothing",
        `forge record plan ${ref} <plan.md>, citing under that heading from ${[...held].join(", ")}`,
      ));
    }
  }
  return out;
};
