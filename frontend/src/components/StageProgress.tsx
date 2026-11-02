// src/components/StageProgress.tsx
// Where an adoption stands, as a small crayon bar with a visible label. Texts differ for owner and adopter.
import type { InquiryStage } from '../data/types'
import { Progress } from '../ds'

type Stage = InquiryStage | 'adopted'
type Viewer = 'owner' | 'adopter'

const STEPS: Record<Stage, { step: number; tone: 'primary' | 'success' | 'danger' | 'warning'; text: Record<Viewer, string> }> = {
  conversation: { step: 1, tone: 'primary', text: { owner: 'Talking', adopter: 'Talking' } },
  visit: { step: 2, tone: 'primary', text: { owner: 'Visit planned', adopter: 'Visit planned' } },
  decision: { step: 3, tone: 'warning', text: { owner: 'Decision', adopter: 'Owner deciding' } },
  adopted: { step: 4, tone: 'success', text: { owner: 'Adopted ✓', adopter: 'Adopted ✓' } },
  denied: { step: 4, tone: 'danger', text: { owner: 'Declined', adopter: 'Not this time' } },
}

export function StageProgress({ stage, viewer }: { stage: Stage; viewer: Viewer }) {
  const { step, tone, text } = STEPS[stage]
  const shown = text[viewer]
  const valueText =
    stage === 'denied' ? shown : stage === 'adopted' ? 'Step 4 of 4: Adopted' : `Step ${step} of 4: ${shown}`

  return (
    <div className="flex w-full min-w-0 basis-full flex-col gap-1">
      {/* the bar's aria-valuetext carries the same words */}
      <span aria-hidden="true" className="text-xs font-medium text-text-muted">
        {shown}
      </span>
      <Progress
        value={step * 25}
        tone={tone}
        label="Adoption progress"
        aria-valuetext={valueText}
        fluid
      />
    </div>
  )
}
