# External Skills

These skills come from `onmax/skills` (https://github.com/onmax/skills at 9d5f5aa) and are installed beside the Sofia family. Route to one when its trigger fits the task better than a Sofia specialist. When both fit, the Sofia specialist keeps its role and the external skill supplies craft rules for the fix.

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

### Design engineering and UI craft

- `emil-animations`: motion in product UI; transition; easing; spring; enter/exit animation; janky or slow animation; hover/press feedback; reduced motion; Framer Motion
- `emil-ask-lapse`: Lapse; animation inspector; slow-mo a page; record or scrub a take; motion diff; jank report
- `emil-color`: OKLCH; palette; tonal scale; text contrast (WCAG, APCA); dark mode palette; gamut / P3; Tailwind color tokens
- `emil-component-design`: React component API; props design; compound components; controlled vs uncontrolled; asChild / Slot; component library
- `emil-design-foundations`: visual hierarchy; spacing; layout; button hierarchy; empty and error states; UI microcopy; design audit; looks off
- `emil-design-system-docs`: DESIGN.md; design system docs; component and token guidelines; agent invents variants or hardcodes colors
- `emil-forms-and-inputs`: form; input; button states; validation timing; double submit; iOS input zoom; Enter / Cmd+Enter submit; login / signup / checkout
- `emil-marketing-pages`: landing page; hero; pricing page; blog / docs site / changelog; CTA; scroll animation restraint; marketing site setup
- `emil-mobile-native`: web app on a phone; iOS Safari; 100vh / dvh; safe area / notch; tap highlight; sticky hover; PWA; bottom sheet; feels like a website
- `emil-performance`: UI performance; long list / virtualization; re-renders; layout shift; lazy loading; font loading; janky scrolling
- `emil-prep-for-prod`: pre-launch sweep; ready to ship?; launch checklist; production audit; final pass before demo or release
- `emil-prototype`: several UI variations; options behind a picker; prototype directions; compare side by side; tweak values on live controls
- `emil-surfaces`: shadow; border; border-radius; elevation; gradient; card styling; dark-mode surfaces; looks flat
- `emil-touch-and-accessibility`: tap targets; keyboard navigation; focus management; aria labels; screen reader; reduced motion; touch vs hover
- `emil-typography`: fonts; type scale; line-height; letter-spacing; variable fonts; text wrapping / truncation; underlines
- `emil-ui-polish`: polish pass; feels unfinished; hover / focus / pressed states; z-index; scrollbars; font rendering; make it feel better
- `emil-ui-review`: review a UI diff or PR; review a generated component; design QA; does this look right
- `emil-unslop-design`: UI looks AI-generated; generic / vibe-coded look; purple gradients; glassmorphism; give it personality
- `ui-cli`: load UI Skills via the ui-skills CLI; broad make-it-look-better pass
- `emil-get-creative` (user-only): creatively stuck; only a mood or vibe; need inspiration; generative visual with knobs
- `emil-build-a-tool` (user-only): build a tool instead of re-prompting; artifact keeps missing; taste on live controls
- `emil-ask-emil` (user-only): which emil skill fits; order of the design skills

### Naming a concept

- `emil-design-vocabulary`: exact design term; badge vs tag; tooltip vs popover; kerning vs tracking; name a UI concept
- `emil-engineering-vocabulary`: what's it called when; frontend term lookup; debounce; optimistic update; name a behavior

### Writing, docs, and media

- `emil-unslop-writing`: prose sounds like AI; de-slop text; README / docs / release notes voice; humanize
- `unslop` (ambient): remove AI tells from any writing
- `emil-writing-skills`: write or refine a SKILL.md; skill does not change behavior; package taste as a skill
- `writing-for-agents`: documents for agents; create or edit skills; CLAUDE.md edits
- `seo-content`: SEO / AEO pages; rank in search or AI answers; glossary / comparison / alternatives pages; Search Console; backlinks
- `explainer-video`: narrated explainer video; mp4; voiceover; TTS; captions; publish to Drop
- `report` (personal): write up research or an audit; ranked shortlist; comparison for a decision; Drop page
- `emil-borrow-a-brain` (user-only): skill from someone's public writing; think like X

### Engineering workflow

- `code-review`: review a branch or PR against its spec; repository standards; parallel review since a fixed point
- `codebase-design`: deep modules; module interface; where a seam goes; testability; AI-navigable code
- `diagnosing-bugs`: diagnose; debug this; broken / throwing / failing; performance regression
- `repro`: minimal reproduction; repro repository; fixture; isolated example of a bug
- `boil-the-ocean`: huge rewrite, port, or rebuild; looks like too much work; take the full scope
- `research`: how others or the industry do it; what the standard is; evidence before a decision
- `emil-unslop-code`: code looks AI-generated; narrated comments; try/catch theater; as any; clean up before a PR
- `council` (trigger-word): user says council; three-provider review
- `sol-loop` (trigger-word): user says sol loop; GPT Sol review loop
- `mantras` (ambient): working mantras for any task
- `grilling` (user-only): grill me; stress-test a plan or idea
- `emil-product-thinking` (user-only): should I build this; validate a product idea; what to build first
- `handoff` (user-only): handoff document for another agent
- `retro` (user-only): review a finished session; improve the agent setup

### Maxi's own machines, accounts, and voice

- `write-like-maxi` (personal): chat, DM, or comment in Maxi's voice
- `pr-and-issue-writing` (personal): PR or issue in Maxi's voice; finalize an open-source PR
- `paper-cuts` (personal): report tool or machine friction to Maxi
- `fleet` (personal): Maxi's machines; Tailscale; SSH; self-hosted services
- `dev` (personal): dev server on Slimbook
- `remote-browser` (personal): log in to a site as Maxi in a real browser
- `vitehub-projects` (user-only, personal): ViteHub projects
