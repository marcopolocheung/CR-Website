import type { Metadata } from 'next'
import Image from 'next/image'
import menuData from '@/data/menu.json'
import { toId } from '@/lib/menuUtils'

export const metadata: Metadata = {
  title: 'Menu | China Rose',
  description: 'Browse the full China Rose menu with photos, prices, and descriptions.',
}

type MenuItem = { name: string; image: string; price: string | null; description: string | null }
type Section  = { subcategory: string; items: MenuItem[] }
type Category = { category: string; sections: Section[] }

const data = menuData as Category[]


function ItemCard({ item }: { item: MenuItem }) {
  return (
    <div className="flex gap-4 items-start bg-white rounded-xl shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
      <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="96px"
          className="object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex-1 min-w-0 py-1">
        <p className="font-semibold text-gray-900 text-sm leading-snug capitalize">
          {item.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
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
      <h1 className="text-3xl font-bold text-red-800 mb-2">Menu</h1>
      <p className="text-gray-500 text-sm mb-6">Prices and availability subject to change.</p>

      {/* these shorrtcut links at the topp let you click down to a specific section */}
      <div className="flex flex-wrap gap-2 mb-10">
        {data.map(cat => (
          <a
            key={cat.category}
            href={`#${toId(cat.category)}`}
            className="bg-red-50 hover:bg-red-100 text-red-800 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors border border-red-200"
          >
            {cat.category}
          </a>
        ))}
      </div>

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
