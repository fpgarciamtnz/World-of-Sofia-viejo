#!/usr/bin/env node
// Forward test: can Sofia route across the onmax/skills collection installed beside her?
// See README.md in this folder. Only the Node standard library and the `claude` CLI are used.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  REFERENCE_FILE,
  REGISTRY_POINTER,
  SOFIA,
  VARIANTS,
  addRegistryPointer,
  buildRegistry,
  countSkillUse,
  isPersonal,
  listingDescription,
  removeRegistryPointer,
  cacheRoot,
  evalRoot,
  keywordDescription,
  parseSkillFrontmatter,
  parseStream,
  projectRoot,
  readJson,
  rewriteDescription,
  scoreCase,
  summarize,
  upstreamDir
} from "./lib.mjs";

const sourceFile = path.join(evalRoot, "source.json");
const variantsDir = path.join(evalRoot, "variants");
const resultsRoot = path.join(evalRoot, "results");
const skipNames = new Set([".cache", ".git", "node_modules", "tests"]);
// Sandboxes live outside any git repository: Claude Code reads CLAUDE.md files and git status
// from parent folders, which would leak this repository's context into the runs.
const sandboxRoot = path.join(os.tmpdir(), "sofia-onmax-routing");

const HARNESS_PROMPT = [
  "This session is a routing test of the user's skill setup, in an empty folder with no project.",
  "Decide which skills apply as you normally would, loading a coordinator skill with the Skill tool when you would.",
  "You do not need to load the specialists you pick, and do not carry out the task.",
  "End your reply with one line `ROUTE: <skill>, <skill>` naming, in the order you would run them, the skills you would use for this task, excluding sofia-coordinatior.",
  "List a skill only the user can invoke too, when you would ask them to run it.",
  "Write `ROUTE: none` when no skill fits."
].join(" ");

const LISTING_PROBE = [
  "Do not call any tools. Using only the available-skills listing in your context:",
  "(1) how many skills are listed;",
  "(2) list every skill whose description you cannot see at all, or that is visibly cut off.",
  "Answer as two short lists."
].join(" ");

function usage() {
  return `Usage: node evals/onmax-routing/run.mjs <command> [options]

Commands:
  fetch [--latest]   Clone onmax/skills at the commit in source.json (--latest moves the pin to main)
  build              Write variants/registry-*.md from annotations.json and the upstream descriptions
  static             Report listing size per variant, flags, and skills without annotations
  probe              Ask the model which listed skills lost their descriptions, per variant
  run                Run the routing cases and score them

Use the onmax skills day to day:
  reference          Write Sofia's references/external-skills.md (keywords, personal skills left out)
  install [--dry-run]  Install the non-personal onmax skills into ~/.claude/skills with short listing descriptions
  uninstall          Remove the onmax skills that install put there
  usage [--all]      Count which skills were used since install (--all: all transcripts)

Options for probe and run:
  --variant a,b      Variants to run (default: all): ${Object.keys(VARIANTS).join(", ")}
  --case a,b         Case ids to run (default: all)
  --limit n          Run only the first n cases
  --model name       Model for claude -p (default: the CLI default)
  --concurrency n    Parallel runs (default: 4)
  --max-turns n      Turns per case (default: 6)
  --budget usd       Spend cap per case (default: 0.75)
  --dry-run          Build the sandboxes and print what would run`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, concurrency: 4, maxTurns: 6, budget: 0.75 };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const next = () => {
      const value = rest[(i += 1)];
      if (value === undefined) {
        throw new Error(`${arg} needs a value`);
      }
      return value;
    };
    if (arg === "--variant") options.variants = next().split(",");
    else if (arg === "--case") options.cases = next().split(",");
    else if (arg === "--limit") options.limit = Number(next());
    else if (arg === "--model") options.model = next();
    else if (arg === "--concurrency") options.concurrency = Number(next());
    else if (arg === "--max-turns") options.maxTurns = Number(next());
    else if (arg === "--budget") options.budget = Number(next());
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--latest") options.latest = true;
    else if (arg === "--all") options.all = true;
    else throw new Error(`Unknown option ${arg}\n\n${usage()}`);
  }
  for (const variant of options.variants ?? []) {
    if (!VARIANTS[variant]) {
      throw new Error(`Unknown variant ${variant}`);
    }
  }
  return options;
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

