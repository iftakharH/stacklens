---
name: StackLens
description: Read the work, not the resume — a deterministic developer reading of a public GitHub profile.
colors:
  field: "#0b0e17"
  field-deep: "#070911"
  plate: "#121726"
  plate-raised: "#18202f"
  ink: "#edf1f8"
  ink-2: "#c2cad9"
  muted: "#8d97ab"
  line: "#232c3f"
  line-strong: "#3a465f"
  signal: "#d7f24b"
  signal-soft: "#2a3410"
  signal-ink: "#0b0e17"
  danger: "#ff9a9a"
typography:
  display:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontVariation: "wdth 118, wght 800"
    fontSize: "clamp(2.15rem, 5.6vw, 4.1rem)"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.028em"
  headline:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontVariation: "wdth 112, wght 800"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.018em"
  body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0em"
  label:
    fontFamily: "Martian Mono Variable, ui-monospace, SFMono-Regular, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.14em"
  measure:
    fontFamily: "Martian Mono Variable, ui-monospace, SFMono-Regular, monospace"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.015em"
    fontFeature: "tnum"
rounded:
  none: "0"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "56px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.signal-ink}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "44px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.field}"
  button-framed:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "44px"
  field-input:
    backgroundColor: "{colors.field-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "48px"
---

# Design System: StackLens

## Overview

**Creative North Star: "The Calibration Card"**

StackLens is a measuring instrument, and the interface is the card it prints on. A single
hairline frame holds the whole page; a woven graticule runs underneath everything; tick
scales are the only separators; every number sits on a calibrated scale in tabular mono.
Nothing is boxed, because a printed chart does not put a rectangle around every field.

The world came from refusing the category's default. Production tooling sites ship a
near-black hero with a neon accent, glowing edges, gradient text, and a row of equal
feature cards. That look says "developer tool" and nothing else. This world says
"instrument that already took a reading": it shows the offer working in the first
viewport, and it earns trust by demonstrating determinism rather than asserting it.

Two registers run in parallel. Archivo at a wide, heavy setting is the plate lettering —
headlines, field titles, buttons, navigation. Martian Mono is reserved for measurement —
numbers, scales, captions, the edge rail. Colour is drenched, not sprinkled: one cold
field owns the page, one datum accent marks what is measured, and GitHub's own language
colours are the only other saturation present, because that colour *is* the data.

**Key Characteristics:**
- One outer frame per surface; no bordered containers inside it, and never a nested one.
- Hairline tick scales and graticule instead of dividers, cards, and shadows.
- Tabular mono for every measured value; wide grotesque caps for every label of authority.
- Drenched cold field with exactly one datum accent, used at page scale and never as glow.
- Motion is one acquisition event, not scattered effects; final state under reduced motion.

## Colors

A cold instrument field with a single reference-level accent; all other saturation belongs
to language data.

The two theme blocks in `frontend/src/index.css` are the normative source: `:root` is the
light card under room light, `.dark` is the instrument at night. Frontmatter records the
dark values, which is the primary register.

### Primary
- **Reference-Level Lime** (`#d7f24b` dark, `#4c6008` light): the datum accent. It marks
  what has been measured or what will measure — the primary button, the needle tip, the
  band chip, the unit labels in the measures ledger, the current band outline. It is never
  used for large fills, never for text emphasis on body copy, and never as a glow.
- **Signal Ink** (`#0b0e17`): the ink that sits on lime. Never white on lime.

### Neutral
- **Instrument Field** (`#0b0e17`): the page ground. Cold and blue-violet biased on
  purpose, so the accent sits on a colour rather than on a void.
- **Field Deep** (`#070911`): recessed wells — input interiors, the code block in the
  error boundary, the dialog scrim base.
- **Plate** (`#121726`): raised plates that carry a control group or the sign-in panel.
- **Plate Raised** (`#18202f`): the top step of the plate ramp and the vignette colour.
- **Ink** (`#edf1f8`): headings, values, primary text.
- **Ink Second** (`#c2cad9`): long-form body copy, ledger values at secondary weight.
- **Muted** (`#8d97ab`): captions, labels, meta. Passes 4.5:1 on the field; it is never
  used for body copy.
