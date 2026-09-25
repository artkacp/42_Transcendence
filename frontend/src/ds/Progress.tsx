import { useId, useMemo, type HTMLAttributes } from 'react'

type Tone = 'primary' | 'success' | 'warning' | 'danger'
type Variant = 'plain' | 'crayon'

const tones: Record<Tone, string> = {
  primary: 'bg-[image:var(--gradient-progress)]',
  success: 'bg-[image:var(--gradient-success)]',
  warning: 'bg-[image:var(--gradient-warning)]',
  danger: 'bg-[image:var(--gradient-danger)]',
}

/* (⟳ _◔) TONE SATURATION — the crayon gradient stops, written as oklch(L C H)
   so the crayon gamma is tunable independently of the UI palette.
   L — lightness. Anything above 0.87 is swallowed by the cream-200 page
       background; below 0.55 it stops being pastel.
   C — chroma, the pigment knob. 0.03-0.08 reads as crayon and 0.12 is about
       where it starts looking like a screen colour. danger deliberately runs
       past that, up to 0.21, so the bar rhymes with the Danger button which
       sits on --color-danger-600 (L 0.385).
   H — hue, carried over from the matching palette family.

   (⟳ ◑) These are the values the tone lab in the design kit produced. To
   retune, open Lab mode there, adjust, hit Save final and paste the block
   over this one. */
const crayonStops: Record<Tone, [string, string, string]> = {
  primary: ['oklch(0.6 0.12 218)', 'oklch(0.855 0.06 218)', 'oklch(0.48 0.135 218)'],
  success: ['oklch(0.875 0.065 122)', 'oklch(0.6 0.12 218)', 'oklch(0.595 0.105 122)'],
  warning: ['oklch(0.94 0.045 90)', 'oklch(0.88 0.065 90)', 'oklch(0.74 0.09 90)'],
  danger: ['oklch(0.82 0.145 35)', 'oklch(0.82 0.145 35)', 'oklch(0.385 0.21 35)'],
}

type OwnedAria =
  | 'role'
  | 'aria-valuenow'
  | 'aria-valuemin'
  | 'aria-valuemax'
  | 'aria-label'

export interface ProgressProps
  extends Omit<HTMLAttributes<HTMLDivElement>, OwnedAria> {
  value: number
  tone?: Tone
  label: string
  variant?: Variant
  crayonStopsOverride?: [string, string, string]
}

const SKEW = -11.63

// CHANGE: denser, thinner hatching reads more like crayon texture.
const STROKES = 34
const STEP = 9

const GROOVE = 'M15,4 H303 A13,13 0 0 1 303,30 H15 A13,13 0 0 1 15,4 Z'
const X_START_BG = 0
const X_START_FG = 5

const WASH_OPACITY = 0.27
const WASH = 'M15,4 H316 V30 H15 A13,13 0 0 1 15,4 Z'

// CHANGE: slight horizontal variation keeps dense strokes organic.
const X_JITTER = 0.5

// CHANGE: endpoint movement keeps strokes hand-drawn.
const END_JITTER = 4

// CHANGE: lean variation breaks repeated parallel rhythm.
const LEAN_JITTER = 3

// CHANGE: curve variation prevents a rigid pattern.
const BOW_JITTER = 2.5

// CHANGE: lower skip rate keeps the texture dense.
const SKIP_CHANCE = 0.05

// CHANGE: long ramp keeps the first ~25% soft and naturally blended.
const RAMP_STROKES = 12

const BG_OPACITY_BASE = 0.18
const BG_OPACITY_SPREAD = 0.18

// CHANGE: thin background strokes reduce the felt-tip look.
const BG_WIDTH_BASE = 1.8
const BG_WIDTH_SPREAD = 1.2

const FG_OPACITY_BASE = 0.32
const FG_OPACITY_SPREAD = 0.40

// CHANGE: thin foreground strokes create a finer pencil texture.
const FG_WIDTH_BASE = 0.85
const FG_WIDTH_SPREAD = 0.9