async function exists(file) {
  return fs.access(file).then(() => true, () => false);
}

async function fetchUpstream({ latest = false } = {}) {
  const source = await readJson(sourceFile);
  if (!(await exists(path.join(upstreamDir, ".git")))) {
    await fs.mkdir(cacheRoot, { recursive: true });
    git(["clone", "--quiet", source.repo, upstreamDir]);
  }
  const current = git(["rev-parse", "HEAD"], upstreamDir);
  if (latest) {
    git(["fetch", "--quiet", "origin", "main"], upstreamDir);
    source.commit = git(["rev-parse", "origin/main"], upstreamDir);
    await fs.writeFile(sourceFile, `${JSON.stringify(source, null, 2)}\n`);
  }
  if (current !== source.commit) {
    try {
      git(["checkout", "--quiet", source.commit], upstreamDir);
    } catch {
      git(["fetch", "--quiet", "origin"], upstreamDir);
      git(["checkout", "--quiet", source.commit], upstreamDir);
    }
  }
  return source;
}

async function loadUpstream() {
  const source = await fetchUpstream();
  const root = path.join(upstreamDir, "skills");
  const skills = new Map();
  for (const name of (await fs.readdir(root)).sort()) {
    const file = path.join(root, name, "SKILL.md");
    if (await exists(file)) {
      skills.set(name, { ...parseSkillFrontmatter(await fs.readFile(file, "utf8")), dir: path.join(root, name) });
    }
  }
  return { source, skills };
}

async function loadSofiaFamily() {
  const root = path.join(projectRoot, "skills");
  const skills = new Map();
  for (const name of (await fs.readdir(root)).sort()) {
    const file = path.join(root, name, "SKILL.md");
    if (await exists(file)) {
      skills.set(name, { ...parseSkillFrontmatter(await fs.readFile(file, "utf8")), dir: path.join(root, name) });
    }
  }
  return skills;
}

async function registryText(mode, upstream, source, { production = false } = {}) {
  const annotations = await readJson(path.join(evalRoot, "annotations.json"));
  const template = await fs.readFile(path.join(evalRoot, production ? "reference-template.md" : "registry-template.md"), "utf8");
  const sourceLabel = `${source.repo.replace(/\.git$/, "")} at ${source.commit.slice(0, 7)}`;
  return buildRegistry({ template, annotations, upstream, mode, source: sourceLabel, skipPersonal: production });
}

async function build() {
  const { source, skills } = await loadUpstream();
  await fs.mkdir(variantsDir, { recursive: true });
  for (const mode of ["descriptions", "keywords"]) {
    const text = await registryText(mode, skills, source);
    const file = path.join(variantsDir, `registry-${mode}.md`);
    await fs.writeFile(file, text);
    console.log(`${path.relative(projectRoot, file)}: ${text.length} chars`);
  }
}

function listingChars(skills) {
  // A rough measure of what each skill costs the always-loaded listing.
  return [...skills].filter(([, s]) => !s.userOnly).reduce((acc, [name, s]) => acc + name.length + s.description.length + 4, 0);
}

