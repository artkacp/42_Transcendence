import { type CSSProperties } from 'react'
import { Progress } from '../ds'

/* ★ミ( ･)ﾉ FINAL crayon tones — three bars, read-only.
   [░] → [▒] → [▓] → [█] (◔ ◑) Values were picked in the tone lab and baked in
   here. Sea & sky / dune grass / sand & sunset — the dunes photo the palette
   came from. Warning is deliberately absent: four pastels in a row stopped
   reading as separate states.
   To re-tune, switch the showcase to Lab mode, adjust, hit Save final and
   paste the block over FINAL_STOPS. */

type Triple = [number, number, number]
type ToneName = 'primary' | 'success' | 'danger'

const css = (l: number, c: number, h: number) => `oklch(${l} ${c} ${h})`
/* ★ミ( ･)ﾉ FINAL crayon tones — three bars, read-only.*/
const FINAL_STOPS: Record<ToneName, [Triple, Triple, Triple]> = {
  primary: [
    [0.6, 0.12, 218],
    [0.855, 0.06, 218],
    [0.48, 0.135, 218],
  ],
  success: [
    [0.875, 0.065, 122],
    [0.6, 0.12, 218],
    [0.595, 0.105, 122],
  ],
  danger: [
    [0.82, 0.145, 35],
    [0.82, 0.145, 35],
    [0.385, 0.21, 35],
  ],
  }
const TONES: ToneName[] = ['primary', 'success', 'danger']

export function ToneSwatches() {
  return (
    <div className="w-full max-w-sm space-y-3">
      {TONES.map((tone) => {
        const [a, b, c] = FINAL_STOPS[tone]
        return (
          <Progress
            key={tone}
            value={100}
            variant="crayon"
            tone="lab"
            label={`Crayon, ${tone}`}
            style={
              {
                '--lab-a': css(...a),
                '--lab-b': css(...b),
                '--lab-c': css(...c),
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
}