/*
 * DARK-END DENSITY
 *
 * Increase DARK_DENSITY if the dark end feels too sparse.
 * Increase DARK_WIDTH_* if it needs more physical weight.
 * Increase DARK_RANDOMNESS if dense strokes become too regular.
 *
 * (￣▽￣)ゞ The goal is continuous pigment, not isolated dark lines.
 */
const DARK_START = 0.72

// CHANGE: increase this for more overlap near 100%.
const DARK_DENSITY = 7

// CHANGE: increase these only if the dark pigment needs more weight.
const DARK_WIDTH_BASE = 1.0
const DARK_WIDTH_SPREAD = 1.0

// CHANGE: increase this if dense dark strokes become too regular.
const DARK_RANDOMNESS = 0.35

/*
 * FINAL END CAP
 *
 * This is not another hatch layer.
 * It closes the remaining rounded X range with the same pigment gradient.
 *
 * (◔_◔) No extra "stripe" — just finish the material at the groove edge.
 */

// CHANGE: move left to close more of the final rounded groove section.
const END_CAP_START = 286

// CHANGE: keep the cap slightly softer than a flat solid fill.
const END_CAP_OPACITY = 0.92

interface Stroke {
  d: string
  w: number
  o: number
}

interface Hatching {
  bg: Stroke[]
  fg: Stroke[]
}

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

  // CHANGE: first 12 strokes build pigment gradually.
  const ramp = Math.min(1, (i + 1) / (RAMP_STROKES + 1))

  const darkRamp =
    ramp > DARK_START
      ? (ramp - DARK_START) / (1 - DARK_START)
      : 0

  // CHANGE: dark strokes gain controlled weight near the end.
  const darkWidth =
    darkRamp *
    (DARK_WIDTH_BASE + Math.random() * DARK_WIDTH_SPREAD)

  // CHANGE: dark strokes keep slight positional irregularity.
  const darkJitter =
    darkRamp * Math.random() * DARK_RANDOMNESS

  return {
    d: `M${(x + j(darkJitter)).toFixed(1)},${bot.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${(x + lean + j(darkJitter)).toFixed(1)},${top.toFixed(1)}`,

    // CHANGE: light strokes stay thin; dark strokes gain controlled weight.
    w:
      (wBase + Math.random() * wSpread) *
        (0.35 + ramp * 0.65) +
      darkWidth,

    // CHANGE: light pigment fades in gradually.
    o: Math.min(
      0.72,
      (oBase + Math.random() * oSpread) * ramp
    ),
  }
}

function rollHatching(): Hatching {
  const bg: Stroke[] = []
  const fg: Stroke[] = []

  for (let i = 0; i < STROKES; i++) {
    const ramp = Math.min(1, (i + 1) / (RAMP_STROKES + 1))

    const darkRamp =
      ramp > DARK_START
        ? (ramp - DARK_START) / (1 - DARK_START)
        : 0

    // CHANGE: dark-end density comes from overlapping strokes,
    // not one extremely dark stroke.
    const darkRepeats =
      darkRamp > 0
        ? Math.round(darkRamp * (DARK_DENSITY - 1))
        : 0

    if (Math.random() >= SKIP_CHANCE) {
      bg.push(
        roll(
          i,
          X_START_BG + i * STEP,
          1,
          33,
          BG_WIDTH_BASE,
          BG_WIDTH_SPREAD,
          BG_OPACITY_BASE,
          BG_OPACITY_SPREAD
        )
      )
    }

    if (Math.random() >= SKIP_CHANCE) {
      fg.push(
        roll(
          i,
          X_START_FG + i * STEP,
          2,
          32,
          FG_WIDTH_BASE,
          FG_WIDTH_SPREAD,
          FG_OPACITY_BASE,
          FG_OPACITY_SPREAD
        )
      )
    }

    // CHANGE: overlap dark strokes without increasing global density.
    for (let repeat = 0; repeat < darkRepeats; repeat++) {
      const offset = (Math.random() - 0.5) * STEP

      bg.push(
        roll(
          i,
          X_START_BG + i * STEP + offset,
          1,
          33,
          BG_WIDTH_BASE,
          BG_WIDTH_SPREAD,
          BG_OPACITY_BASE,
          BG_OPACITY_SPREAD
        )
      )

      fg.push(
        roll(
          i,
          X_START_FG + i * STEP + offset,
          2,
          32,
          FG_WIDTH_BASE,
          FG_WIDTH_SPREAD,
          FG_OPACITY_BASE,
          FG_OPACITY_SPREAD
        )
      )
    }
  }

  return { bg, fg }
}