async function staticReport() {
  const { skills: upstream } = await loadUpstream();
  const sofia = await loadSofiaFamily();
  const annotations = await readJson(path.join(evalRoot, "annotations.json"));
  const missing = [...upstream.keys()].filter((name) => !annotations.skills[name]);
  const stale = Object.keys(annotations.skills).filter((name) => !upstream.has(name));
  const clash = [...upstream.keys()].filter((name) => sofia.has(name));

  const keywordUpstream = new Map(
    [...upstream].map(([name, s]) => [name, { ...s, description: keywordDescription(annotations.skills[name]?.keywords ?? [s.description]) }])
  );
  console.log(`Sofia family: ${sofia.size} skills, listing ~${listingChars(sofia)} chars`);
  console.log(`onmax upstream: ${upstream.size} skills (${[...upstream.values()].filter((s) => s.userOnly).length} user-only), listing ~${listingChars(upstream)} chars`);
  console.log(`onmax with keyword descriptions: listing ~${listingChars(keywordUpstream)} chars`);
  console.log("Largest upstream descriptions:");
  for (const [name, s] of [...upstream].sort((a, b) => b[1].description.length - a[1].description.length).slice(0, 8)) {
    console.log(`  ${String(s.description.length).padStart(5)}  ${name}`);
  }
  for (const flag of ["user-only", "personal", "ambient", "trigger-word"]) {
    const names = Object.entries(annotations.skills).filter(([, n]) => n.flags?.includes(flag)).map(([n]) => n);
    console.log(`${flag}: ${names.join(", ")}`);
  }
  const mismatched = [...upstream].filter(([name, s]) => s.userOnly !== Boolean(annotations.skills[name]?.flags?.includes("user-only"))).map(([n]) => n);
  if (missing.length) console.log(`Upstream skills without annotations (add keywords): ${missing.join(", ")}`);
  if (stale.length) console.log(`Annotations for skills no longer upstream: ${stale.join(", ")}`);
  if (clash.length) console.log(`Name clashes with the Sofia family: ${clash.join(", ")}`);
  if (mismatched.length) console.log(`user-only flag out of date: ${mismatched.join(", ")}`);
  console.log("Claude Code's built-in skills share the listing too; run `probe` to see what is cut.");
  return missing.length || stale.length || mismatched.length ? 1 : 0;
}

async function copySkill(from, to) {
  await fs.cp(from, to, { recursive: true, filter: (src) => !skipNames.has(path.basename(src)) });
}

/** Installs the Sofia family and onmax skills into a throwaway CLAUDE_CONFIG_DIR for one variant. */
async function buildSandbox(variantName, upstream, source) {
  const variant = VARIANTS[variantName];
  const root = path.join(sandboxRoot, variantName);
  const config = path.join(root, "config");
  const skillsDir = path.join(config, "skills");
  const workspace = path.join(root, "workspace");
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.mkdir(workspace, { recursive: true });

  const annotations = await readJson(path.join(evalRoot, "annotations.json"));
  for (const [name, skill] of upstream) {
    const target = path.join(skillsDir, name);
    await copySkill(skill.dir, target);
    if (variant.listing === "keywords" && annotations.skills[name]) {
      const file = path.join(target, "SKILL.md");
      await fs.writeFile(file, rewriteDescription(await fs.readFile(file, "utf8"), keywordDescription(annotations.skills[name].keywords)));
    }
  }
  // Sofia's family is installed last so that a name clash keeps her version.
  for (const [name, skill] of await loadSofiaFamily()) {
    await fs.rm(path.join(skillsDir, name), { recursive: true, force: true });
    await copySkill(skill.dir, path.join(skillsDir, name));
  }
  // Every variant starts from Sofia without her shipped reference, then adds its own.
  const sofiaDir = path.join(skillsDir, SOFIA);
  const skillFile = path.join(sofiaDir, "SKILL.md");
  await fs.rm(path.join(sofiaDir, "references", REFERENCE_FILE), { force: true });
  await fs.writeFile(skillFile, removeRegistryPointer(await fs.readFile(skillFile, "utf8")));
  if (variant.registry) {
    await fs.writeFile(path.join(sofiaDir, "references", REFERENCE_FILE), await registryText(variant.registry, upstream, source));
    await fs.writeFile(skillFile, addRegistryPointer(await fs.readFile(skillFile, "utf8")));
  }
  return { config, skillsDir, workspace };
}

