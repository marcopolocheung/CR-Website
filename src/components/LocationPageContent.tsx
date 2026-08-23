import Image from 'next/image'
import Link from 'next/link'
import { formatOpeningDays, formatOpeningHours, type OpeningHours } from '@/data/locations'
import menuData from '@/data/menu.json'
import { formatMenuItemName, getMenuPreviewSections, type MenuCategory } from '@/lib/menuUtils'

interface Props {
  name: string
  addressLines: string[]
  phone: string
  phoneHref: string
  toastUrl: string
  uberUrl: string
  mapUrl: string
  hours: OpeningHours
  services: string[]
  featuredDishes: string[]
  menuNote?: string
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const MENU_IMAGES = [`${BASE}/imgs/menu1.jpg`, `${BASE}/imgs/menu2.jpg`, `${BASE}/imgs/menu3.jpg`, `${BASE}/imgs/menu4.jpg`]
const MENU_PREVIEW_SECTIONS = getMenuPreviewSections(menuData as MenuCategory[])

export default function LocationPageContent({
  name, addressLines, phone, phoneHref, toastUrl, uberUrl, mapUrl, hours, services, featuredDishes, menuNote,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

      {/* location namme and header text */}
      <div>
        <h1 className="text-3xl font-bold text-red-800">{name}</h1>
        <p className="text-gray-500 mt-1">San Antonio, TX</p>
      </div>

      {/* address info and hours on the left with the map on the right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-1">Address</h2>
            {addressLines.map((l, i) => <p key={i}>{l}</p>)}
          </div>
          <div>
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-1">Phone</h2>
            <a href={phoneHref} className="text-red-700 font-medium hover:underline">{phone}</a>
          </div>
          <div>
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-1">Hours</h2>
            <p className="text-gray-600 text-sm">{formatOpeningDays(hours)}: {formatOpeningHours(hours)}</p>
          </div>
          <div>
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-1">Services</h2>
            <ul className="flex flex-wrap gap-2 text-sm text-gray-600">
              {services.map((service) => (
                <li key={service} className="rounded-full bg-gray-100 px-3 py-1">
                  {service}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-red-100 bg-red-50 p-6 flex flex-col justify-center">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-2">Map</h2>
          <p className="text-gray-600 text-sm mb-4">
            Open this location in Google Maps for directions and current map details.
          </p>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View on Google Maps - ${name}`}
            className="inline-flex justify-center rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 transition-colors"
          >
            View on Google Maps
          </a>
        </div>
      </div>

      {/* menu section with images and the order buttons */}
      <section>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Menu</h2>
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-gray-900">Same China Rose menu at both San Antonio locations</p>
            <p className="mt-1 text-sm text-gray-600">
              Browse combo meals, bowls, fried rice, lo mein, soups, sides, and drinks in HTML.
            </p>
          </div>
          <Link
            href="/menu"
            className="inline-flex justify-center rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 transition-colors"
          >
            View Full Menu
          </Link>
        </div>

        <div className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-2">Featured dishes</h3>
          <ul className="grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
            {featuredDishes.map((dish) => (
              <li key={dish}>{dish}</li>
            ))}
          </ul>
        </div>

        <div className="mb-5">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-3">Menu preview</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {MENU_PREVIEW_SECTIONS.map((section) => (
              <div key={section.category} className="rounded-xl border border-gray-200 bg-white p-4">
                <Link href={section.href} className="font-bold text-red-800 hover:text-red-900 hover:underline">
                  {formatMenuItemName(section.category)}
                </Link>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {section.items.map((item) => (
                    <li key={item.name} className="flex gap-3">
                      <span className="min-w-0 flex-1">{formatMenuItemName(item.name)}</span>
                      {item.price && <span className="shrink-0 font-semibold text-gray-900">{item.price}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* on mobile the order buttons go above the menu so they dont get buried */}
        <div className="flex flex-col gap-3 mb-4 md:hidden">
          <a
            href={toastUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Order Pick-Up on Toast - ${name}`}
            className="text-center bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            Order Pick-Up on Toast
          </a>
          <a
            href={uberUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Order Delivery on Uber Eats - ${name}`}
            className="text-center bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            Order Delivery on Uber Eats
          </a>
          <p className="text-xs text-gray-500 text-center">
            Ordering opens through third-party services. Availability and fees may vary.
          </p>
        </div>

        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-3">Menu images</h3>
        {/* on larger screens the menu and buttons are side by side i thinkk its easier that way */}
        <div className="flex gap-5 items-start">
          {/* the scrollable columm where all the menu images stack up */}
          <div className="flex-1 overflow-y-auto max-h-[60vh] space-y-3 pr-1 rounded-lg">
            {MENU_IMAGES.map((src, i) => (
              <div key={i} className="rounded-xl overflow-hidden shadow-sm">
                <Image
                  src={src}
                  alt={`Menu page ${i + 1}`}
                  width={900}
                  height={675}
                  className="w-full h-auto"
                />
              </div>
            ))}
            {menuNote && <p className="text-xs text-gray-400 pt-1">{menuNote}</p>}
          </div>

          {/* desktop only order buttons to the right of the menu */}
          <div className="hidden md:flex flex-col gap-3 w-44 shrink-0">
            <a
              href={toastUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Order Pick-Up on Toast - ${name}`}
              className="text-center bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-3 rounded-xl transition-colors text-sm"
            >
              Order Pick-Up on Toast
            </a>
            <a
              href={uberUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Order Delivery on Uber Eats - ${name}`}
              className="text-center bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-3 rounded-xl transition-colors text-sm"
            >
              Order Delivery on Uber Eats
            </a>
            <p className="text-xs text-gray-500 leading-snug">
              Ordering opens through third-party services. Availability and fees may vary.
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}
