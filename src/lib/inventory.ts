/**
 * CR3 supply inventory, transcribed from photos of the clipboard sheets (counts 10/1–10/8/2026).
 * Handwritten fixes on the sheets are applied; crossed-out rows are dropped.
 * Spellings are kept as printed so staff recognize the rows.
 * `gray` copies the printed row shading, which marks the rows originally printed as supplier L.
 */
export type InventoryItem = { id: string; name: string; sup: string; use: string; gray: boolean; note?: string }
export type InventorySheet = { id: string; title?: string; account?: string; useLabel: string; showSup: boolean; items: InventoryItem[] }
export type InventoryCell = { inv: string; order: string }
export type InventoryCounts = Record<string, InventoryCell>

export const CHECK = '✓'

const toId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// [name, sup, use, gray, note?]
type Row = [string, string, string, 0 | 1, string?]
const sheet = (id: string, rows: Row[], extra: Partial<InventorySheet> = {}): InventorySheet => ({
  id,
  useLabel: 'Use',
  showSup: true,
  ...extra,
  items: rows.map(([name, sup, use, gray, note]) => ({ id: toId(name), name, sup, use, gray: gray === 1, note })),
})

export const SHEETS: InventorySheet[] = [
  sheet('to-go', [
    ['Fortune Cookies', 'D', '1', 0],
    ['CUP HOLDER', 'L', '1/2', 1],
    ['GLOVE (XL)', 'L', '1', 1],
    ['GLOVE (MEDIUM)', 'L', '1', 1],
    ['Ice Tea Bag', 'L', '2', 1],
    ['Spic & Span', 'L', '1', 1],
    ['32 oz soda cup', 'L', '1', 1],
    ['24oz Soda Cup', 'L', '2', 1],
    ['Plasticware', 'L', '14', 1],
    ['#8 Bags', 'LC', '2', 0],
    ['#12 Bags', 'LC', '2', 0],
    ['60G Linear', 'L', '1', 1],
    ['30G Linear', 'L', '', 1],
    ['1oz Sauce Cup', 'L', '1/2', 1],
    ['1oz Sauce Cup Lid', 'L', '1/2', 1],
    ['Soup Cup (12SJ20)', 'L', '1', 1],
    ['Soup Cup Lid (20JL)', 'L', '1', 1],
    ['4oz Sauce Cup (4J6)', 'L', '1', 1],
    ['4oz Sauce Cup Lid (6JL)', 'L', '1', 1],
    ['Hand Soap', 'B', '1', 0],
    ['Toilet Paper', 'L', '1', 1],
    ['Brown Paper Towel', 'L', '2', 1],
    ['Sweet-N-Low', 'B', '1/2', 0],
    ['Straws', 'LC', '4', 0],
    ['T-Shirt Bag', 'D', '8', 0],
    ['ChopSticks', 'D', '1/2', 0],
    ['Napkins', 'LC', '6', 0],
    ['24oz Black Round Bowl', 'LC', '1', 0],
    ['Degreaser', '', '1', 0],
    ['Soup Spoons', 'L', '1/2', 1],
    ['ToGo Soy Sauce', 'D', '20', 0],
    ['ToGo Yellow Mustard', 'D', '2', 0],
    ['ToGo Duck Sauce', 'D', '4', 0],
    ['Egg Roll Bag', 'D', '2', 0],
  ]),
  sheet(
    'pepsi',
    [
      ['PEPSI', 'Pepsi', '6', 0],
      ['DIET PEPSI', 'Pepsi', '1', 0],
      ['STARRY', 'Pepsi', '2', 0],
      ['LEMONADE', 'Pepsi', '3', 0],
      ['BIG RED', 'Pepsi', '6', 0],
      ['DR. PEPPER', 'Pepsi', '4', 0],
      ['ROOT BEER', 'Pepsi', '1', 0],
    ],
    { title: 'PEPSI PRODCUTS', account: '3923058', useLabel: 'UNOPEN BOX', showSup: false },
  ),
  sheet(
    'sauces',
    [
      ['Hamburger Box', 'D/L', '2', 1],
      ['S-S Scraber', 'B', '', 0],
      ['EGG SHADE COLOR', 'D', '1/2', 0],
      ['Mushroom Dark Soy Sauce', 'D', '4', 0],
      ['Teriyaki sauce', 'D', '1', 0],
      ['Sriracha', 'D', '4', 0],
      ['Chili Garlic Sauce', 'D', '2', 0],
      ['Minced Garlic', 'D', '1', 0],
      ['Sesame Seed', 'D', '1', 0],
      ['Black Bean', 'D', '5', 0],
      ['Crushed Red Chili', 'D', '6', 0],
      ['Lemon Powder', 'L', '2', 1],
      ['White Pepper', 'D', '1/2', 0],
      ['Lea & Perins', 'L', '2', 1],
      ['A1 Sauce', 'L', '2', 1],
      ['Tamarino (SUNLEE)', 'B', '2', 0],
      ['Fish Sauce', 'B', '2', 0],
      ['Thick Soy Sauce', 'D', '4', 0],
      ['Holsin Sauce', 'D', '1', 0],
      ['Oyster Sauce', 'D', '1', 0],
      ['Lo Mein Noodles', 'D', '3', 0],
      ['Mushroom slice', 'D', '4', 0],
      ['Waterchestnuts', 'D', '4', 0],
      ['Bamboo Shoot Strips', 'D', '4', 0],
      ['Peanuts', 'L', '2', 1],
      ['Ketchup', 'D', '6', 0],
      ['Pineapples', 'D', '2', 1],
      ['5-Gal Soy Sauce', 'D', '3', 0],
      ['Salad Oil', 'D/L', '15', 1],
      ['Fry Oil', 'D', '8', 0],
      ['Cooking Sherry', 'D', '2', 0],
      ['Sesame Oil', 'D', '2', 0],
      ['White Vinegar', 'L', '3', 1],
      ['Whole Chili Pepper', 'D', '3', 0],
    ],
    { useLabel: 'SL' },
  ),
  sheet('dry-goods', [
    ['3-C Tray', 'D', '20', 0],
    ['Pad Thai Noodles (ITC)', 'D', '2', 0],
    ['24oz Soda Cup Lid', 'L', '1', 1],
    ['32 oz soda cup lid (20SL)', 'L', '1', 1],
    ['Soup Taste', 'B', '1/2', 0],
    ['Lemon Taste', 'B', '1/2', 0],
    ['S-S Pork Taste', 'B', '1/2', 0],
    ['Blue Taste', 'B', '2', 0],
    ['White Taste', 'L', '1', 1],
    ['Red Taste', 'L', '1', 1],
    ['Green Taste', 'L', '1/2', 1],
    ['Ajax Soap', 'B', '2', 0],
    ['Sugar', 'D', '8', 0],
    ['Rice', 'L/D', '15', 1],
    ['Corn Starch', 'D', '6', 0],
    ['Self Rising Flour', 'L', '2', 1],
    ['Flour', 'D', '1/2', 0],
    ['Dishwashing Detergent (Low Temp)', 'L', '1/2', 1],
    ['Dishwashing Sanitizer', 'L', '1/2', 1],
    ['Dishwashing Rinse', 'L', '1/2', 1],
    ['Noodle Bag', 'LC', '1', 0],
    ['Plastic Wrap', 'LC', '', 0],
    ['Food Storage Bag', 'LC', '', 1],
    ['Mop Head', 'B', '', 0],
    ['Squeezee', 'B', '', 0],
    ['Floor Scraber', 'B', '', 0],
    ['Bleach', 'L', '4', 1],
    ['409 Spray', 'B', '2', 0],
    ['POT DETERGENT', 'L', '1/2', 1],
  ]),
  sheet('cooler', [
    ['Egg', 'D/L', '5', 1],
    ['Buttom Mushroom', 'L', '5', 1],
    ['Pork', 'L', '1', 1],
    ['Beef', 'L', '6', 1],
    ['Chicken Breast', 'L', '10', 1],
    ['Lemon', 'L', '1/2', 1],
    ['Celery', 'B', '2', 0],
    ['Snow Pea', 'L', '1', 1],
    ['Green Onion', 'L', '8', 1],
    ['Bean Sprout', 'D', '6', 0],
    ['Lime', 'L', '1/2', 1],
    ['Ginger', 'D', '3', 0, '1 BAG'],
    ['Orange', 'L', '1/2', 1],
    ['Apple', 'L', '1/2', 1],
    ['Napa Cabbage', 'L', '1/2', 1],
    ['Broccoli', 'L', '6', 1],
    ['Bell Pepper (Medium)', 'L', '3', 1],
    ['Jumbo Yellow Onion', 'L', '4', 1],
    ['Jumbo Carrot', 'L', '2', 1],
    ['Cream Cheese', 'L', '3', 1],
  ]),
  sheet('freezer', [
    ['Boneless Chicken Wing (Sesame Chicken)', 'L', '30', 1],
    ['Egg Roll', 'L', '30', 1],
    ['LEMON CHICKEN', 'L', '36', 1],
    ['Beef Dumpling', 'L', '1', 1],
    ['Cheese Sterak Egg Roll', 'L', '1', 1],
    ['91/110 Shrimp', 'D', '3', 0],
    ['31/40 Shrimp', 'D', '3', 0],
    ['Egg Roll Skin', 'D', '3', 0],
    ['Wonton Skin', 'D', '3', 0],
    ['Crab Meat (Strip)', 'D/L', '2', 1],
  ]),
]