function runClaude({ prompt, sandbox, options, appendSystemPrompt, maxTurns }) {
  const args = [
    "-p",
    "--output-format", "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--max-turns", String(maxTurns),
    "--max-budget-usd", String(options.budget),
    "--add-dir", sandbox.skillsDir,
    "--tools", "Skill,Read,Glob,Grep"
  ];
  if (appendSystemPrompt) args.push("--append-system-prompt", appendSystemPrompt);
  if (options.model) args.push("--model", options.model);

  return new Promise((resolve) => {
    const child = spawn("claude", args, {
      cwd: sandbox.workspace,
      env: { ...process.env, CLAUDE_CONFIG_DIR: sandbox.config },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ stdout, stderr, code }));
    child.stdin.end(prompt);
  });
}

async function pool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index], index);
      }
    })
  );
  return results;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function probe(options) {
  const { source, skills: upstream } = await loadUpstream();
  const variants = options.variants ?? Object.keys(VARIANTS);
  for (const variantName of variants) {
    const sandbox = await buildSandbox(variantName, upstream, source);
    if (options.dryRun) {
      console.log(`[dry-run] ${variantName}: ${sandbox.config}`);
      continue;
    }
    const { stdout } = await runClaude({ prompt: LISTING_PROBE, sandbox, options, maxTurns: 1 });
    const parsed = parseStream(stdout);
    console.log(`\n## ${variantName} (${parsed.listedSkills.length} skills loaded)\n${parsed.finalText}`);
  }
}

async function run(options) {
  const { source, skills: upstream } = await loadUpstream();
  let { cases } = await readJson(path.join(evalRoot, "cases.json"));
  if (options.cases) cases = cases.filter((c) => options.cases.includes(c.id));
  if (options.limit) cases = cases.slice(0, options.limit);
  const variants = options.variants ?? Object.keys(VARIANTS);
  const outDir = path.join(resultsRoot, stamp());

  const jobs = [];
  const sandboxes = {};
  for (const variantName of variants) {
    sandboxes[variantName] = await buildSandbox(variantName, upstream, source);
    for (const testCase of cases) jobs.push({ variantName, testCase });
  }
  console.log(`${jobs.length} runs: ${variants.length} variant(s) x ${cases.length} case(s), up to $${options.budget} each.`);
  if (options.dryRun) {
    for (const [name, sandbox] of Object.entries(sandboxes)) console.log(`[dry-run] ${name}: CLAUDE_CONFIG_DIR=${sandbox.config}`);
    return 0;
  }

  await fs.mkdir(path.join(outDir, "raw"), { recursive: true });
  const results = await pool(jobs, options.concurrency, async ({ variantName, testCase }) => {
    const { stdout, stderr } = await runClaude({
      prompt: testCase.prompt,
      sandbox: sandboxes[variantName],
      options,
      appendSystemPrompt: HARNESS_PROMPT,
      maxTurns: options.maxTurns
    });
    await fs.writeFile(path.join(outDir, "raw", `${variantName}--${testCase.id}.jsonl`), stdout + (stderr ? `\n// stderr\n${stderr}` : ""));
    const parsed = parseStream(stdout);
    const score = scoreCase(testCase, parsed);
    const mark = score.pass ? "pass" : "FAIL";
    console.log(`${mark}  ${variantName.padEnd(22)} ${testCase.id.padEnd(18)} ${score.route.join(", ") || "(none)"}${score.pass ? "" : `  <- ${score.failures.join("; ")}`}`);
    return {
      variant: variantName,
      id: testCase.id,
      ...score,
      declared: parsed.declared,
      invoked: parsed.invoked,
      reads: parsed.reads.map((file) => file.replace(sandboxes[variantName].skillsDir, "<skills>")),
      costUsd: parsed.costUsd,
      turns: parsed.turns,
      durationMs: parsed.durationMs,
      finalText: parsed.finalText
    };
  });

  const summaries = variants.map((v) => summarize(v, results.filter((r) => r.variant === v)));
  await fs.writeFile(path.join(outDir, "results.json"), `${JSON.stringify({ source, cases: cases.length, summaries, results }, null, 2)}\n`);
  await fs.writeFile(path.join(outDir, "summary.md"), summaryMarkdown(source, cases, summaries, results));
  console.log(`\n${summaryMarkdown(source, cases, summaries, results)}`);
  console.log(`Saved to ${path.relative(projectRoot, outDir)}`);
  return 0;
}