- **Hairline** (`#232c3f`): the graticule, tick scales, ledger rules.
- **Hairline Strong** (`#3a465f`): the frame, control outlines, scale tracks.

### Tertiary (data only)
- **GitHub Linguist colours**: supplied by `frontend/src/lib/languages.ts`. They are the
  only place a reader sees red, pink, purple, or green, and they are never invented,
  re-tinted, or used decoratively.

### Named Rules
**The One Datum Rule.** The accent is lime for the single thing being measured or the
single action that measures. If two elements both deserve it, one of them is decoration —
remove the accent, not the element.

**The Never Colour-Only Rule.** Any reading carried by colour also prints its name and its
number. The spectrum always ships with its printed scale; the band chip always prints the
band.

**The No Glow Rule.** No zero-offset halos, no coloured bloom behind elements. The only
moving light in the system is the acquisition sweep, and it is one 1.1s pass per reading.

## Typography

**Display Font:** Archivo Variable (variable width axis, set at 112–118% width)
**Body Font:** Archivo Variable
**Label / Measure Font:** Martian Mono Variable

**Character:** A plate lettering voice and a readout voice, and nothing in between. Archivo
carried wide and heavy reads as something stamped onto an instrument face; Martian Mono
carried small and widely tracked reads as the engraved scale beside it. The pairing only
works while each stays in its register.

### Hierarchy
- **Display** (800, `clamp(2.15rem, 5.6vw, 4.1rem)`, 0.94, uppercase): the one headline on
  a surface. Never more than one per page, never inside a nested container.
- **Headline** (800, `clamp(1.5rem, 3vw, 2.25rem)`, 1.02, uppercase): section titles and
  route headings.
- **Field Title** (800, `clamp(0.95rem, 1.5vw, 1.15rem)`, 1.02, uppercase): the name on a
  measured field inside a report.
- **Body** (400, 15–17px, 1.6–1.65, sentence case): prose at a 52–68ch measure. Report body
  copy steps to 17px for the summary only.
- **Measure** (400–600, 11–26px, tabular numerals): every number, percentage, count, and
  score. Never used for prose.
- **Label** (500, 9–10px, 0.13–0.14em, uppercase mono): field captions, meta, the edge rail.

### Named Rules
**The Mono Measures Rule.** Martian Mono appears only where a number is measured, a scale is
drawn, or a code is stamped. Prose set in mono is a costume, not a reading.

**The One Display Rule.** Display type is uppercase, wide, and heavy, and it may appear once
per surface. Section titles step down to the headline register so the page has one entry
point rather than several.

## Layout

One frame per surface, inset from the viewport edge by 12–32px, carrying four corner
registration marks, a top edge-code rail, and a bottom edge rail. Content sits inside that
frame on a 56px graticule. Sections are separated by full-bleed hairlines with 56px tick
scales, never by cards and never by extra containers.

The measure is 52–68ch for prose. Report fields use one of three shapes only: a full-width
band (summary, headline counts, spectrum), a two-column pair whose heights are within about
15% of each other, or a single-column ledger. Two-column pairs collapse to a single stack
below `lg` (1024px); the frame's side padding steps 16 → 28 → 56px from mobile to desktop.

Vertical rhythm is generous and even: 56px between sections, 24–40px inside a field, and
more space above a heading than below it.

## Elevation & Depth

Flat by default, and depth is drawn rather than shadowed. The system conveys layering with
four devices and no others: a brightness step between field, plate and raised plate; a
hairline outline; a tick scale that steps forward at 56px intervals; and the vignette behind
the top of the field, which reads as light falling on the card.

Shadow exists only on `.plate` (the sign-in panel, the sign-in dialog) and only to lift a
single float above the field, never to decorate a section.

- **Plate lift** (`0 1px 0 rgba(255,255,255,0.04), 0 20px 44px -24px #000000`): the one
  plate that floats — a panel that is genuinely separate from the card.
- **Focus ring** (`0 0 0 3px color-mix(in srgb, var(--signal) 22%, transparent)`): focus
  only, paired with the 2px accent outline.

### Named Rules
**The Drawn Depth Rule.** If a region needs to feel closer, step its brightness up or give
it a hairline. A shadow on a section is a tell that the section should have been a field.

