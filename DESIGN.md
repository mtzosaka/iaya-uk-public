---
name: IAYA UK
description: A bridge of knowledge between Iraq and the United Kingdom, in the language of Mesopotamian heritage.
colors:
  cream-ground: "#f7f2e4"
  sand-panel: "#ece3c9"
  ivory-surface: "#fffcf3"
  midnight-ink: "#0d1a38"
  slate-muted: "#4a546b"
  burnished-gold: "#7a5600"
  euphrates-teal: "#0f7f73"
  lapis: "#16409a"
  night-ground: "#081329"
  night-panel: "#0f2350"
  parchment-ink: "#f4efe2"
  mist-muted: "#aeb8cf"
  lamp-gold: "#eec76b"
  night-teal: "#2bb3a3"
typography:
  display:
    fontFamily: "Fraunces, serif"
    fontSize: "clamp(44px, 7vw, 92px)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  display-arabic:
    fontFamily: "Reem Kufi, Cairo, sans-serif"
    fontSize: "clamp(40px, 6.4vw, 84px)"
    fontWeight: 700
    lineHeight: 1.35
  headline:
    fontFamily: "Fraunces, serif"
    fontSize: "clamp(32px, 4.2vw, 52px)"
    fontWeight: 600
    lineHeight: 1.1
  title:
    fontFamily: "Fraunces, serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Figtree, Cairo, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.75
  body-arabic:
    fontFamily: "Cairo, Figtree, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.9
  label:
    fontFamily: "Figtree, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.09em"
rounded:
  pill: "99px"
  panel: "16px"
  frame: "12px"
  arch: "999px 999px 14px 14px"
  mission-arch: "220px 220px 16px 16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "24px"
  lg: "48px"
  xl: "80px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.burnished-gold}"
    textColor: "{colors.cream-ground}"
    rounded: "{rounded.pill}"
    padding: "11px 26px"
    height: "50px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.burnished-gold}"
    rounded: "{rounded.pill}"
    padding: "11px 26px"
    height: "50px"
  mission-panel:
    backgroundColor: "{colors.lapis}"
    textColor: "#ffffff"
    rounded: "{rounded.mission-arch}"
    padding: "104px 44px 48px"
  event-panel:
    backgroundColor: "{colors.lapis}"
    textColor: "#ffffff"
    rounded: "{rounded.panel}"
    padding: "44px"
  arch-panel:
    backgroundColor: "{colors.sand-panel}"
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.arch}"
    padding: "84px 26px 30px"
---

# Design System: IAYA UK

## Overview

**Creative North Star: "The Bridge of Knowledge"**

The site presents the Iraqi Academic Youth Association UK as a formal academic institution with a Mesopotamian inheritance. Its world comes from the architecture and crafts of Baghdad: arches and iwans, lapis lazuli and gold, the eight-point star of geometric tilework. These are set inside a calm, editorial reading structure. The signature image is a bridge drawn from London to Baghdad, captioned with the association's line "Knowledge brings us together".

The voice is formal and elegant in both languages. English display type is a confident serif; Arabic display type is Kufic in character, so the Arabic page is a first-class reading experience with its own typographic identity, not a mirrored translation.

Light and dark both belong to the system and follow the visitor's device until the visitor chooses: cream and burnished gold by day, navy and lamp gold by night. The previous editorial-only implementation remains on branch `backup/pre-rebuild-2026-10-12`; this system restores the heritage world from commit `8cc27eb` on the rebuilt structure, at the owner's request.

**Key Characteristics:**
- Faint eight-point star tile under every page.
- Arch silhouettes for the mission statement, the areas of work and the committee portraits.
- Lapis fields carry the mission and the event; gold carries headings, rims and the bridge.
- Formal, institutional copy in English and Arabic.
- One authored motion: the bridge arc draws itself once on load.

## Colors

A heritage palette of lapis, gold and Euphrates teal on cream (light) or navy (dark).