function summaryMarkdown(source, cases, summaries, results) {
  const pct = (x) => `${Math.round(x * 100)}%`;
  const lines = [
    `# Sofia routing over onmax/skills at ${source.commit.slice(0, 7)}`,
    "",
    "| Variant | Pass | Sofia loaded | Avg skills | Cost | Avg time |",
    "|---|---|---|---|---|---|",
    ...summaries.map((s) => `| ${s.variant} | ${s.passed}/${s.total} (${pct(s.passRate)}) | ${pct(s.sofiaRate)} | ${s.avgRouteSize.toFixed(1)} | $${s.costUsd.toFixed(2)} | ${(s.avgDurationMs / 1000).toFixed(0)}s |`),
    "",
    "## Per case",
    "",
    `| Case | ${summaries.map((s) => s.variant).join(" | ")} |`,
    `|---|${summaries.map(() => "---").join("|")}|`
  ];
  for (const testCase of cases) {
    const cells = summaries.map((s) => {
      const r = results.find((x) => x.variant === s.variant && x.id === testCase.id);
      if (!r) return "";
      return `${r.pass ? "✅" : "❌"} ${r.route.join(", ") || "none"}`;
    });
    lines.push(`| ${testCase.id} | ${cells.join(" | ")} |`);
  }
  const failures = results.filter((r) => !r.pass);
  if (failures.length) {
    lines.push("", "## Failures", "");
    for (const r of failures) lines.push(`- ${r.variant} / ${r.id}: ${r.failures.join("; ")}`);
  }
  return `${lines.join("\n")}\n`;
}

function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

function manifestFile() {
  return path.join(configDir(), ".backups", "world-of-sofia", "onmax-installed.json");
}

async function writeReference() {
  const { source, skills } = await loadUpstream();
  const file = path.join(projectRoot, "skills", SOFIA, "references", REFERENCE_FILE);
  const text = await registryText("keywords", skills, source, { production: true });
  await fs.writeFile(file, text);
  console.log(`${path.relative(projectRoot, file)}: ${text.length} chars`);
  const skill = await fs.readFile(path.join(projectRoot, "skills", SOFIA, "SKILL.md"), "utf8");
  if (!skill.includes("references/external-skills.md")) {
    console.log(`Add a pointer to it in ${SOFIA}/SKILL.md; the eval used: ${REGISTRY_POINTER}`);
  }
}

