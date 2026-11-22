# ADR 0008: Keep Banco Animaciones Aristoteles

## Status

Accepted, 2026-11-22. Adds a ninth skill to the eight left by ADR 0006.

## Context

`banco-animaciones-aristoteles` was built on 2026-11-09 in a second clone of this repository on the user's Linux machine. It lived only on that clone's local branches and in the copies installed in `~/.claude/skills`, so it never reached `main`, and ADR 0004 cut the family to seven skills without seeing it.

On 2026-11-22 the user retired that clone and asked to keep every skill. The clone's branches were pushed to GitHub first (`backup/pre-onmax-routing-test`, `test/onmax-routing`, and the tag `snapshot/pre-onmax-routing-test`), so the skill's history stays there.

## Decision

- Add `banco-animaciones-aristoteles` as it stands on `test/onmax-routing`: 703 animation prompts from [awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos) (MIT), each credited to its author, classed by Aristotle's questions of what a thing is, what it is about, how it looks, what it is made with, and what state it is in, with a search script and a test.
- Drop its "Con el resto de Sofia" section. It sent work to `pattern-code-wittgenstein` and `ui-attention-ciceron`, which ADR 0004 retired, and ADR 0004 removed bridge sections from every skill. The skill works alone and names no other skill.
- Point its `installCommand` at `npx skills add`, as ADR 0007 did for the others.

## Consequences

- Nine skills remain.
- At about 3 MB it is the largest skill, since it carries the whole bank. It tells Claude to search the bank with its script instead of reading the folders.
- The prompts belong to their authors. If one asks for a prompt to be removed, delete its file and run `node scripts/indexar.mjs`, as `banco/ORIGEN.md` says.
