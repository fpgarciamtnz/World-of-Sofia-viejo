# Sofia × onmax/skills routing test

This test checks whether Sofia can route across the 53 skills in [onmax/skills](https://github.com/onmax/skills) once they are installed beside the Sofia family, and whether she does better reading their full descriptions or short keywords.

Nothing here touches `~/.claude`. Each variant installs every skill into its own throwaway `CLAUDE_CONFIG_DIR` under `$TMPDIR/sofia-onmax-routing/<variant>/`, then runs `claude -p` with only `Skill`, `Read`, `Glob`, and `Grep`, no MCP servers, and a spending cap per case. The sandbox sits outside any git repository because Claude Code reads `CLAUDE.md` and git status from parent folders, which would leak this repository into the runs. Upstream is pinned to the commit in `source.json`.

## Run it

```sh
npm run eval:routing -- fetch          # clone onmax/skills at the pinned commit
npm run eval:routing -- static         # listing size, flags, unannotated skills
npm run eval:routing -- probe          # which skills lose their description in the listing
npm run eval:routing -- run            # all cases x all variants (~128 runs, ~$13 on Opus)
npm run eval:routing -- run --variant all-keywords --case forms-ios,handoff
npm run eval:routing -- build          # regenerate variants/ after editing annotations
```

`fetch --latest` moves the pin to upstream `main`; `static` then lists any new skill that needs keywords. Results go to `results/<timestamp>/` as `summary.md` and `results.json`; raw transcripts are kept locally under `raw/`, which git ignores.

## Use it day to day

```sh
npm run install:skills               # the Sofia family, including her external-skills reference
npm run onmax:install                # 45 onmax skills into ~/.claude/skills (personal ones left out)
npm run onmax:usage                  # which skills sessions have used since the install
npm run onmax:uninstall              # remove only what onmax:install put there
```

The install leaves out the 8 skills flagged `personal` in `annotations.json`, because they encode Maxi's machines, accounts, or voice. Each installed skill lists its keywords instead of its upstream description whenever that is shorter. Skills flagged `ambient` or `trigger-word` keep their upstream wording, since that wording is the trigger. That keeps the always-loaded listing under Claude Code's budget, about 5k characters instead of 23k, and the upstream files are otherwise untouched. A skill that already existed under the same name is backed up to `~/.claude/.backups/world-of-sofia/`.

Sofia's `references/external-skills.md` is generated: edit `annotations.json` or `reference-template.md`, then run `npm run onmax:reference`. After moving the pin with `fetch --latest`, run `static` to find new skills that need keywords.

## Variants

| Variant | Sofia's reference | Onmax skills in the always-loaded listing |
|---|---|---|
| `baseline` | none: Sofia as she is | upstream descriptions |
| `registry-descriptions` | [every upstream description](variants/registry-descriptions.md) | upstream descriptions |
| `registry-keywords` | [keywords per skill](variants/registry-keywords.md) | upstream descriptions |
| `all-keywords` | keywords per skill | keywords instead of descriptions |

Both reference files come from [registry-template.md](registry-template.md) and differ only in the per-skill trigger text, so a difference in results comes from descriptions versus keywords. The test adds one pointer line to Sofia's `SKILL.md`, in the sandbox only.

## Files

- `annotations.json`: area, flags (`user-only`, `personal`, `ambient`, `trigger-word`), and keywords for each upstream skill.
- `cases.json`: prompts addressed to Sofia, with the skills each must route to, those it must not, and a maximum route length.
- `lib.mjs`, `run.mjs`: sandbox, runner, and scoring. `lib.test.mjs` runs in `npm run check`.

## Scoring

The model loads skills as it normally would, does not carry out the task, and ends with `ROUTE: a, b`. The route is that line plus any skill it actually called, minus Sofia. A case passes when each `must` group has a match, no `forbid` skill appears, and the route is no longer than `maxSkills`. One run per case is a sample, not a measurement, so rerun the failing cases before acting on a single difference.

## Known constraints

- With upstream descriptions, the listing exceeds Claude Code's budget, and `probe` shows the last skills alphabetically losing their descriptions, Sofia's `synthesis-code-hegel` and `ui-attention-ciceron` among them. Keyword listings avoid that.
- Onmax's `code-review` takes the name of Claude Code's built-in skill.
- Before a registry moves into `skills/sofia-coordinatior`, `npm run validate:skills` must pass. It rejects `AGENTS.md` and skill names ending in `maxi`, which appear in the upstream descriptions and annotations.
