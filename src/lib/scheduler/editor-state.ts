import { formatTime } from './time'
import { DAYS, isValidRoleSlug, type DayOfWeek, type WeeklyStaffingTemplate } from './types'

// Mirrors the Worker's template checks (worker/src/index.ts) so a bad rule is caught here, not as a vague save error.
const MAX_SLOTS_PER_DAY = 20
const MAX_LABEL_CHARS = 60

export type RuleProblem = { day: DayOfWeek; index: number; message: string }

/** Every reason the Worker would refuse these rules, one per spot, in day order. */
export function templateProblems(template: WeeklyStaffingTemplate): RuleProblem[] {
  const problems: RuleProblem[] = []
  for (const day of DAYS) {
    const slots = template[day]
    if (slots.length > MAX_SLOTS_PER_DAY) {
      problems.push({ day, index: MAX_SLOTS_PER_DAY, message: `${day} has more than ${MAX_SLOTS_PER_DAY} spots.` })
    }
    slots.forEach((slot, index) => {
      const name = slot.label.trim() || `Spot ${index + 1}`
      let message = ''
      if (!slot.label.trim()) message = `${day}: spot ${index + 1} needs a label.`
      else if (slot.label.length > MAX_LABEL_CHARS) message = `${day} ${name}: label is longer than ${MAX_LABEL_CHARS} letters.`
      else if (!isValidRoleSlug(slot.role)) message = `${day} ${name}: pick a post.`
      else if (slot.end <= slot.start) {
        message = `${day} ${name}: ends at ${formatTime(slot.end)}, before it starts at ${formatTime(slot.start)}.`
      }
      if (message) problems.push({ day, index, message })
    })
  }
  return problems
}

/**
 * What staff see for this week compared with what is on screen.
 * - live: published, visible, and identical to the screen
 * - changed: published and visible, but the screen has edits staff cannot see yet
 * - hidden: published but turned off, so staff see nothing
 * - draft: never published — staff see nothing
 */
export type PublishState = 'live' | 'changed' | 'hidden' | 'draft'

export function publishState({
  published,
  fingerprintOnScreen,
  publishedFingerprint,
  visibleOnScreen,
}: {
  published: { visible: boolean } | null | undefined
  fingerprintOnScreen: string
  publishedFingerprint: string | null
  visibleOnScreen: boolean
}): PublishState {
  if (!published) return 'draft'
  const same = publishedFingerprint === fingerprintOnScreen && published.visible === visibleOnScreen
  if (!same) return 'changed'
  return published.visible ? 'live' : 'hidden'
}
