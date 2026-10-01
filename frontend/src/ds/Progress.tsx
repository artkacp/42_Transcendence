import { useId, useMemo, type HTMLAttributes } from 'react'

// (◕_◕) Progress is crayon-only. The plain bar (and the warning tone it
// carried) lives under the git tag ds-progress-plain-v1.
type Tone = 'primary' | 'success' | 'danger'
type CrayonSize = 'md' | 'sm'

/* (⟳ _◔) TONE SATURATION — the crayon gradient stops, written as oklch(L C H)
   so the crayon gamma is tunable independently of the UI palette.
   L — lightness. Anything above 0.87 is swallowed by the cream-200 page
       background; below 0.55 it stops being pastel.
   C — chroma, the pigment knob. 0.03-0.08 reads as crayon and 0.12 is about
       where it starts looking like a screen colour. danger deliberately runs
       past that, up to 0.21, so the bar rhymes with the Danger button which
       sits on --color-danger-600 (L 0.385).
   H — hue, carried over from the matching palette family. Exception:
       success borrows primary hue 218 for its mid-stop on purpose, a blue
       glint inside the green.
   warning has no crayon tone: too light on cream to read as pigment.

   (⟳ ◑) These are the values the tone lab in the design kit produced. To
   retune, open Lab mode there, adjust, hit Save final and paste the block
   over this one. */
const crayonStops: Record<Tone, [string, string, string]> = {
  primary: ['oklch(0.6 0.12 218)', 'oklch(0.855 0.06 218)', 'oklch(0.48 0.135 218)'],
  success: ['oklch(0.875 0.065 122)', 'oklch(0.6 0.12 218)', 'oklch(0.595 0.105 122)'],
  danger: ['oklch(0.82 0.145 35)', 'oklch(0.82 0.145 35)', 'oklch(0.385 0.21 35)'],
}

type OwnedAria =
  | 'role'
  | 'aria-valuenow'
  | 'aria-valuemin'
  | 'aria-valuemax'
  | 'aria-label'

type BaseProps = Omit<HTMLAttributes<HTMLDivElement>, OwnedAria> & {
  value: number
  label: string
  crayonStopsOverride?: [string, string, string]
}

export type ProgressProps = BaseProps & {
  tone?: Tone
  size?: CrayonSize
}

const SKEW = -11.63

/*
 * (◕_◕) CRAYON SIZES — NEW
 *
 * sm is the same drawing, not a squashed one. The viewBox height stays 34;
 * a thinner bar gets a longer viewBox instead, so strokes keep their lean
 * and spacing and the whole picture scales down uniformly.
 *
 *   md: 320 units long, drawn at h-8 (32px)
 *   sm: 320 * 32 / 20 = 512 units, drawn at h-5 (20px)
 *
 * 20px is the floor: at 12-16px a 1x screen blends the strokes into a
 * smooth gradient and the crayon is gone. weight thickens sm strokes a
 * little so pigment survives the smaller scale; spread can space them out.
 * Every x coordinate below that used to be hardcoded for 320 is now
 * measured from the right end with len, so md renders exactly as before.
 */
interface CrayonGeometry {
  len: number
  className: string
  weight: number
  spread: number
}

// (◕_◕) NEW — sm tuning knobs: raise SPREAD for sparser hatching,
// raise WEIGHT for bolder strokes
const SM_SPREAD = 1
const SM_WEIGHT = 1.4

const CRAYON_SIZES: Record<CrayonSize, CrayonGeometry> = {
  md: { len: 320, className: 'h-8', weight: 1, spread: 1 },
  sm: { len: 512, className: 'h-5', weight: SM_WEIGHT, spread: SM_SPREAD },
}

// CHANGE: denser, thinner hatching reads more like crayon texture.
const STROKES = 34
const BASE_LEN = 320 // md length the stroke constants were tuned on
const STEP = 9

// (◕_◕) CHANGED — was a fixed 320-long path
const groove = (len: number) =>
  `M15,4 H${len - 17} A13,13 0 0 1 ${len - 17},30 H15 A13,13 0 0 1 15,4 Z`
const X_START_BG = 0
const X_START_FG = 5

const WASH_OPACITY = 0.27
// (◕_◕) CHANGED — was a fixed 320-long path
const wash = (len: number) => `M15,4 H${len - 4} V30 H15 A13,13 0 0 1 15,4 Z`

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
const DARK_DENSITY = 3.9


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
// (◕_◕) CHANGED — distance from the right end, was x = 286 on a 320 bar
const END_CAP_INSET = 34

// CHANGE: keep the cap slightly softer than a flat solid fill.
const END_CAP_OPACITY = 0.92

// CHANGE: the cap's final edge follows the same lean as the crayon strokes.
const END_CAP_SKEW = SKEW

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
  oSpread: number,
  rampStrokes: number,
  weight: number,
  step: number
): Stroke {
  const j = (spread: number) => (Math.random() - 0.5) * spread

  const x = xBase + j(step * X_JITTER)
  const top = yTop + j(END_JITTER)
  const bot = yBot + j(END_JITTER)

  const lean = 7 + j(LEAN_JITTER)
  const cx = x + lean / 2 + j(BOW_JITTER)
  const cy = (top + bot) / 2

  // CHANGE: first 12 strokes build pigment gradually.
  // (◕_◕) CHANGED — ramp length now comes from the size, 12 in md
  const ramp = Math.min(1, (i + 1) / (rampStrokes + 1))

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
    // (◕_◕) CHANGED — scaled by weight so sm strokes stay visible
    w:
      ((wBase + Math.random() * wSpread) *
        (0.35 + ramp * 0.65) +
        darkWidth) *
      weight,

    // CHANGE: light pigment fades in gradually.
    o: Math.min(
      0.72,
      (oBase + Math.random() * oSpread) * ramp
    ),
  }
}

