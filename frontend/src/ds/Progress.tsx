import { useId, useMemo, type HTMLAttributes } from 'react'

/* ★ミ( ･)ﾉ 'lab' is a TEMPORARY tone driven by --lab-a/b/c from the showcase.
   Remove it together with CrayonLab before the PR. */
type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'lab'
type Variant = 'plain' | 'crayon'

const tones: Record<Tone, string> = {
  primary: 'bg-[image:var(--gradient-progress)]',
  success: 'bg-[image:var(--gradient-success)]',
  warning: 'bg-[image:var(--gradient-warning)]',
  danger: 'bg-[image:var(--gradient-danger)]',
  lab: 'bg-[image:var(--gradient-progress)]',
}

/* (⟳ _◔) TONE SATURATION — which palette steps the crayon picks up.
   Triple: start, middle, end. Anything lighter than the cream-200 page
   background (L 0.845) disappears; one step darker reads.

   (⟳_◑) STRONGEST LEVER. Opacity can only go so far — real saturation
   comes from darker steps. Move the END first, keep the START pale: that
   preserves the pastel entry while giving the bar a readable finish.

   [░] → [▒] → [▓] → [█] (◔ ◑) Written as oklch(L C H) rather than palette
   vars so the crayon gamma can be tuned independently of the UI palette.
   L — lightness. Keep the end between 0.60 and 0.80: above 0.87 the page
       background swallows it, below 0.55 it stops being pastel.
   C — chroma. This is the "natural pigment" knob: 0.03-0.08 reads as
       crayon, above 0.12 it starts looking like a screen colour.
   H — hue, carried over from the matching palette family. */
const crayonStops: Record<Tone, [string, string, string]> = {
  primary: ['oklch(0.93 0.030 205)', 'oklch(0.76 0.065 196)', 'oklch(0.82 0.055 212)'],
  success: ['oklch(0.94 0.025 122)', 'oklch(0.84 0.050 122)', 'oklch(0.68 0.075 122)'],
  warning: ['oklch(0.94 0.045 90)', 'oklch(0.88 0.065 90)', 'oklch(0.74 0.090 90)'],
  danger: ['oklch(0.90 0.055 35)', 'oklch(0.82 0.080 35)', 'oklch(0.66 0.110 35)'],
  lab: ['var(--lab-a)', 'var(--lab-b)', 'var(--lab-c)'],
}

type OwnedAria = 'role' | 'aria-valuenow' | 'aria-valuemin' | 'aria-valuemax' | 'aria-label'

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, OwnedAria> {
  /** [░] → [▒] → [▓] → [█] (◔ ◑) FILL AMOUNT — 0-100, clamped.
      The one prop to change in the showcase to see the bar full or nearly
      empty: value={100}, value={3}. It scales the clip rect below; the
      hatching itself never moves, so the strokes stay put while the edge
      travels over them. */
  value: number
  tone?: Tone
  label: string
  variant?: Variant
}

const SKEW = -11.63
const STROKES = 26
const STEP = 12

/* [░] → [▒] → [▓] → [█] (◔ ◑) WHERE THE FILL STARTS AND ENDS.
   GROOVE is the clip shape. Its straight run x=15..303 with radius 13 puts
   the arcs on x≈4 and x≈316 — the same points the four pencil paths below
   reach, so the paint meets the drawn outline instead of stopping short.
   Verify in the inspector: the GROOVE path and the pencil arcs share both
   edges.
   X_START_BG / X_START_FG deliberately sit LEFT of that: strokes must
   overshoot so the rounded corner trims their tips. Start them on the
   border and the corner eats the first stroke, leaving a bald left edge. */
const GROOVE = 'M15,4 H303 A13,13 0 0 1 303,30 H15 A13,13 0 0 1 15,4 Z'
const X_START_BG = 0
const X_START_FG = 5
/* (⟳_◑) TRIED 2026-09-24: X_START_FG=14 (half-STEP from X_START_BG, matching
   the comment above literally) — reverted, read worse in practice. 5 stays
   the tuned value even though it breaks the "half a STEP" rule as written. */

/* (⟳ _◔) WASH DENSITY — flat tone between the strokes.
   Higher holds the colour together, lower lets the hatching fall apart.
   (⟳_◑) Above ~0.45 the hatching stops reading as strokes and turns into
   a plain fill — that is the ceiling for this one. */
