# Admin Theme — WCAG Contrast Audit

Source of truth: [`apps/admin/src/app/globals.css`](../src/app/globals.css).
Computed via WCAG 2.x relative-luminance formula (sRGB, no font-size assumption
unless noted). "AA-large" means the pair only passes for text ≥ 18pt regular or
≥ 14pt bold.

Date of audit: 2026-05-18.
Scope: every text-color × background-color pair actually used in
`apps/admin/src/**` (`grep var(--ur-text` + `var(--ur-(bg|surface|accent))`).

## TL;DR

- **Dark theme:** every body-text tier now passes AA on every surface; the
  decorative `--ur-text-faint` was the lowest and is now 3.18:1 (AA-large).
  Borders were raised so structural separation is visible and inputs/focus
  rings meet WCAG 1.4.11 / 2.4.7 (`--ur-border-strong` is 3.49:1 on `--ur-bg`).
- **Light theme:** body-text tiers are AA or AAA. The gold accent `#d4a850` on
  `#fff` is **2.21:1 (FAIL)** — intentional, because gold is a brand color used
  for icons, large headlines, and decorative chips, never for body copy.
  Components that put gold text on white surfaces must switch to
  `--ur-accent-dim` (`#a07830`, 4.02:1 — AA-large) or `#8a661f` (5.1:1, AA
  body), available via `prefers-contrast: more`.
- **High-contrast users** (`prefers-contrast: more`) get an AAA-tier override
  block: secondary text lifts to ≥ 7:1, structural borders to ≥ 3:1, and the
  focus ring goes opaque + thicker.

## Full ratio table

| Pair | Light ratio | Light verdict | Dark ratio | Dark verdict |
|---|---:|---|---:|---|
| `--ur-text` on `--ur-bg` | 17.74:1 | AAA | 17.39:1 | AAA |
| `--ur-text` on `--ur-surface` | 17.74:1 | AAA | 16.57:1 | AAA |
| `--ur-text` on `--ur-surface-soft` | 17.00:1 | AAA | 15.26:1 | AAA |
| `--ur-text-secondary` on `--ur-bg` | 10.31:1 | AAA | 13.43:1 | AAA |
| `--ur-text-secondary` on `--ur-surface` | 10.31:1 | AAA | 12.80:1 | AAA |
| `--ur-text-soft` on `--ur-bg` | 7.56:1 | AAA | 8.40:1 | AAA |
| `--ur-text-soft` on `--ur-surface` | 7.56:1 | AAA | 8.01:1 | AAA |
| `--ur-text-soft` on `--ur-surface-soft` | 7.24:1 | AAA | 7.37:1 | AAA |
| `--ur-text-muted` on `--ur-bg` | 4.83:1 | AA | 5.35:1 | AA |
| `--ur-text-muted` on `--ur-surface` | 4.83:1 | AA | 5.10:1 | AA |
| `--ur-text-faint` on `--ur-bg` | 1.47:1 | FAIL (decorative only) | 3.18:1 | AA-large |
| `--ur-accent` on `--ur-bg` | 2.21:1 | FAIL (brand, non-text use) | 8.97:1 | AAA |
| `--ur-accent` on `--ur-surface` | 2.21:1 | FAIL (brand, non-text use) | 8.55:1 | AAA |
| `--ur-accent` on `--ur-accent-soft` (10% on bg) | 2.05:1 | FAIL (decorative chip) | 7.85:1 | AAA |
| `--ur-accent-strong` on `--ur-bg` | 2.83:1 | FAIL | 6.98:1 | AA |
| `--ur-accent-dim` on `--ur-bg` | 4.02:1 | AA-large | 4.92:1 | AA |
| `--ur-success` on `--ur-bg` | 3.30:1 | AA-large | 8.69:1 | AAA |
| `--ur-warn` on `--ur-bg` | 3.19:1 | AA-large | 9.21:1 | AAA |
| `--ur-danger` on `--ur-bg` | 4.83:1 | AA | 5.26:1 | AA |
| `--ur-info` on `--ur-bg` | 5.17:1 | AA | 7.78:1 | AAA |
| `--ur-border` on `--ur-surface` | 1.24:1 | n/a* | 1.57:1 | n/a* |
| `--ur-border-soft` on `--ur-surface` | 1.10:1 | n/a* | 1.20:1 | n/a* |
| `--ur-border-strong` on `--ur-surface` | 1.47:1 | n/a* | 3.32:1 | passes 1.4.11 |
| `--ur-border` on `--ur-bg` | 1.24:1 | n/a* | 1.65:1 | n/a* |
| `--ur-border-strong` on `--ur-bg` | 1.47:1 | n/a* | 3.49:1 | passes 1.4.11 |
| `--ur-accent-ring` (focus) on `--ur-bg` | 2.01:1 | n/a* | 4.81:1 | passes 2.4.7 |

