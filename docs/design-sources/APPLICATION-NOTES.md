# IAYA redesign: applied external design guidance

Retrieved from the three exact user-provided public repositories on 2026-10-12. Source Markdown is reference material for this build. No third-party installation, hook, engine, script, or plugin code was executed. The source authors' instructions are subordinate to the user's explicit task, pinned brand commitments, platform capabilities, and the project's existing functionality.

## Sources

| Repository | Relevant source | Blob SHA | License |
| --- | --- | --- | --- |
| emilkowalski/skills | https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md | 62ce902af8dd32c590ea7203e9ab2edb1d6ef81a | MIT |
| pbakaus/impeccable | https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md | b9d82965dd59a45596c5b63a1cf4207168a272a7 | Apache 2.0 |
| Leonxlnx/taste-skill | https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md | 50aff0b2dfc013c8c1e9e810029af3dff6e10183 | MIT |

Also retrieved Impeccable craft-floor, layout, typeset, polish, and new-work references, every README, and each LICENSE. If source text is vendored or redistributed, keep its provided license notices.

## Scope and design read

Reading this as a complete replacement of an association/community website for Iraqi academics and young academics in the UK, with a welcoming, authoritative contemporary editorial language. The user has pinned the logo, brand, message, creamy-white light theme, and deep-blue dark theme. These override any generic palette bans or trend defaults. Landing/about/activities surfaces use the Taste marketing guidance; login, approval, and member tools use Impeccable's Operate guidance rather than Taste's intentionally out-of-scope dashboard rules.

The old visual world should be replaced decisively, not decorated or lightly polished. Preserve factual association content, existing names/portraits/contacts, legal/consent copy, functional anchors and any SEO structure that remain relevant. Make additions from facts already present or clearly mark empty states; do not invent association statistics, testimonials, endorsements, history, committees, or event dates.

## Composition

- Establish a strong first-viewport message, a real visual, one primary action, and at most one supporting action. Keep navigation in one row at desktop, 64–80px tall, with explicit mobile collapse.
- Use differentiated section compositions: asymmetric hero, readable manifesto/association statement, activities with editorial rows or image stories, leaders with useful portraits and bios, clear community join pathway. Avoid uniform three-card sections, nested cards, repeated zigzag splits, unnecessary eyebrows, section numbers, and filler labels.
- A four-unit spacing scale supplies precise intra-group rhythm; related items stay close and sections separate generously. Priority should be apparent in the squint test.
- Theme the whole page through semantic CSS tokens. Both themes keep equivalent hierarchy and brand identity. Within-theme background tints are acceptable; don't accidentally flip to a different theme halfway down the page.

## Type, color, and imagery

- Use an intentional and readable display/body system, few font families and roles, with 16px ordinary body text. Body measure 45–75ch, preferably near 65ch; display scale no greater than 6rem, tracking never tighter than -0.04em. Responsive headings must avoid overflow, clipped descenders, and excessive line counts.
- Do not choose Inter/Arial/system display typography merely from habit. A heritage editorial serif must have a specific brand reason rather than a generic premium cue. Arabic needs its own appropriate readable font metrics and tested RTL layouts.
- Semantic colors must support contrast of at least 4.5:1 for body/control/helper/error text and 3:1 for large text. Secondary text on blue surfaces should be blue-tinted from the foreground, not unrelated gray.
- Use real supplied portraits and imagery with correct aspect ratios and useful alternative text. Do not replace real people with generated depictions; any generated contextual hero photography must remain illustrative. Reserve image space and keep fonts nonblocking to prevent layout shift.
- One consistent icon family, consistent weight/stroke. No emoji standing in for icons. Cards only when grouping/elevation communicates a real relationship; otherwise use whitespace, separators, or rows.

## Motion applied from Emil

- Every animation must communicate hierarchy, state, feedback, or continuity. Keep occasional interaction motion responsive and restrained; repeated member tools should be especially fast.
- Entry/exit use strong ease-out: cubic-bezier(0.23, 1, 0.32, 1). Onscreen movement may use ease-in-out: cubic-bezier(0.77, 0, 0.175, 1). Color hover uses ease. Avoid slow-start ease-in for UI.
- Button press feedback 100–160ms, popovers 125–200ms, menus 150–250ms. Most interaction animation stays below 300ms. Use subtle active scale(0.97), never entry from scale(0).
- Prefer interruptible CSS transitions for quickly toggled controls. Routine animation uses transform/opacity, with limited one-time image clipping as an authored visual moment if it remains smooth. Avoid transition: all, scroll hijacking, infinite decorative motion, and permanent will-change on unrelated elements.
- Gate hover motion to (hover: hover) and (pointer: fine); honor prefers-reduced-motion with static movement and preserved content. Content must be readable with JavaScript disabled or motion suppressed.
- Origin-aware popovers start at their triggers; centered dialogs stay centered. Keyboard-triggered repeated actions should not incur decorative delays.

## Community account path

- Label every field above its input, explain errors below, preserve helper text, and keep labels distinct from placeholders.
- Provide real loading, error, empty, disabled, permission, success, and pending-approval states. The user should understand what access is granted at each state and how to recover.
- Google signup/sign-in must connect to a real configured OAuth provider/backend, not pretend to authorize a local browser identity. Approval is a server-enforced role/status decision. A preview without backend configuration should say what setup is pending rather than claim functional authentication.
- Navigation, theme toggle, language switch, and member actions need visible keyboard focus, logical order, usable touch targets, and contrast in both themes.

## Bounded verification

Build the complete path, inspect desktop/mobile and both themes in one batch, fix the discovered defects together, then confirm with at most one additional inspection round unless a new issue justifies more. Include Arabic/RTL, long content, empty member data, real permission boundaries, keyboard access, reduced motion, form recovery, console errors, image load, and responsive overflow. A clean code scan does not substitute for seeing and using the page.

## Installation facts and boundaries

The repositories are publicly accessible; all requested source material was fetched successfully. Emil and Taste document npx skills installers and Markdown copying; Impeccable documents a CLI installer, provider-specific copies, and a self-contained engine that may download a binary on first use. None is a website runtime dependency. In this environment the three guides can inform code authoring directly without executing installers. Taste currently labels its main guide v2 experimental; Impeccable reports 4.5.2. Some automation-specific workflow instructions in those external guides assume their bundled engine, native hooks, and interactive direction boards, which have not been installed here. The result should be described as applying the three sources' design guidance, not as running their automated /polish tools.