const WASH_OPACITY = 0.27

/* [░] → [▒] → [▓] → [█] (◔ ◑) WASH SHAPE — rounded on the left, cut square
   on the right. The right end never shows: either the fill edge crosses it
   or GROOVE trims it. Swap V30 back for an arc if the bar ever needs a
   rounded tail of its own. */
const WASH = 'M15,4 H316 V30 H15 A13,13 0 0 1 15,4 Z'

/* (⟳ _◔) IRREGULARITY — how far each stroke drifts from the grid.
   Rolled once per mounted bar (see useMemo below), never in the render body:
   Math.random() there would hand out new values on every re-render and the
   hatching would twitch as the percentage changes.
   (⟳_◑) X_JITTER is what kills the machine-made look — a fraction of STEP,
   so 0.5 means a stroke can sit anywhere in half a gap either way. Past 0.6
   strokes start colliding into pairs. */
const X_JITTER = 0.5
const END_JITTER = 4
const LEAN_JITTER = 3
const BOW_JITTER = 2.5

/* (⟳ _◔) SKIPPED STROKES — the crayon lifting off the paper.
   (⟳_◑) 0.08 reads as an accident, 0.2 as a worn-down crayon. */
const SKIP_CHANCE = 0.08

/* [░] → [▒] → [▓] → [█] (◔ ◑) ENTRY RAMP — how many strokes at the left edge
   come in lighter and thinner, so the crayon eases onto the paper instead of
   starting square. This is a FADE, not a position: if the paint looks like it
   starts too far right, fix GROOVE and X_START_* above instead.
   (⟳_◑) 1-2 for a crisp entry, 5-6 for a long soft lead-in. */
const RAMP_STROKES = 3

/* (⟳ _◔) BACKGROUND STROKE LAYER — the first pass of the crayon.
   Wider, fainter, offset by half a step so the two passes interleave.
   (⟳_◑) Raising OPACITY_BASE toward 0.35 deepens the bar without touching
   the foreground. */
const BG_OPACITY_BASE = 0.18
const BG_OPACITY_SPREAD = 0.14
const BG_WIDTH_BASE = 3
const BG_WIDTH_SPREAD = 1.8

/* (⟳ _◔) FOREGROUND STROKE LAYER — the second pass, carries legibility.
   (⟳_◑) OPACITY_BASE + SPREAD usable up to about 0.75 total. Past that the
   stroke edges harden and the crayon starts looking like a marker. Widening
   WIDTH_SPREAD adds density more gently than opacity does. */
const FG_OPACITY_BASE = 0.32
const FG_OPACITY_SPREAD = 0.34
const FG_WIDTH_BASE = 1.6
const FG_WIDTH_SPREAD = 1.6

interface Stroke {
  d: string
  w: number
  o: number
}

/* A stroke bows slightly instead of running dead straight — a quadratic with
   a small control-point offset is enough for the hand to read as a hand. */
function roll(
  i: number,
  xBase: number,
  yTop: number,
  yBot: number,
  wBase: number,
  wSpread: number,
  oBase: number,
  oSpread: number
): Stroke {
  const j = (spread: number) => (Math.random() - 0.5) * spread
  const x = xBase + j(STEP * X_JITTER)
  const top = yTop + j(END_JITTER)
  const bot = yBot + j(END_JITTER)
  const lean = 7 + j(LEAN_JITTER)
  const cx = x + lean / 2 + j(BOW_JITTER)
  const cy = (top + bot) / 2
  const ramp = Math.min(1, (i + 1) / (RAMP_STROKES + 1))
  return {
    d: `M${x.toFixed(1)},${bot.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${(x + lean).toFixed(1)},${top.toFixed(1)}`,
    w: (wBase + Math.random() * wSpread) * (0.65 + ramp * 0.35),
    o: (oBase + Math.random() * oSpread) * ramp,
  }
}

/* Lives outside the component so the render body stays pure — the lint rule
   about impure calls is right in general; the useMemo call site below is the
   deliberate exception, and it fires once per mount. */
