export const RESTAURANT_IDS = ['CR3-diningroom', 'CR3-kitchen', 'CR2-kitchen', 'CR2-diningroom'] as const

export type RestaurantId = (typeof RESTAURANT_IDS)[number]

export type Restaurant = {
  id: RestaurantId
  name: string
  shortName: string
  description: string
}

export const RESTAURANTS: Record<RestaurantId, Restaurant> = {
  'CR3-diningroom': {
    id: 'CR3-diningroom',
    name: 'CR3 Dining Room',
    shortName: 'CR3 Dining',
    description: 'Front-of-house schedule for CR3.',
  },
  'CR3-kitchen': {
    id: 'CR3-kitchen',
    name: 'CR3 Kitchen',
    shortName: 'CR3 Kitchen',
    description: 'Back-of-house schedule for CR3.',
  },
  'CR2-kitchen': {
    id: 'CR2-kitchen',
    name: 'CR2 Kitchen',
    shortName: 'CR2 Kitchen',
    description: 'Back-of-house schedule for CR2.',
  },
  'CR2-diningroom': {
    id: 'CR2-diningroom',
    name: 'CR2 Dining Room',
    shortName: 'CR2 Dining',
    description: 'Front-of-house schedule for CR2.',
  },
}

export const DEFAULT_RESTAURANT: RestaurantId = 'CR3-diningroom'

export function isRestaurantId(value: unknown): value is RestaurantId {
  return typeof value === 'string' && (RESTAURANT_IDS as readonly string[]).includes(value)
}

export function assertRestaurantId(value: string): RestaurantId {
  if (!isRestaurantId(value)) throw new Error(`Unknown restaurant: ${value}`)
  return value
}