`* = non-text decorative dividers. WCAG only requires ≥ 3:1 for "graphical
objects essential to understanding" (input borders, focus rings, button
boundaries). Cosmetic dividers are exempt; we aim for ≥ 1.5:1 visual
separation as a perceptual minimum.`

## Changes made — DARK theme only

| Token | Before | After | Reason |
|---|---|---|---|
| `--ur-text-muted` | `#5a5a64` (2.90:1 FAIL) | `#84848f` (5.35:1 AA) | Body text tier was failing AA. New value keeps it perceptually muted vs `--ur-text-soft` (8.40:1) while crossing the 4.5:1 AA threshold for body copy on every surface. |
| `--ur-text-faint` | `#3a3a3e` (1.75:1 FAIL) | `#606068` (3.18:1 AA-large) | Used for hints, disabled labels, breadcrumbs. Bumped to AA-large (3:1) so it remains usable for ≥ 14pt-bold/18pt-regular text and is no longer invisible. |
| `--ur-text-soft` | `#8b8b96` (5.87:1 AA) | `#a8a8b3` (8.40:1 AAA) | Already passed AA but felt low-contrast (user complaint). Pushed to AAA so secondary copy reads comfortably for long-session admins. Still clearly secondary vs `--ur-text` (17.4:1). |
| `--ur-text-secondary` *(new)* | — | `#d4d4dc` (13.43:1 AAA) | Added a fourth tier between `text` and `text-soft` so the hierarchy doesn't collapse now that `text-soft` is brighter. |
| `--ur-border` | `#1e1e21` (1.19:1) | `#36363c` (1.65:1) | Cosmetic dividers were nearly invisible on `#0a0a0b`. New value gives a visible line without compromising the dark, refined feel. |
| `--ur-border-soft` | `#17171a` (1.11:1) | `#232327` (1.26:1) | Subtle group separator — kept intentionally faint, but no longer indistinguishable from the bg. |
| `--ur-border-strong` | `#2a2a2d` (1.38:1) | `#666670` (3.49:1) | Used on input fields, focus surfaces, and structural component boundaries. Pushed past the 3:1 WCAG 1.4.11 threshold for non-text UI components. |
| `--ur-accent-ring` | `rgba(212,168,80,0.35)` (2.01:1) | `rgba(212,168,80,0.7)` (4.81:1) | Focus indicator on `*:focus-visible`. WCAG 2.4.7 requires a visible focus indicator and 1.4.11 calls for 3:1. Now well above both. |

The gold (`--ur-accent`), green (`--ur-success`), red (`--ur-danger`), and amber
(`--ur-warn`) hues were **not** touched — only luminance / alpha values were
adjusted. Brand identity is preserved.

## Changes made — LIGHT theme

No production light-theme variables were changed in this pass. Light theme
body-text tiers all pass AA or AAA already (`--ur-text-soft` 7.56:1,
`--ur-text-muted` 4.83:1). Known structural issues that are **out of scope**
because they require component refactors rather than token changes:

- `--ur-accent` on `--ur-bg` (gold on white) is 2.21:1. This is the brand
  color; consuming components must use `--ur-accent-dim` (`#a07830`, 4.02:1
  AA-large) for any text role, or `#8a661f` (5.1:1 AA body) under
  `prefers-contrast: more`.
- Status hues `--ur-success` (3.30:1) and `--ur-warn` (3.19:1) are AA-large
  only on white. Acceptable for chips/badges where text is ≥ 14pt bold;
  small-caption usage should fall back to a darker shade.

## `prefers-contrast: more` overrides

Activated by macOS "Increase contrast," Windows High Contrast, or any browser
that honors the media query. Adds:

- Light theme: secondary text tiers jump to ≥ 4.8:1 (faint becomes AA body),
  `--ur-accent` is replaced with `#8a661f` (5.1:1 — readable gold), borders
  go to 2.6:1+ (visible edges).
- Dark theme: `--ur-text-faint` jumps from 3.2:1 → 8.4:1 (AAA), borders to
  2.9:1+, `--ur-border-strong` to 5.7:1, and the accent shifts to a brighter
  gold `#f0c060` (12.0:1) for crisp legibility.
- Focus ring widens from 2px → 3px with 3px offset.

This block sits at the bottom of `globals.css` and re-declares only the tokens
that change.

## How to verify

```bash
# Build must stay clean.
pnpm --filter admin build

# Visual diff: toggle theme + prefers-contrast in DevTools.
# Rendering pane → Emulate CSS media feature → prefers-contrast: more.
```

To re-run the math:

```python
def lin(c): return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
def L(rgb): r,g,b=[lin(c/255) for c in rgb]; return 0.2126*r+0.7152*g+0.0722*b
def ratio(a,b):
    la,lb=sorted([L(a),L(b)], reverse=True)
    return (la+0.05)/(lb+0.05)
```