function rollHatching(): { bg: Stroke[]; fg: Stroke[] } {
  const bg: Stroke[] = []
  const fg: Stroke[] = []
  for (let i = 0; i < STROKES; i++) {
    if (Math.random() >= SKIP_CHANCE) {
      bg.push(roll(i, X_START_BG + i * STEP, 1, 33, BG_WIDTH_BASE, BG_WIDTH_SPREAD, BG_OPACITY_BASE, BG_OPACITY_SPREAD))
    }
    if (Math.random() >= SKIP_CHANCE) {
      fg.push(roll(i, X_START_FG + i * STEP, 2, 32, FG_WIDTH_BASE, FG_WIDTH_SPREAD, FG_OPACITY_BASE, FG_OPACITY_SPREAD))
    }
  }
  return { bg, fg }
}

export function Progress({
  value,
  tone = 'primary',
  label,
  variant = 'plain',
  className = '',
  ...rest
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  const uid = useId().replace(/:/g, '')

  const hatching = useMemo(() => rollHatching(), [])

  if (variant === 'crayon') {
    const [a, b, c] = crayonStops[tone]
    const gid = `cg-${uid}`
    const rid = `cr-${uid}`
    const wid = `cw-${uid}`
    return (
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={`w-full ${className}`}
        {...rest}
      >
        <svg viewBox="0 0 320 34" preserveAspectRatio="none" className="block h-8 w-full" aria-hidden="true">
          <defs>
            <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="2" y1="4" x2="312" y2="66">
              <stop offset="0" stopColor={a} />
              {/* (⟳ _◔) offset — where the middle tone sits. Closer to 0 accents the start.
                  (⟳_◑) Adding a fourth stop near 0.75 lets the bar darken late without
                  flattening the middle. */}
              <stop offset="0.1" stopColor={b} />
              <stop offset="1" stopColor={c} />
            </linearGradient>
            {/* Outer clip: the groove itself. Strokes may overshoot as much as they
                like — nothing escapes the pencil outline. */}
            <clipPath id={wid}>
              <path d={GROOVE} />
            </clipPath>
            {/* [░] → [▒] → [▓] → [█] (◔ ◑) Inner clip: how far the paint has got.
                Width comes straight from value; the skew keeps the leading edge
                parallel to the strokes instead of cutting them vertically. */}
            <clipPath id={rid}>
              <rect
                x="0"
                y="0"
                width={(pct / 100) * 324}
                height="34"
                transform={`translate(0,17) skewX(${SKEW}) translate(0,-17)`}
              />
            </clipPath>
          </defs>
          <path d="M14,5 C90,2 210,8 306,4" fill="none" stroke="var(--color-text-muted)" strokeWidth="0.9" opacity="0.65" strokeLinecap="round" />
          <path d="M10,29 C90,32 220,26 310,30" fill="none" stroke="var(--color-text-muted)" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
          <path d="M15,4 C6,8 4,16 5,24 C6,28 8,30 12,31" fill="none" stroke="var(--color-text-muted)" strokeWidth="0.9" opacity="0.6" strokeLinecap="round" />
          <path d="M305,3 C314,8 316,16 315,24 C314,28 312,30 308,31" fill="none" stroke="var(--color-text-muted)" strokeWidth="0.9" opacity="0.6" strokeLinecap="round" />
          {/* (⟳_◑) A third stroke pass would go here, offset by another 4px on x
              and kept under 0.2 opacity — three overlapping passes read as
              pressed-down crayon rather than a darker single layer. */}
          <g clipPath={`url(#${wid})`}>
            <g clipPath={`url(#${rid})`}>
              <path d={WASH} fill={`url(#${gid})`} opacity={WASH_OPACITY} />
              {hatching.bg.map((s, i) => (
                <path key={`bg-${i}`} d={s.d} stroke={`url(#${gid})`} strokeWidth={s.w} strokeLinecap="round" opacity={s.o} fill="none" />
              ))}
              {hatching.fg.map((s, i) => (
                <path key={`fg-${i}`} d={s.d} stroke={`url(#${gid})`} strokeWidth={s.w} strokeLinecap="round" opacity={s.o} fill="none" />
              ))}
            </g>
          </g>
        </svg>
      </div>
    )
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-2 w-full overflow-hidden rounded-full bg-track shadow-[var(--shadow-track-inset)] ${className}`}
      {...rest}
    >
      <div
        className={`h-full rounded-r-full transition-[width] duration-300 ease-out ${pct > 0 ? 'min-w-2.5' : ''} ${tones[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}