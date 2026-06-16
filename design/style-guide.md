# Yuno — Style Guide (measured from y.uno)

Tokens below are pulled from `getComputedStyle` on the live homepage (2026-06-15), not
guessed. Screenshots: `design/home.png`, `design/home-full.png`.

## Character (one line)

Clean fintech: **white canvas, generous whitespace, oversized light-weight display type, a
strong indigo primary with a lime "pop" accent, soft lavender tints, hairline borders, and
gently rounded cards with subtle shadows.** The homepage hero even renders a node-graph
orchestration diagram — our workflow canvas should lean into that.

## Type

- **Family:** `"Titillium Web", Impact, system-ui, sans-serif` (Google Font — load weights 300/400/600/700).
- **Headings are large and *light*:** display H1/H2 ~48–57px at weight **400** (not bold) — this restraint is the signature.
- **Body:** ~14–16px, weight 400, line-height ~1.5, color ink.
- **Letter-spacing:** normal.

## Color tokens

```css
:root {
  /* brand */
  --y-primary:        #3E4FE0; /* indigo — primary actions, links, active states */
  --y-primary-700:    #2E3CB8; /* hover/pressed */
  --y-primary-100:    #E8EAF5; /* lavender tint — soft button bg, chips, selected rows */
  --y-primary-50:     #F2F4FC; /* faint indigo wash for sections */
  --y-accent:         #E0ED80; /* lime — sparing highlight: badges, "live" dots, success pop */

  /* ink + text */
  --y-ink:            #282A30; /* near-black slate — headings + body */
  --y-text-muted:     #6C6F75; /* secondary text */
  --y-text-faint:     #92959B; /* tertiary / placeholder */

  /* surfaces */
  --y-bg:             #FFFFFF; /* page */
  --y-surface:        #FCFCFF; /* cards */
  --y-surface-2:      #F6F7FA; /* subtle panel / table header */
  --y-surface-lav:    #DBDFF1; /* deeper lavender accent surface */

  /* lines + status */
  --y-border:         #ECEFF2; /* hairline borders, dividers */
  --y-success:        #1FA971;
  --y-warning:        #E6A23C;
  --y-danger:         #E5484D;

  /* shape */
  --y-radius:         8px;     /* default controls */
  --y-radius-lg:      16px;    /* cards */
  --y-radius-pill:    999px;   /* CTAs, tags, avatars */

  /* spacing rhythm (4px base) */
  --y-space-1: 4px; --y-space-2: 8px; --y-space-3: 12px; --y-space-4: 16px;
  --y-space-6: 24px; --y-space-8: 32px; --y-space-12: 48px;

  /* elevation */
  --y-shadow-sm: 0 1px 2px rgba(40,42,48,.06), 0 1px 3px rgba(40,42,48,.04);
  --y-shadow-md: 0 6px 24px rgba(40,42,48,.08);
}
```

## Components (observed patterns)

- **Primary CTA:** indigo `--y-primary` background, white text, **pill** radius, weight 400–600,
  comfortable padding (~12px 20px). Hover → `--y-primary-700`.
- **Secondary button:** `--y-primary-100` lavender background, ink text, 8px radius, hairline border.
- **Cards:** white/`--y-surface`, 16px radius, `--y-shadow-md`, hairline border, airy padding (24px).
- **Nav:** white bar, ink links, lowercase indigo wordmark, one pill CTA on the right.
- **Density:** airy. Lean on whitespace over dividers; use `--y-border` hairlines, not heavy rules.

## Usage rules for the build

1. Default to Yuno's choices: white canvas, indigo primary, lime *only* as a small accent (status dots, "live" badges).
2. Large headings stay **light weight** — resist bolding them.
3. Cards float (shadow + 16px radius); controls are 8px; CTAs/tags are pills.
4. Don't lift Yuno's logo or imagery — reproduce the *system* (type, color, spacing, shape).
