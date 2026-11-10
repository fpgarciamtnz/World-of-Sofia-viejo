import { describe, expect, it } from "vitest";
import {
  REGISTRY_POINTER,
  addRegistryPointer,
  buildRegistry,
  normalizeSkill,
  parseRoute,
  parseSkillFrontmatter,
  parseStream,
  rewriteDescription,
  scoreCase
} from "./lib.mjs";

const skill = `---\nname: demo\ndescription: "Say \\"hi\\" when greeted."\ndisable-model-invocation: true\n---\n\n# Demo\n`;

describe("onmax routing eval helpers", () => {
  it("parses quoted descriptions and the user-only flag", () => {
    expect(parseSkillFrontmatter(skill)).toEqual({ name: "demo", description: "Say \"hi\" when greeted.", userOnly: true });
  });

  it("rewrites only the description line", () => {
    const rewritten = rewriteDescription(skill, "Use for: greetings.");
    expect(parseSkillFrontmatter(rewritten).description).toBe("Use for: greetings.");
    expect(rewritten).toContain("disable-model-invocation: true");
    expect(rewritten).toContain("# Demo");
  });

  it("adds the external-skills pointer after the registry pointer", () => {
    const sofia = "intro\nRead [references/skill-registry.md](references/skill-registry.md) when...\n## Planning";
    const lines = addRegistryPointer(sofia).split("\n");
    expect(lines[3]).toBe(REGISTRY_POINTER);
    expect(() => addRegistryPointer("no anchor")).toThrow();
  });

  it("builds registries that differ only in the trigger text", () => {
    const annotations = { areas: { ui: "UI" }, skills: { demo: { area: "ui", flags: ["user-only"], keywords: ["greet", "hello"] } } };
    const upstream = new Map([["demo", { description: "Long description." }]]);
    const template = "src {{SOURCE}}\n{{SKILLS}}";
    const keywords = buildRegistry({ template, annotations, upstream, mode: "keywords", source: "x" });
    const descriptions = buildRegistry({ template, annotations, upstream, mode: "descriptions", source: "x" });
    expect(keywords).toContain("- `demo` (user-only): greet; hello");
    expect(descriptions).toContain("- `demo` (user-only): Long description.");
  });

  it("normalizes skill names and reads the last ROUTE line", () => {
    expect(normalizeSkill("`/anthropic-skills:skill-creator`")).toBe("skill-creator");
    expect(parseRoute("ROUTE: a\nthinking\n**ROUTE:** `emil-color`, /emil-surfaces → repro")).toEqual(["emil-color", "emil-surfaces", "repro"]);
    expect(parseRoute("ROUTE: none")).toEqual([]);
    expect(parseRoute("no line")).toBeNull();
  });

  it("collects Skill calls and scores a case", () => {
    const stream = [
      JSON.stringify({ type: "system", subtype: "init", skills: ["a"] }),
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "sofia-coordinatior" } }] } }),
      JSON.stringify({ type: "result", result: "Plan.\nROUTE: emil-forms-and-inputs, write-like-maxi", total_cost_usd: 0.2, num_turns: 2, is_error: false })
    ].join("\n");
    const parsed = parseStream(stream);
    const score = scoreCase({ must: [["emil-forms-and-inputs"]], forbid: ["write-like-maxi"], maxSkills: 3 }, parsed);
    expect(score.sofiaInvoked).toBe(true);
    expect(score.route).toEqual(["emil-forms-and-inputs", "write-like-maxi"]);
    expect(score.pass).toBe(false);
    expect(score.failures).toEqual(["forbidden: write-like-maxi"]);
    expect(scoreCase({ none: true }, { ...parsed, declared: [], invoked: [] }).pass).toBe(true);
  });
});
