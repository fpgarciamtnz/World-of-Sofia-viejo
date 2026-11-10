# External Skills

These skills come from `onmax/skills` ({{SOURCE}}) and are installed beside the Sofia family. Route to one when its trigger fits the task better than a Sofia specialist. When both fit, the Sofia specialist keeps its role and the external skill supplies craft rules for the fix.

- `user-only`: the Skill tool cannot run it. Tell the user to run `/<name>`, or read `<skills dir>/<name>/SKILL.md` and apply it when they asked for that work.
- `personal`: it encodes its author's machines, accounts, or voice (Maxi). Skip it unless the user is that author or names the skill.
- `ambient`: it applies to every task by its own description. Never list it as a route.
- `trigger-word`: run it only when the user says its name.

## Overlaps With Sofia Specialists

- `grill-me-aquinas` owns meaning and scope before a plan. `grilling` and `emil-product-thinking` are user-only interviews; suggest them when the user asks to be grilled on an idea or asks whether a product is worth building.
- `synthesis-code-hegel` judges the shape of a real diff. `code-review` here checks the diff against its spec and repository standards, and replaces Claude Code's built-in skill of the same name. `emil-ui-review` judges UI craft in a diff, and `emil-unslop-code` strips AI tells from it.
- `pattern-code-wittgenstein` finds repository precedent before code is written. `codebase-design` designs a module's interface and seams.
- `ui-attention-ciceron` ranks attention on a rendered screen. The `emil-*` UI skills hold the craft rules for the fix: pick the one whose keywords match the problem.
- `communication-review-ciceron` judges whether a message lands with its audience. `emil-unslop-writing` removes AI tells from prose.
- `banco-animaciones-aristoteles` builds a standalone animation or 3D scene from the prompt bank. `emil-animations` owns motion inside product UI. `explainer-video` makes a narrated mp4 lesson.
- `earned-presence-kondo` decides what survives a radical rebuild. `boil-the-ocean` carries a huge rewrite or port through at full scope.
- `audit-plan-descartes` judges whether a plan can be trusted. `research` gathers outside evidence before the decision.
- A skill change in this repository follows Sofia's skill change protocol. `emil-writing-skills` and `writing-for-agents` may add a craft review on top.
- `emil-ask-emil` and `ui-cli` are routers of their own. Sofia keeps routing and does not hand it to them.
- For a bug, use `diagnosing-bugs`, then `repro` when a durable reproduction is wanted.

## Skills

{{SKILLS}}
