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

export function getMenuPreviewSections(menu: MenuCategory[]): MenuPreviewSection[] {
  const featuredCategories = ['COMBO MEALS', 'RICE / NOODLES', 'CHINA ROSE BOWLS']

  return featuredCategories
    .map((categoryName) => menu.find((category) => category.category === categoryName))
    .filter((category): category is MenuCategory => Boolean(category))
    .map((category) => ({
      category: category.category,
      href: `/menu#${toId(category.category)}`,
      items: category.sections.flatMap((section) => section.items).slice(0, 4),
    }))
}

export function parsePrice(price: string | null): number | null {
  if (!price) return null
  const num = parseFloat(price.replace(/[^0-9.]/g, ''))
  return isNaN(num) ? null : num
}

export const LOCATION_CONFIG: Record<string, { display: string; code: string }> = {
  'w-military': { display: 'W Military Dr', code: 'CR3' },
  'sw-military': { display: 'SW Military Dr', code: 'CR2' },
}
