# MerchPad Design Brainstorm

## Context
A high-velocity, offline-first merchandise sales tool used by merch reps at live shows. Runs on tablets and phones. Users are under pressure, in dark/loud environments, and need to act fast. The design must be instantly readable, tactile, and unmistakably part of the Moshly universe (dark, accent-purple, electric).

---

<response>
<probability>0.07</probability>
<text>

## Idea A: "Stage Monitor" — Industrial Dark Utility

**Design Movement**: Brutalist Utility meets Concert Production Aesthetics

**Core Principles**:
1. Every pixel earns its place — zero decoration, maximum signal
2. High-contrast, high-density information hierarchy
3. Physical metaphor: the interface feels like a hardware mixing desk
4. Monospace data, proportional labels — two-font rule throughout

**Color Philosophy**: Moshly dark base (`#0E0F14`) as the stage floor. Amber/orange (`#F59E0B`) as the primary action color — warm, urgent, visible in dark venues. Pure white for data. Muted slate for secondary text. Red/green/yellow for stock states only.

**Layout Paradigm**: Asymmetric split-panel. Left rail = navigation + context (narrow, fixed). Right = full-bleed content zone. Tally screen: dense grid, no wasted space, cards fill edge-to-edge.

**Signature Elements**:
1. Thick left-border accent on active states (4px solid amber)
2. Monospace font (`JetBrains Mono`) for all numeric data (qty, price, stock)
3. Subtle scanline texture overlay on the background (CSS repeating-gradient)

**Interaction Philosophy**: Every tap gives immediate tactile feedback via scale transform. No hover-only states — all interactions must work on touch. Long-press for secondary actions.

**Animation**: Snap transitions (100ms ease-out). Counter increments use a quick scale-up (1→1.15→1) on the number. Stock stroke color transitions are instant (no fade — urgency demands clarity).

**Typography System**:
- Display/Labels: `Space Grotesk` 700 — bold, technical
- Body/Secondary: `Space Grotesk` 400
- Numbers/Data: `JetBrains Mono` — all numeric values

</text>
</response>

<response>
<probability>0.06</probability>
<text>

## Idea B: "Neon Ledger" — Dark Glassmorphism with Electric Accents

**Design Movement**: Neo-Brutalism meets Dark Glass — the aesthetic of a concert venue's LED scoreboard

**Core Principles**:
1. Glass surfaces with strong depth — layered blur panels over the dark base
2. Electric accent colors from the Moshly gradient (`#6B5CFF` → `#C026D3`)
3. Large, bold typography for the tally counter — the number is the hero
4. Generous padding with tight information density in the grid

**Color Philosophy**: Moshly's native dark palette (`#0E0F14`, `#141624`, `#1B1E2E`) as the base. The `--gradient-primary` as the signature accent. Frosted glass cards (`rgba(27, 30, 46, 0.7)` + `backdrop-filter: blur(12px)`). Stock states use the existing semantic tokens (`--color-success`, `--color-warning`, `--color-error`) as glowing border strokes.

**Layout Paradigm**: Full-screen app shell with a bottom tab bar (mobile-first). Content zones use a 2-column asymmetric grid on tablet. Tally screen is a responsive card grid (2-col mobile, 3-col tablet, 4-col desktop).

**Signature Elements**:
1. Glowing border strokes on tally cards (stock state = glow color)
2. Large counter number with a subtle gradient text fill
3. Floating action bar at the bottom (CONFIRM SALE, CLEAR ALL, UNDO)

**Interaction Philosophy**: Tap feedback via ripple effect. Counter buttons are oversized (min 48px) for fat-finger safety. All critical actions require a visual confirmation state (button changes color on press).

**Animation**: Smooth 200ms transitions. Counter number uses a slot-machine style flip animation on increment. Stock glow pulses when at critical level (red + pulse keyframe).

**Typography System**:
- Display: `Syne` 800 — geometric, bold, concert-poster energy
- Body: `Inter` 400/500 — clean, readable
- Numbers: `Syne` 700 — consistent with display, large and impactful

</text>
</response>

<response>
<probability>0.05</probability>
<text>

## Idea C: "Pit Pass" — Tactical Dark with Warm Amber

**Design Movement**: Tactical UI / Military HUD meets Backstage Pass aesthetic

**Core Principles**:
1. Information is mission-critical — layout follows a strict visual hierarchy
2. Warm amber as the primary action color against the cold dark base
3. Card borders as the primary status communication channel (not badges or icons)
4. Typography is condensed and purposeful — no decorative elements

**Color Philosophy**: Cold dark base (Moshly tokens) + warm amber (`#F59E0B`) as the primary interactive color. This creates a deliberate tension — the cold environment of the venue, the warm urgency of the sale. Stock states are the only place where green/yellow/red appear, making them unmistakable.

**Layout Paradigm**: Top navigation bar with screen title + rep name. Full-bleed content. Tally grid uses a masonry-like layout where items with low stock are visually larger (more prominent). Bottom action strip is always visible.

**Signature Elements**:
1. Amber glow on primary action buttons
2. Card border thickness changes with stock level (2px normal → 3px warning → 4px critical)
3. Rep name always visible in top-right corner (accountability)

**Interaction Philosophy**: Immediate visual feedback. The [+] button is the most prominent element on each card. No confirmation dialogs for individual taps — only for CONFIRM SALE.

**Animation**: Counter number uses a quick bounce (scale 1→1.2→1, 150ms). CONFIRM SALE button has a loading state with a progress ring. Low stock cards have a subtle pulse animation.

**Typography System**:
- Display: `Barlow Condensed` 700 — compact, high-density, tactical
- Body: `Barlow` 400 — readable, consistent family
- Numbers: `Barlow Condensed` 800 — maximum visual weight for tally counts

</text>
</response>

---

## Selected Approach

**Idea B: "Neon Ledger"** — chosen for its direct alignment with the Moshly design tokens (dark base, purple-to-magenta gradient), its mobile-first bottom navigation (critical for tablet/phone use at shows), and the glowing stock stroke cards which make the stock status immediately visible in dark venues.