export const ITEMS = SHEETS.flatMap(s => s.items)

/** "3", "1/2", or "1 1/2" → number; anything else (✓, "3B/2T", blank) → null. */
export function parseAmount(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  const m = t.match(/^(?:(\d+(?:\.\d+)?)|(?:(\d+) )?(\d+)\/(\d+))$/)
  if (!m) return null
  if (m[1]) return Number(m[1])
  const denominator = Number(m[4])
  return denominator ? Number(m[2] ?? 0) + Number(m[3]) / denominator : null
}

/** Order enough to get back up to Use. ✓, blanks and counts like "3B/2T" get no suggestion. */
export function suggestOrder(use: string, inv: string): string {
  const target = parseAmount(use)
  const have = parseAmount(inv)
  if (target === null || have === null || have >= target) return ''
  return String(Math.ceil(target - have))
}

/** Every non-empty order, grouped by supplier in sheet order. */
export function ordersBySupplier(counts: InventoryCounts): { sup: string; lines: { item: InventoryItem; order: string }[] }[] {
  const groups = new Map<string, { item: InventoryItem; order: string }[]>()
  for (const item of ITEMS) {
    const order = counts[item.id]?.order.trim()
    if (!order) continue
    const sup = item.sup || 'No supplier'
    groups.set(sup, [...(groups.get(sup) ?? []), { item, order }])
  }
  return [...groups].map(([sup, lines]) => ({ sup, lines }))
}
