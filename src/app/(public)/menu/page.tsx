import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import menuData from '@/data/menu.json'
import { toId } from '@/lib/menuUtils'

export const metadata: Metadata = {
  title: 'China Rose Menu | San Antonio Chinese Restaurant',
  description: 'Browse the China Rose menu for both San Antonio locations, including combo meals, bowls, fried rice, lo mein, soups, sides, and drinks.',
}

type MenuItem = { name: string; image?: string; price: string | null; description: string | null }
type Section  = { subcategory: string; items: MenuItem[] }
type Category = { category: string; sections: Section[] }

const data = menuData as Category[]

const featuredDishes = [
  'Lemon Chicken Combo Meal',
  'Sesame Chicken Combo Meal',
  'Beef Broc Combo Meal',
]

function formatItemName(name: string) {
  return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function ItemCard({ item }: { item: MenuItem }) {
  const itemName = formatItemName(item.name)

  return (
    <div className="flex gap-4 items-start bg-white rounded-xl shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
      {item.image && (
        <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100">
          <Image
            src={item.image}
            alt={itemName}
            fill
            sizes="96px"
            className="object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex-1 min-w-0 py-1">
        <p className="font-semibold text-gray-900 text-sm leading-snug capitalize">
          {itemName}
        </p>
        {item.description && (
          <p className="text-xs text-gray-500 mt-1 leading-snug">{item.description}</p>
        )}
        {item.price && (
          <p className="text-red-700 font-bold text-sm mt-2">{item.price}</p>
        )}
      </div>
    </div>
  )
}

export default function MenuPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-red-800 mb-2">China Rose Menu</h1>
      <div className="space-y-3 text-gray-600 mb-8">
        <p>
          Browse the China Rose menu for both San Antonio locations. The same menu is available at
          W Military Dr and SW Military Dr.
        </p>
        <p className="text-sm">Prices are current as provided by the restaurant and availability may change.</p>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Featured dishes</h2>
        <ul className="grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
          {featuredDishes.map((dish) => (
            <li key={dish}>{dish}</li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Choose a location to order</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/locations/w-military"
            className="text-center bg-red-700 hover:bg-red-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            W Military Dr
          </Link>
          <Link
            href="/locations/sw-military"
            className="text-center bg-red-700 hover:bg-red-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            SW Military Dr
          </Link>
        </div>
      </section>

      {/* these shorrtcut links at the topp let you click down to a specific section */}
      <nav aria-label="Menu categories" className="flex flex-wrap gap-2 mb-10">
        {data.map(cat => (
          <a
            key={cat.category}
            href={`#${toId(cat.category)}`}
            className="bg-red-50 hover:bg-red-100 text-red-800 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors border border-red-200"
          >
            {cat.category}
          </a>
        ))}
      </nav>

      {/* all the food categgories and their items rendered here */}
      <div className="space-y-12">
        {data.map(cat => (
          <section key={cat.category} id={toId(cat.category)}>
            <h2 className="text-xl font-bold text-gray-900 border-b-2 border-red-700 pb-2 mb-6">
              {cat.category}
            </h2>

            {cat.sections.map(sec => (
              <div key={sec.subcategory} className="mb-8">
                {sec.subcategory && (
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
                    {sec.subcategory}
                  </h3>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sec.items.map(item => (
                    <ItemCard key={item.name} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