async function install({ dryRun }) {
  const { source, skills: upstream } = await loadUpstream();
  const annotations = await readJson(path.join(evalRoot, "annotations.json"));
  const sofia = await loadSofiaFamily();
  const target = path.join(configDir(), "skills");
  const backups = path.join(configDir(), ".backups", "world-of-sofia");
  const previous = await readJson(manifestFile()).catch(() => ({ skills: [] }));
  const installed = [];
  const skipped = [];

  for (const [name, skill] of upstream) {
    const note = annotations.skills[name];
    if (isPersonal(note) || sofia.has(name)) {
      skipped.push(name);
      continue;
    }
    if (!note) {
      throw new Error(`${name} has no entry in annotations.json; add keywords, then run build and reference.`);
    }
    const destination = path.join(target, name);
    const ours = previous.skills.includes(name);
    if (dryRun) {
      console.log(`[dry-run] ${(await exists(destination)) && !ours ? "back up and replace" : "install"} ${name}`);
      installed.push(name);
      continue;
    }
    if (await exists(destination)) {
      if (!ours) {
        await fs.mkdir(backups, { recursive: true });
        await fs.rename(destination, path.join(backups, `${name}-${stamp()}`));
      } else {
        await fs.rm(destination, { recursive: true, force: true });
      }
    }
    await copySkill(skill.dir, destination);
    const file = path.join(destination, "SKILL.md");
    await fs.writeFile(file, rewriteDescription(await fs.readFile(file, "utf8"), listingDescription(skill.description, note)));
    installed.push(name);
  }

  // A skill dropped from the install set since last time is removed too.
  for (const name of previous.skills.filter((n) => !installed.includes(n))) {
    if (!dryRun) await fs.rm(path.join(target, name), { recursive: true, force: true });
    console.log(`${dryRun ? "[dry-run] " : ""}removed ${name}`);
  }
  if (!dryRun) {
    await fs.mkdir(path.dirname(manifestFile()), { recursive: true });
    const manifest = { source, installedAt: previous.installedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(), skills: installed };
    await fs.writeFile(manifestFile(), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(`${dryRun ? "Would install" : "Installed"} ${installed.length} onmax skills into ${target} at ${source.commit.slice(0, 7)}.`);
  console.log(`Left out: ${skipped.join(", ")}`);
  console.log(`Also run \`npm run install:skill -- ${SOFIA}\` so Sofia has the external-skills reference.`);
  return 0;
}

async function uninstall() {
  const manifest = await readJson(manifestFile()).catch(() => null);
  if (!manifest) {
    console.log("No onmax install found.");
    return 0;
  }
  for (const name of manifest.skills) {
    await fs.rm(path.join(configDir(), "skills", name), { recursive: true, force: true });
  }
  await fs.rm(manifestFile());
  console.log(`Removed ${manifest.skills.length} onmax skills. Backups of anything they replaced are in ${path.dirname(manifestFile())}.`);
  return 0;
}

async function transcripts(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await transcripts(full)));
    else if (entry.name.endsWith(".jsonl")) files.push(full);
  }
  return files;
}

async function skillUsage({ all }) {
  const manifest = await readJson(manifestFile()).catch(() => null);
  const since = all ? "" : manifest?.installedAt ?? "";
  const onmax = new Set(manifest?.skills ?? []);
  const family = new Set((await loadSofiaFamily()).keys());
  const totals = new Map();
  for (const file of await transcripts(path.join(configDir(), "projects"))) {
    for (const [name, entry] of countSkillUse(await fs.readFile(file, "utf8"), since)) {
      const total = totals.get(name) ?? { model: 0, user: 0, last: "" };
      total.model += entry.model;
      total.user += entry.user;
      total.last = entry.last > total.last ? entry.last : total.last;
      totals.set(name, total);
    }
  }
  const group = (name) => (family.has(name) ? "sofia" : onmax.has(name) ? "onmax" : "other");
  console.log(since ? `Skill use since ${since.slice(0, 10)} (install date)` : "Skill use in all transcripts");
  console.log("group  model  /typed  last used   skill");
  const rows = [...totals].sort((a, b) => b[1].model + b[1].user - (a[1].model + a[1].user));
  for (const [name, t] of rows) {
    console.log(`${group(name).padEnd(6)} ${String(t.model).padStart(5)}  ${String(t.user).padStart(6)}  ${t.last.slice(0, 10).padEnd(10)}  ${name}`);
  }
  const unused = [...onmax].filter((name) => !totals.has(name));
  if (manifest) console.log(`\nonmax skills not used yet (${unused.length}/${onmax.size}): ${unused.join(", ")}`);
  return 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  switch (options.command) {
    case "fetch": {
      const source = await fetchUpstream({ latest: options.latest });
      console.log(`onmax/skills at ${source.commit} in ${path.relative(projectRoot, upstreamDir)}`);
      return 0;
    }
    case "build":
      await build();
      return 0;
    case "static":
      return staticReport();
    case "probe":
      await probe(options);
      return 0;
    case "run":
      return run(options);
    case "reference":
      await writeReference();
      return 0;
    case "install":
      return install(options);
    case "uninstall":
      return uninstall();
    case "usage":
      return skillUsage(options);
    default:
      console.log(usage());
      return options.command ? 1 : 0;
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error.message);
    process.exit(1);
  }
);
