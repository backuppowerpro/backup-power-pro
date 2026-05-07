# Design Language

> Per Key 2026-05-06: "I feel like I'm explaining UX/UI elements a ton." This file is the canonical UX/UI reference so future sessions don't make Key re-explain.

## The big-picture rules

### 1. Two surface families, two visual languages

**Customer-facing surfaces** (homepage form, proposal page, invoice page, sub portal, get-quote, install-day pages): polished modern marketing design. Brand colors. Smooth. Trust-building. **Never receive Minesweeper styling.**

**Internal surfaces** (CRM at `crm/crm.html`, internal dashboards, ops tools): Minesweeper Brutalist + 8-bit retro-future. Different language entirely. Operator tooling, not customer-facing.

When designing or editing, the first question is always: **which surface family is this?** The answer dictates every other choice.

### 2. One app, two layouts

Mobile and desktop should feel **identical** in visual identity (brand, components, chips, voice, rhythm). Layout adapts to screen size; visual identity does not. Anti-pattern: designing different "vibes" for desktop vs mobile.

### 3. Claude Design first for all design work

Visual design starts at claude.ai/design with the BPP design system, not in JSX from imagination. Claude Code wires up backend (Supabase queries, edge functions, auth, RLS, business logic) on top of static HTML produced by Claude Design.

Reference design system: https://claude.ai/design/p/019ddb93-c9e1-7b9a-9730-bbe409b713e9

### 4. Design every feature affordance

Every prototype includes a visual placeholder for every action the backend supports or will support. Inert buttons are OK; missing buttons are not. Per-screen feature inventory means the design covers the full surface, not just the happy path.

### 5. iOS safe-area in every mobile prototype

Every mobile design respects iPhone notch / Dynamic Island (~50px top) + home indicator (~34px bottom). Use `viewport-fit=cover` plus `env(safe-area-inset-*)` on hero, FAB, compose bar, scroll padding.

### 6. Smart versions of basic things

Apple Smart Shuffle pattern: layer quiet intelligence under familiar primitives instead of replacing them with novel AI UI. The button still looks like a button; it just makes a smarter choice when clicked. **Don't reinvent the affordance, just upgrade the brain behind it.**

## Brand tokens

- **Navy:** `#0b1f3b`
- **Gold:** `#ffba00`
- **Red:** `#dc2626`
- **Fonts:** Outfit (display), Inter (body)

## CRM design language (Minesweeper Brutalist + 8-bit)

### Visual rules
- **Zero border-radius.** Everywhere. (Avatars use blocky 16-vertex polygon clip-path instead of `border-radius: 50%`.)
- **Hard chiseled bevels.** 3-4px stark white + dark shadows, 0 blur.
- **Flat gray surfaces.** `#c0c0c0` light / `#3d3d3d` dark. No gradients, no glass, no soft fades.
- **8-bit stepped transitions.** `steps(4)`. No ease curves, no cubic-bezier.
- **Pixel typography for headlines/titles** (VT323). **Inter for body.**
- **SVG icons:** `shape-rendering: crispEdges`, square line caps, miter joins.
- **Bevel tokens** (use these, don't invent new shadows):
  - `--shadow-neu` (raised default)
  - `--shadow-neu-sm` (raised small)
  - `--shadow-neu-inset` (depressed default)
  - `--shadow-neu-inset-sm` (depressed small)

### Interaction rules
- **Click behavior follows Minesweeper:** raised elements flatten, flat elements depress. The button physically responds to your click.
- **Hover states are minimal.** Don't lighten/darken on hover; let the click-flatten do the work.
- **No motion-as-decoration.** Transitions exist for state changes, not flair.

## Customer-facing design language

Polished modern marketing design. Trust-building. Smooth.
- Rounded corners are fine.
- Soft shadows / depth is fine.
- Smooth transitions (cubic-bezier, ease) are fine.
- Brand colors lead.
- Outfit for display, Inter for body.
- iOS 26 Liquid Glass material is acceptable for premium-feel surfaces.
- Goal: customer feels they're dealing with a premium operation.

## Anti-patterns

- **Designing in JSX from imagination.** Visuals come from Claude Design first.
- **Inert prototypes that don't account for backend wiring.** Design the affordance with the backend brief in mind.
- **Different vibes for mobile vs desktop.** Same identity, adaptive layout.
- **Mixing CRM Brutalist into customer pages or vice versa.** Brand-language violation.
- **Real customer contact in walkthroughs.**
- **>2000px images in context.** Anthropic API caps single-image dimension; use text-based DOM tools when possible.
- **Stream-cap-busting Claude Design files.** One file per turn, suppress pre-code reasoning, hardcode minimum sample data, light theme first.

## When in doubt

If a design choice isn't explicit here, ask:
1. Customer-facing or internal?
2. Does it respect the surface family's language?
3. Visual placeholder for every backend affordance?
4. Mobile + desktop feel identical?
5. iOS safe-area respected (mobile)?

If yes to all five, ship. If not, surface to Key.