// (◕_◕) CHANGED — stroke count and ramp follow the bar length
function rollHatching(len: number, weight: number, spread: number): Hatching {
  const bg: Stroke[] = []
  const fg: Stroke[] = []

  const step = STEP * spread
  const strokes = Math.round((len - 14) / step)
  // ramp covers the same share of the bar in every size (12 of 34 in md)
  const rampStrokes = Math.round((strokes * RAMP_STROKES) / STROKES)

  for (let i = 0; i < strokes; i++) {
    const ramp = Math.min(1, (i + 1) / (rampStrokes + 1))

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
          X_START_BG + i * step,
          1,
          33,
          BG_WIDTH_BASE,
          BG_WIDTH_SPREAD,
          BG_OPACITY_BASE,
          BG_OPACITY_SPREAD,
          rampStrokes,
          weight,
          step
        )
      )
    }

    if (Math.random() >= SKIP_CHANCE) {
      fg.push(
        roll(
          i,
          X_START_FG + i * step,
          2,
          32,
          FG_WIDTH_BASE,
          FG_WIDTH_SPREAD,
          FG_OPACITY_BASE,
          FG_OPACITY_SPREAD,
          rampStrokes,
          weight,
          step
        )
      )
    }

    // CHANGE: overlap dark strokes without increasing global density.
    for (let repeat = 0; repeat < darkRepeats; repeat++) {
      const offset = (Math.random() - 0.5) * step

      bg.push(
        roll(
          i,
          X_START_BG + i * step + offset,
          1,
          33,
          BG_WIDTH_BASE,
          BG_WIDTH_SPREAD,
          BG_OPACITY_BASE,
          BG_OPACITY_SPREAD,
          rampStrokes,
          weight,
          step
        )
      )

      fg.push(
        roll(
          i,
          X_START_FG + i * step + offset,
          2,
          32,
          FG_WIDTH_BASE,
          FG_WIDTH_SPREAD,
          FG_OPACITY_BASE,
          FG_OPACITY_SPREAD,
          rampStrokes,
          weight,
          step
        )
      )
    }
  }

  return { bg, fg }
}

export function Progress({
  value,
  tone = 'primary',
  label,
  size = 'md',
  crayonStopsOverride,
  className = '',
  ...rest
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  const uid = useId().replace(/:/g, '')

  // (◕_◕) CHANGED — geometry depends on size, so hatching re-rolls with it
  const { len, className: heightClass, weight, spread } = CRAYON_SIZES[size]

  const hatching = useMemo(
    () => rollHatching(len, weight, spread),
    [len, weight, spread]
  )

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
        viewBox={`0 0 ${len} 34`}
        preserveAspectRatio="none"
        className={`block ${heightClass} w-full`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1="2"
            y1="4"
            x2={len - 8}
            y2="66"
          >
            <stop offset="0" stopColor={a} />
            <stop offset="0.1" stopColor={b} />
            <stop offset="1" stopColor={c} />
          </linearGradient>

          <clipPath id={grooveClipId}>
            <path d={groove(len)} />
          </clipPath>

          <clipPath id={fillClipId}>
            <rect
              x="0"
              y="0"
              width={(pct / 100) * (len + 4)}
              height="34"
              transform={`translate(0,17) skewX(${SKEW}) translate(0,-17)`}
            />
          </clipPath>
        </defs>

        <path
          d={`M14,5 C${(len * 90) / BASE_LEN},2 ${(len * 210) / BASE_LEN},8 ${len - 14},4`}
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth={0.9 * weight}
          opacity="0.65"
          strokeLinecap="round"
        />

        <path
          d={`M10,29 C${(len * 90) / BASE_LEN},32 ${(len * 220) / BASE_LEN},26 ${len - 10},30`}
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth={0.8 * weight}
          opacity="0.55"
          strokeLinecap="round"
        />

        <path
          d="M15,4 C6,8 4,16 5,24 C6,28 8,30 12,31"
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth={0.9 * weight}
          opacity="0.6"
          strokeLinecap="round"
        />

        <path
          d={`M${len - 15},3 C${len - 6},8 ${len - 4},16 ${len - 5},24 C${len - 6},28 ${len - 8},30 ${len - 12},31`}
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth={0.9 * weight}
          opacity="0.6"
          strokeLinecap="round"
        />

        <g clipPath={`url(#${grooveClipId})`}>
          <g clipPath={`url(#${fillClipId})`}>
            <path
              d={wash(len)}
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

            {/* CHANGE: the end cap keeps the hatch angle but extends far enough
                to fully cover the rounded end of the groove. */}
            <path
              d={`M${len - END_CAP_INSET},4 H${len} V30 H${len - END_CAP_INSET} Z`}
              transform={`translate(0,17) skewX(${END_CAP_SKEW}) translate(0,-17)`}
              fill={`url(#${gradientId})`}
              opacity={END_CAP_OPACITY}
            />
          </g>
        </g>
      </svg>
    </div>
  )
}