## Shapes

Square, without exception. Zero border radius on frames, plates, buttons, inputs, chips,
avatars, and spectrum patches. Corners carry the printed-chart reading; a rounded corner
would make the card a UI card.

Borders are always 1px hairlines. The only other stroke weights are the 2px accent needle
and the 2px active-nav underline. The one dashed outline in the system is the empty field,
which marks an absent reading rather than a container.

Recurring geometry: concentric circles with a 60-tick graduation ring (the hero's
registration dial), 10% graduations across the spectrum band, and 4-corner registration
marks on the frame and on every plate.

## Components

### Buttons
- **Shape:** square (0 radius), 1px hairline outline, uppercase mono-spaced label at 0.07em.
- **Primary:** lime fill, dark ink, 44px tall (`btn-primary`). Used once per surface for the
  action that takes the reading.
- **Framed (secondary):** transparent with a hairline outline; hover raises to the plate
  colour and the ink edge.
- **Hover / Focus:** border and fill step; 160ms. Focus adds a 2px accent outline with a 3px
  offset ring. Disabled primary drops to an outline with muted label — never faded lime.
- **Small:** 36px tall, 12px label, for in-ledger actions.

### Chips
- **Style:** square, 1px hairline or accent outline, 9–10px mono caps inside.
- **State:** the band chip uses the accent outline because it is the reading; secondary
  language chips use the hairline.

### Fields
- **Corner Style:** square.
- **Background:** control plates sit on the plate colour; inputs sit on field-deep.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Border:** hairline, or hairline-strong for a frame that must read as interactive.
- **Internal Padding:** 16–24px for plates, 14px horizontal for inputs.

### Inputs / Fields
- **Style:** 1px hairline-strong outline on a field-deep well, mono at 14px, 48px tall.
- **Focus:** outline removed, border switches to the accent, 3px accent ring, well lightens
  to the field colour.
- **Error / Disabled:** error text in the danger colour with a 1px danger rule beside it;
  disabled drops to 55% opacity and a not-allowed cursor.

### Navigation
- **Style:** mono caps at 10px on the top edge rail; the active route carries a 2px accent
  underline inside the link's own box. The wordmark is a lens mark plus the name in plate
  caps, with the tagline set in body type after a hairline.
- **Mobile:** the tagline and the secondary nav link drop out; the primary action, the auth
  control and the theme toggle stay.

### Signature: The Calibrated Scale
The system's one bespoke readout. A 1px track with a graduation at every integer, a taller
band-boundary tick at each threshold (3, 5, 7, 8.5), and a 2px accent needle with a small
head. The needle arrives damped from zero in 900ms and never snaps. The thresholds print
beneath the track; the band that applies is named once, in the chip. A score is therefore
always read as a position between printed boundaries, not as a bare number.

### Signature: The Spectrum Band
The language mix, drawn as a band of GitHub Linguist colours with 10% graduations laid over
it, resolving left to right on acquisition. It always ships with a printed scale carrying
each language's name and percentage, either as a wrapped row or as a ruled column with a
per-language hairline bar for narrow placements.

## Do's and Don'ts

### Do:
- **Do** put every surface inside the single frame, with registration marks and edge rails.
- **Do** separate regions with tick scales and hairlines; the 56px graticule is the rhythm.
- **Do** set every number in tabular Martian Mono and every measured reading on a scale.
- **Do** print the name and the number beside anything coloured, so colour is never the only
  carrier of the reading.
- **Do** reserve the accent for the thing being measured or the action that measures it.
- **Do** let the field own the viewport; step brightness to build depth.

### Don't:
- **Don't** put a border, card, or panel around a content section inside the frame, and
  never nest one container inside another.
- **Don't** round a corner. Radius is 0 everywhere, including chips and avatars.
- **Don't** add a kicker or eyebrow above a heading; headings carry their own weight.
- **Don't** use gradient text, glass, blurred chrome, or a coloured halo for emphasis.
- **Don't** set prose in mono, or use mono as a shorthand for "technical".
- **Don't** scatter entrance animation; there is one acquisition pass per reading, and it
  resolves to the final state instantly under `prefers-reduced-motion`.
- **Don't** invent colour outside the token set and GitHub Linguist data.
