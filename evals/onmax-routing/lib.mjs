import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const evalRoot = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(evalRoot, "../..");
export const cacheRoot = path.join(evalRoot, ".cache");
export const upstreamDir = path.join(cacheRoot, "onmax-skills");

// Each variant changes one thing Sofia can see: what her external-skills reference holds,
// and what the always-loaded skill listing holds for the onmax skills.
export const VARIANTS = {
  baseline: { registry: null, listing: "upstream", note: "Sofia as she is; onmax skills installed with upstream descriptions." },
  "registry-descriptions": { registry: "descriptions", listing: "upstream", note: "Sofia reads a reference with every upstream description." },
  "registry-keywords": { registry: "keywords", listing: "upstream", note: "Sofia reads a reference with keywords instead of descriptions." },
  "all-keywords": { registry: "keywords", listing: "keywords", note: "Keyword reference, and the onmax skills themselves list keywords instead of descriptions." }
};

export const SOFIA = "sofia-coordinatior";
const REGISTRY_ANCHOR = "Read [references/skill-registry.md](references/skill-registry.md)";
export const REGISTRY_POINTER =
  "Read [references/external-skills.md](references/external-skills.md) when the task may belong to an installed skill outside the Sofia family, or when one of those skills overlaps a specialist.";

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

/** Reads the frontmatter fields this eval needs. Every upstream description fits on one line. */
export function parseSkillFrontmatter(markdown) {
  const block = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) {
    return null;
  }
  const fields = {};
  for (const line of block[1].split(/\r?\n/)) {
    const match = line.match(/^([a-z-]+):\s*(.*)$/);
    if (match) {
      fields[match[1]] = unquote(match[2]);
    }
  }
  return {
    name: fields.name,
    description: fields.description ?? "",
    userOnly: fields["disable-model-invocation"] === "true"
  };
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return JSON.parse(trimmed);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

/** Replaces the one-line description in a SKILL.md frontmatter. */
export function rewriteDescription(markdown, description) {
  const block = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block || !/^description:/m.test(block[1])) {
    throw new Error("SKILL.md has no frontmatter description to rewrite.");
  }
  const rewritten = block[1].replace(/^description:.*$/m, `description: ${JSON.stringify(description)}`);
  return markdown.replace(block[1], () => rewritten);
}

export function keywordDescription(keywords) {
  return `Use for: ${keywords.join("; ")}.`;
}

export function addRegistryPointer(sofiaSkill) {
  const lines = sofiaSkill.split("\n");
  const index = lines.findIndex((line) => line.startsWith(REGISTRY_ANCHOR));
  if (index === -1) {
    throw new Error(`Could not find the registry pointer in ${SOFIA}/SKILL.md; update REGISTRY_ANCHOR.`);
  }
  lines.splice(index + 1, 0, "", REGISTRY_POINTER);
  return lines.join("\n");
}

/**
 * Builds Sofia's external-skills reference. Both modes share every line except the
 * per-skill trigger text, so a difference in results comes from that text alone.
 */
export function buildRegistry({ template, annotations, upstream, mode, source }) {
  const sections = Object.entries(annotations.areas).map(([area, title]) => {
    const rows = Object.entries(annotations.skills)
      .filter(([, note]) => note.area === area)
      .map(([name, note]) => {
        const flags = note.flags?.length ? ` (${note.flags.join(", ")})` : "";
        const text = mode === "descriptions" ? upstream.get(name).description : note.keywords.join("; ");
        return `- \`${name}\`${flags}: ${text}`;
      });
    return `### ${title}\n\n${rows.join("\n")}`;
  });
  return template.replace("{{SOURCE}}", source).replace("{{SKILLS}}", sections.join("\n\n"));
}

/** Pulls the route, tool use, and cost out of one `claude -p --output-format stream-json` run. */
export function parseStream(text) {
  const events = text
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const init = events.find((event) => event.type === "system" && event.subtype === "init");
  const result = events.findLast((event) => event.type === "result");
  const invoked = [];
  const reads = [];
  for (const event of events) {
    if (event.type !== "assistant") {
      continue;
    }
    for (const block of event.message?.content ?? []) {
      if (block.type !== "tool_use") {
        continue;
      }
      if (block.name === "Skill") {
        invoked.push(normalizeSkill(block.input?.skill ?? block.input?.command ?? ""));
      } else if (block.name === "Read") {
        reads.push(block.input?.file_path ?? "");
      }
    }
  }

  const finalText = result?.result ?? "";
  return {
    listedSkills: init?.skills ?? [],
    invoked,
    reads,
    declared: parseRoute(finalText),
    finalText,
    costUsd: result?.total_cost_usd ?? 0,
    turns: result?.num_turns ?? 0,
    durationMs: result?.duration_ms ?? 0,
    error: !result ? "no result event" : result.is_error ? result.subtype ?? "error" : null
  };
}

export function normalizeSkill(raw) {
  return raw
    .trim()
    .replace(/^[`*/]+|[`*.]+$/g, "")
    .replace(/^\//, "")
    .split(/\s/)[0]
    .split(":")
    .pop()
    .toLowerCase();
}

/** Returns the skills on the last `ROUTE:` line, [] for `none`, or null when the line is missing. */
export function parseRoute(text) {
  const lines = [...text.matchAll(/^[\s*`]*ROUTE:\s*(.*)$/gim)];
  if (lines.length === 0) {
    return null;
  }
  const value = lines.at(-1)[1].replace(/[`*]/g, "").trim();
  if (/^none\b/i.test(value)) {
    return [];
  }
  return value
    .split(/,|→|->|>|\bthen\b/)
    .map(normalizeSkill)
    .filter((name) => name && name !== "none");
}

export function routeOf(parsed) {
  const route = [...(parsed.declared ?? [])];
  for (const name of parsed.invoked) {
    if (!route.includes(name)) {
      route.push(name);
    }
  }
  return route.filter((name) => name !== SOFIA);
}

export function scoreCase(testCase, parsed) {
  const route = routeOf(parsed);
  const failures = [];
  if (parsed.error) {
    failures.push(`run error: ${parsed.error}`);
  }
  if (parsed.declared === null) {
    failures.push("no ROUTE line");
  }
  for (const group of testCase.must ?? []) {
    if (!group.some((name) => route.includes(name))) {
      failures.push(`missing one of: ${group.join(" | ")}`);
    }
  }
  const forbidden = (testCase.forbid ?? []).filter((name) => route.includes(name));
  if (forbidden.length) {
    failures.push(`forbidden: ${forbidden.join(", ")}`);
  }
  if (testCase.none && route.length) {
    failures.push(`expected no skills, got ${route.join(", ")}`);
  }
  if (testCase.maxSkills && route.length > testCase.maxSkills) {
    failures.push(`route has ${route.length} skills, max ${testCase.maxSkills}`);
  }
  return { route, pass: failures.length === 0, failures, sofiaInvoked: parsed.invoked.includes(SOFIA) };
}

export function summarize(variant, results) {
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const sum = (key) => results.reduce((acc, r) => acc + (r[key] ?? 0), 0);
  return {
    variant,
    total,
    passed,
    passRate: total ? passed / total : 0,
    sofiaRate: total ? results.filter((r) => r.sofiaInvoked).length / total : 0,
    avgRouteSize: total ? results.reduce((acc, r) => acc + r.route.length, 0) / total : 0,
    costUsd: sum("costUsd"),
    avgDurationMs: total ? sum("durationMs") / total : 0
  };
}
