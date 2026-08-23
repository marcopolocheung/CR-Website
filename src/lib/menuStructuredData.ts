import {
  formatMenuItemName,
  parsePrice,
  toId,
  type MenuCategory,
  type MenuItem,
  type MenuSection,
} from '@/lib/menuUtils'
import { absoluteUrl, SITE_NAME } from '@/lib/seo'

const MENU_PATH = '/menu'

function menuItemNode(item: MenuItem) {
  const price = parsePrice(item.price)

  return {
    '@type': 'MenuItem',
    name: formatMenuItemName(item.name),
    ...(item.description ? { description: item.description } : {}),
    ...(price === null
      ? {}
      : {
          offers: {
            '@type': 'Offer',
            price: price.toFixed(2),
            priceCurrency: 'USD',
          },
        }),
  }
}

function menuSectionNode(section: MenuSection) {
  return {
    '@type': 'MenuSection',
    name: formatMenuItemName(section.subcategory),
    hasMenuItem: section.items.map(menuItemNode),
  }
}

function menuCategoryNode(category: MenuCategory, menuUrl: string) {
  // A blank subcategory is the generator's way of saying "no grouping", so
  // those items hang off the category rather than an unnamed MenuSection.
  const ungrouped = category.sections.filter((section) => !section.subcategory)
  const grouped = category.sections.filter((section) => section.subcategory)

  return {
    '@type': 'MenuSection',
    '@id': `${menuUrl}#${toId(category.category)}`,
    name: formatMenuItemName(category.category),
    ...(grouped.length > 0 ? { hasMenuSection: grouped.map(menuSectionNode) } : {}),
    ...(ungrouped.length > 0
      ? { hasMenuItem: ungrouped.flatMap((section) => section.items).map(menuItemNode) }
      : {}),
  }
}

/**
 * The menu as structured data, so a crawler or an assistant can answer "what
 * does China Rose serve and what does it cost" without parsing the page. Lives
 * on /menu, the one canonical copy — both location pages point here.
 */
export function menuJsonLd(menu: MenuCategory[]) {
  const menuUrl = absoluteUrl(MENU_PATH)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Menu',
        '@id': `${menuUrl}#menu`,
        name: `${SITE_NAME} Menu`,
        url: menuUrl,
        inLanguage: 'en-US',
        hasMenuSection: menu.map((category) => menuCategoryNode(category, menuUrl)),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${menuUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Menu', item: menuUrl },
        ],
      },
    ],
  }
}
