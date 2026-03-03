'use client'

import { useRef, useState } from 'react'
import { toId } from '@/lib/menuUtils'
import menuData from '@/data/menu.json'
import OrderHeader from './OrderHeader'
import MenuItemCard from './MenuItemCard'
import CartIcon from './CartIcon'
import CartDrawer from './CartDrawer'

type MenuItem = { name: string; image: string; price: string | null; description: string | null }
type Section  = { subcategory: string; items: MenuItem[] }
type Category = { category: string; sections: Section[] }

const data = menuData as Category[]

export default function OrderMenuPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const cartIconRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="min-h-screen bg-gray-50">
      <OrderHeader />

      {/* Category quick-nav */}
      <nav
        aria-label="Menu categories"
        className="sticky top-14 z-20 bg-white border-b border-gray-100 shadow-sm"
      >
        <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
          {data.map(cat => (
            <a
              key={cat.category}
              href={`#${toId(cat.category)}`}
              className="shrink-0 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors border border-red-200"
            >
              {cat.category}
            </a>
          ))}
        </div>
      </nav>

      {/* Menu content */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-28 space-y-12">
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
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {sec.items.map(item => (
                    <MenuItemCard key={item.name} item={item} category={cat.category} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </main>

      <CartIcon ref={cartIconRef} onOpen={() => setDrawerOpen(true)} />
      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        triggerRef={cartIconRef}
      />
    </div>
  )
}