### Primary
- **Burnished Gold** (#7a5600 light) / **Lamp Gold** (#eec76b dark): section headings, primary pill buttons, rims of portraits and pills, the bridge arc, timeline rules, links.

### Secondary
- **Lapis** (#16409a): the mission arch and the event panel, in both themes. Text on lapis is white; highlights on lapis always use Lamp Gold (#eec76b), whatever the theme.

### Tertiary
- **Euphrates Teal** (#0f7f73 light) / **Night Teal** (#2bb3a3 dark): bridge deck and end nodes, timeline nodes, guest and member rules. Decorative and structural only; never body text.

### Neutral
- **Cream Ground** (#f7f2e4) / **Night Ground** (#081329): page background.
- **Sand Panel** (#ece3c9) / **Night Panel** (#0f2350): membership band, arch-panel wash, image placeholders.
- **Ivory Surface** (#fffcf3) / Night Panel: forms, account panels, the open mobile menu.
- **Midnight Ink** (#0d1a38) / **Parchment Ink** (#f4efe2): body text and the English hero headline.
- **Slate Muted** (#4a546b) / **Mist Muted** (#aeb8cf): supporting copy.

### Named Rules
**The Lapis Field Rule.** Lapis is a field, never an accent: it fills whole panels (mission, event, "All events" link) and nothing smaller.

**The Gold on Lapis Rule.** Inside a lapis field, gold is always Lamp Gold (#eec76b). Burnished Gold on lapis fails contrast.

## Typography

**Display Font:** Fraunces (English), Reem Kufi (Arabic)
**Body Font:** Figtree (English), Cairo (Arabic)

**Character:** A literary serif and a Kufic display face share one formal register. Body faces stay quiet and highly legible.

### Hierarchy
- **Display** (600, clamp(44px, 7vw, 92px), 1.04): the association's name in the hero. In Arabic, Reem Kufi 700 in gold at line-height 1.35.
- **Headline** (600, clamp(32px, 4.2vw, 52px), 1.1): section headings, always in gold.
- **Title** (600, 22–34px): arch panels, the event title, news headlines, timeline names.
- **Body** (400, 17px, 1.75; Arabic 1.9): paragraphs, measure 56–65ch.
- **Label** (11px, 0.09em tracking, uppercase): the brand line in the header only.

### Named Rules
**The Kufic Voice Rule.** Arabic headings use Reem Kufi; Arabic body text uses Cairo. Don't set Arabic headings in the English serif.

## Layout

The content container is 1280px wide with 48px side padding (32px at 1100px and below, 22px below 768px, 16px below 381px). Sections breathe at 96px vertically (80px at tablet sizes, 64px on mobile). Two-column compositions (about, invitation, contact, news) collapse to one column below 768px. The areas of work run 4, 2, then 1 across; the timeline 6, 3, 2, then 1; the committee 6, 5, 4, 3, then 2. On desktop, alternate committee portraits drop 28px to form a gentle arcade rhythm. The header collapses to a menu below 1024px, and the menu always includes "Join the Association".

## Elevation & Depth

The system is flat. Depth comes from tonal fields (lapis on ground, sand bands), the faint star tile, a soft radial glow behind the hero, and fine gold rules, never from drop shadows. The mission arch carries an inner gold outline inset 12px.

## Shapes

The arch is the governing form: fully rounded tops over 12–16px base corners, for the areas of work, portraits and initials (`999px 999px 12px 12px`) and the mission panel (`220px 220px 16px 16px`, 160px on mobile). Controls are pills (99px). Panels and posters use 12–16px corners. Rules are 1px gold hairlines, or 2px for timelines and guest lists.

## Components

### Buttons
- **Shape:** pill (99px), 50px tall (44px in the header).
- **Primary:** gold fill with ground-coloured text.
- **Secondary:** transparent with a gold border and gold text; hover fills with the sand panel colour.
- **Press:** scale(.97). Transitions ≤220ms on cubic-bezier(.23,1,.32,1).

### Header controls
- Theme, language and menu are 44px gold-outlined pills; hover fills them with gold.

### Navigation
- Ink links at 15px; the current page is gold and underlined. Below 1024px the menu opens as a full-width ivory or night panel, and focus moves into it.

### The Bridge (signature)
- An inline SVG arch from London (west, 8%) to Baghdad (east, 92%) over a teal deck, with six gold pillars and HTML place labels. The caption "Knowledge brings us together" / «المعرفة تجمعنا» sits below in gold. The arc draws once over 2.4s; with reduced motion it is shown complete.

### Mission arch
- A lapis field with an arched top, white serif statement (Cairo 600 in Arabic) and an inner gold outline.

### Event panel
- A lapis field: Lamp Gold metadata, white serif title, agenda rows on white hairlines with gold times, and the poster framed in Lamp Gold.

### Timeline
- "A legacy of science": six entries on a gold rule with teal nodes; gold years, serif names (Kufic in Arabic) and muted fields.

### Inputs / Fields
- 8px corners, a #7d7a6c / #8296a8 border, ground-coloured fill, gold caret and focus ring.

## Do's and Don'ts

### Do:
- **Do** keep every heading gold and every Arabic heading in Reem Kufi.
- **Do** use Lamp Gold (#eec76b) for anything gold inside lapis.
- **Do** follow the device's light or dark setting until the visitor chooses a theme.
- **Do** keep copy formal in both languages: full institutional names, no slang, headings without full stops.
- **Do** keep real, supplied names, dates and photographs only (see PRODUCT.md).

### Don't:
- **Don't** add drop shadows, glassmorphism or gradient text.
- **Don't** use teal for body text or small text.
- **Don't** animate anything beyond the bridge draw and short interaction feedback.
- **Don't** add statistics blocks or invented metrics.