const NO_HATCHING: Hatching = {
  bg: [],
  fg: [],
}

export function Progress({
  value,
  tone = 'primary',
  label,
  variant = 'plain',
  crayonStopsOverride,
  className = '',
  ...rest
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  const uid = useId().replace(/:/g, '')

  const hatching = useMemo(
    () => (variant === 'crayon' ? rollHatching() : NO_HATCHING),
    [variant]
  )

  if (variant === 'crayon') {
    const [a, b, c] = crayonStopsOverride ?? crayonStops[tone]

    const gradientId = `cg-${uid}`
    const fillClipId = `cr-${uid}`
    const grooveClipId = `cw-${uid}`

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
        <svg
          viewBox="0 0 320 34"
          preserveAspectRatio="none"
          className="block h-8 w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1="2"
              y1="4"
              x2="312"
              y2="66"
            >
              <stop offset="0" stopColor={a} />
              <stop offset="0.1" stopColor={b} />
              <stop offset="1" stopColor={c} />
            </linearGradient>

            <clipPath id={grooveClipId}>
              <path d={GROOVE} />
            </clipPath>

            <clipPath id={fillClipId}>
              <rect
                x="0"
                y="0"
                width={(pct / 100) * 324}
                height="34"
                transform={`translate(0,17) skewX(${SKEW}) translate(0,-17)`}
              />
            </clipPath>
          </defs>

          <path
            d="M14,5 C90,2 210,8 306,4"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="0.9"
            opacity="0.65"
            strokeLinecap="round"
          />

          <path
            d="M10,29 C90,32 220,26 310,30"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="0.8"
            opacity="0.55"
            strokeLinecap="round"
          />

          <path
            d="M15,4 C6,8 4,16 5,24 C6,28 8,30 12,31"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="0.9"
            opacity="0.6"
            strokeLinecap="round"
          />

          <path
            d="M305,3 C314,8 316,16 315,24 C314,28 312,30 308,31"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="0.9"
            opacity="0.6"
            strokeLinecap="round"
          />

          <g clipPath={`url(#${grooveClipId})`}>
            <g clipPath={`url(#${fillClipId})`}>
              <path
                d={WASH}
                fill={`url(#${gradientId})`}
                opacity={WASH_OPACITY}
              />

              {hatching.bg.map((stroke, index) => (
                <path
                  key={`bg-${index}`}
                  d={stroke.d}
                  stroke={`url(#${gradientId})`}
                  strokeWidth={stroke.w}
                  strokeLinecap="round"
                  opacity={stroke.o}
                  fill="none"
                />
              ))}

              {hatching.fg.map((stroke, index) => (
                <path
                  key={`fg-${index}`}
                  d={stroke.d}
                  stroke={`url(#${gradientId})`}
                  strokeWidth={stroke.w}
                  strokeLinecap="round"
                  opacity={stroke.o}
                  fill="none"
                />
              ))}

              {/* CHANGE: solid end cap closes the rounded groove section.
                  It follows the same gradient instead of adding more strokes. */}
              <path
                d={`M${END_CAP_START},4 H303 A13,13 0 0 1 303,30 H${END_CAP_START} Z`}
                fill={`url(#${gradientId})`}
                opacity={END_CAP_OPACITY}
              />
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
        className={`h-full rounded-r-full transition-[width] duration-300 ease-out ${
          pct > 0 ? 'min-w-2.5' : ''
        } ${tones[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}