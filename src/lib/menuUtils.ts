export function toId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export type MenuItem = {
  name: string
  image?: string
  price: string | null
  description: string | null
}

export type MenuSection = {
  subcategory: string
  items: MenuItem[]
}

export type MenuCategory = {
  category: string
  sections: MenuSection[]
}

export type MenuPreviewSection = {
  category: string
  href: string
  items: MenuItem[]
}

export function formatMenuItemName(name: string) {
  return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

const FEATURED_CATEGORIES = ['COMBO MEALS', 'RICE / NOODLES', 'CHINA ROSE BOWLS']

const PREVIEW_ITEM_LIMIT = 4

// Takes the first item of each subcategory before the second of any, so
// RICE / NOODLES previews rice, lo mein and pad thai rather than four kinds of
// fried rice. Flattening first would show only whichever subcategory sorts
// earliest, which is what the adjacent copy promises against.
function sampleAcrossSections(sections: MenuSection[], limit: number): MenuItem[] {
  const deepest = Math.max(0, ...sections.map((section) => section.items.length))
  const picked: MenuItem[] = []

  for (let index = 0; index < deepest && picked.length < limit; index += 1) {
    for (const section of sections) {
      if (picked.length >= limit) break
      const item = section.items[index]
      if (item) picked.push(item)
    }
  }

  return picked
}

export function getMenuPreviewSections(menu: MenuCategory[]): MenuPreviewSection[] {
  return FEATURED_CATEGORIES.map((categoryName) => {
    const category = menu.find((entry) => entry.category === categoryName)

    // menu.json is generated. Silently dropping a renamed category would ship
    // an empty preview, so break the build instead.
    if (!category) {
      throw new Error(
        `Menu preview category "${categoryName}" is not in menu.json. ` +
          `Available: ${menu.map((entry) => entry.category).join(', ')}`,
      )
    }

    return {
      category: category.category,
      href: `/menu#${toId(category.category)}`,
      items: sampleAcrossSections(category.sections, PREVIEW_ITEM_LIMIT),
    }
  })
}

export function parsePrice(price: string | null): number | null {
  if (!price) return null
  const num = parseFloat(price.replace(/[^0-9.]/g, ''))
  return isNaN(num) ? null : num
}

export const LOCATION_CONFIG: Record<string, { display: string; code: string }> = {
  'w-military': { display: 'Military Location', code: 'CR3' },
  'sw-military': { display: 'Zarzamora Location', code: 'CR2' },
}
